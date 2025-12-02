/**
 * Rayment Provider SDK
 * For providers who want to offer their GPU
 */

import express from 'express';
import multer from 'multer';
import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import axios from 'axios';
import FormData from 'form-data';

import {
  RaymentProviderConfig,
  ProviderSpec,
  ProviderPricing,
  RenderSettings,
  RenderJob,
} from './types';
import { SolanaPayment } from './utils/solana';

const DEFAULT_HUB_URL = 'https://hub.rayment.io';

export class RaymentProvider {
  private config: RaymentProviderConfig;
  private solana: SolanaPayment;
  private ws?: WebSocket;
  private providerId?: string;
  private app: express.Application;
  private workDir: string;
  private isRendering = false;

  constructor(config: RaymentProviderConfig) {
    this.config = {
      hubUrl: DEFAULT_HUB_URL,
      ...config,
    };
    this.solana = new SolanaPayment(undefined, config.privateKey);
    this.workDir = path.join(process.cwd(), 'render-work');
    
    if (!fs.existsSync(this.workDir)) {
      fs.mkdirSync(this.workDir, { recursive: true });
    }

    this.app = this.createServer();
  }

  /**
   * Create local render server
   */
  private createServer(): express.Application {
    const app = express();
    const upload = multer({ dest: this.workDir });

    app.use(express.json());

    // Health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        isRendering: this.isRendering,
        spec: this.config.spec,
        pricing: this.config.pricing,
      });
    });

    // Receive render job from hub
    app.post('/render', upload.single('file'), async (req, res) => {
      if (this.isRendering) {
        return res.status(503).json({ error: 'Already rendering' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file' });
      }

      const { jobId, settings: settingsStr } = req.body;
      const settings: RenderSettings = JSON.parse(settingsStr || '{}');

      console.log(`🎬 Received job: ${jobId}`);

      this.isRendering = true;
      res.json({ status: 'accepted' });

      // Process render asynchronously
      this.processRender(req.file.path, req.file.originalname || 'scene.blend', jobId, settings)
        .catch(err => console.error('Render error:', err))
        .finally(() => {
          this.isRendering = false;
        });
    });

    return app;
  }

  /**
   * Process a render job
   */
  private async processRender(
    filePath: string,
    fileName: string,
    jobId: string,
    settings: RenderSettings
  ): Promise<void> {
    const startTime = Date.now();
    const jobDir = path.join(this.workDir, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const inputPath = path.join(jobDir, fileName);
    const outputPath = path.join(jobDir, 'result.png');

    fs.renameSync(filePath, inputPath);

    try {
      console.log(`🖥️ Starting render: ${fileName}`);

      // Use custom render command or default Blender
      if (this.config.renderCommand) {
        await this.config.renderCommand(inputPath, outputPath, settings);
      } else {
        await this.renderWithBlender(inputPath, outputPath, settings);
      }

      const renderTime = (Date.now() - startTime) / 1000;
      console.log(`✅ Render complete: ${renderTime}s`);

      // Send result to hub
      await this.sendResult(jobId, outputPath, renderTime);

    } catch (error: any) {
      console.error(`❌ Render failed:`, error.message);
      await this.reportFailure(jobId, error.message);
    } finally {
      // Cleanup
      fs.rmSync(jobDir, { recursive: true, force: true });
    }
  }

  /**
   * Default Blender render
   */
  private async renderWithBlender(
    inputPath: string,
    outputPath: string,
    settings: RenderSettings
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const pythonScript = `
import bpy
import sys

bpy.ops.wm.open_mainfile(filepath="${inputPath.replace(/\\/g, '/')}")

# GPU setup
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'CUDA'
    prefs.get_devices()
    for device in prefs.devices:
        if device.type in ('CUDA', 'OPTIX'):
            device.use = True
        else:
            device.use = False
    bpy.context.scene.cycles.device = 'GPU'
except:
    pass

# Render settings
bpy.context.scene.render.filepath = "${outputPath.replace(/\\/g, '/')}"
bpy.context.scene.render.resolution_x = ${settings.resolution?.width || 1920}
bpy.context.scene.render.resolution_y = ${settings.resolution?.height || 1080}
bpy.context.scene.render.image_settings.file_format = '${settings.outputFormat || 'PNG'}'

bpy.ops.render.render(write_still=True)
print("RENDER_COMPLETE")
`;

      const scriptPath = path.join(path.dirname(inputPath), 'render.py');
      fs.writeFileSync(scriptPath, pythonScript);

      const blender = spawn('blender', ['-b', '-P', scriptPath]);
      
      let output = '';
      
      blender.stdout.on('data', (data) => {
        output += data.toString();
      });

      blender.stderr.on('data', (data) => {
        output += data.toString();
      });

      blender.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve();
        } else {
          reject(new Error(output.slice(-500) || `Blender exited with code ${code}`));
        }
      });

      blender.on('error', reject);
    });
  }

  /**
   * Send render result to hub
   */
  private async sendResult(jobId: string, resultPath: string, renderTime: number): Promise<void> {
    const form = new FormData();
    form.append('result', fs.createReadStream(resultPath));
    form.append('providerId', this.providerId);
    form.append('renderTime', renderTime.toString());
    
    const signature = this.solana.signMessage(`complete:${jobId}:${renderTime}`);
    form.append('signature', signature);

    await axios.post(
      `${this.config.hubUrl}/provider/job/${jobId}/complete`,
      form,
      { headers: form.getHeaders() }
    );

    console.log(`📤 Result sent to hub`);
  }

  /**
   * Report job failure to hub
   */
  private async reportFailure(jobId: string, error: string): Promise<void> {
    await axios.post(`${this.config.hubUrl}/provider/job/${jobId}/failed`, {
      providerId: this.providerId,
      error,
    });
  }

  /**
   * Register with hub
   */
  async register(): Promise<string> {
    const message = `register:${this.config.wallet}:${this.config.name}`;
    const signature = this.solana.signMessage(message);

    const res = await axios.post(`${this.config.hubUrl}/provider/register`, {
      name: this.config.name,
      wallet: this.config.wallet,
      endpoint: this.config.endpoint,
      spec: this.config.spec,
      pricing: this.config.pricing,
      signature,
    });

    this.providerId = res.data.data.providerId;
    console.log(`✅ Registered as: ${this.providerId}`);
    
    return this.providerId;
  }

  /**
   * Connect WebSocket to hub
   */
  private connectWebSocket(): void {
    const wsUrl = this.config.hubUrl.replace('https', 'wss').replace('http', 'ws') + '/ws';
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('🔌 WebSocket connected');
      
      // Authenticate
      const timestamp = Date.now();
      const message = `ws:${this.providerId}:${timestamp}`;
      const signature = this.solana.signMessage(message);

      this.ws?.send(JSON.stringify({
        type: 'auth',
        providerId: this.providerId,
        timestamp,
        signature,
      }));
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'authenticated') {
          console.log('✅ WebSocket authenticated');
        }
        
        if (msg.type === 'job:paid') {
          console.log(`💰 Job paid: ${msg.jobId}`);
        }

      } catch (e) {
        console.error('WS message error:', e);
      }
    });

    this.ws.on('close', () => {
      console.log('🔌 WebSocket disconnected, reconnecting...');
      setTimeout(() => this.connectWebSocket(), 5000);
    });

    this.ws.on('error', (err) => {
      console.error('WS error:', err.message);
    });

    // Heartbeat
    setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000);
  }

  /**
   * Update status
   */
  async setStatus(status: 'online' | 'offline' | 'busy' | 'maintenance'): Promise<void> {
    const message = `status:${this.providerId}:${status}`;
    const signature = this.solana.signMessage(message);

    await axios.put(`${this.config.hubUrl}/provider/status`, {
      providerId: this.providerId,
      status,
      signature,
    });

    console.log(`📊 Status: ${status}`);
  }

  /**
   * Update pricing
   */
  async setPricing(pricing: ProviderPricing): Promise<void> {
    const message = `pricing:${this.providerId}:${JSON.stringify(pricing)}`;
    const signature = this.solana.signMessage(message);

    await axios.put(`${this.config.hubUrl}/provider/pricing`, {
      providerId: this.providerId,
      pricing,
      signature,
    });

    this.config.pricing = pricing;
    console.log(`💰 Pricing updated`);
  }

  /**
   * Start the provider
   */
  async start(port: number = 4402): Promise<void> {
    // Register with hub
    await this.register();

    // Start local server
    await new Promise<void>((resolve) => {
      this.app.listen(port, () => {
        console.log(`
╔═══════════════════════════════════════════════════╗
║           🖥️ Rayment Provider                      ║
╠═══════════════════════════════════════════════════╣
║  Name:       ${this.config.name.padEnd(35)}║
║  Wallet:     ${this.config.wallet.slice(0, 20)}...       ║
║  Endpoint:   http://localhost:${port}                 ║
║  Hub:        ${this.config.hubUrl.padEnd(35)}║
╠═══════════════════════════════════════════════════╣
║  Pricing:                                         ║
║    Per Frame:    ${this.config.pricing.pricePerFrame.toString().padEnd(15)} SOL      ║
║    Per Second:   ${this.config.pricing.pricePerSecond.toString().padEnd(15)} SOL      ║
║    Per GB:       ${this.config.pricing.pricePerGb.toString().padEnd(15)} SOL      ║
║    Minimum:      ${this.config.pricing.minimumPrice.toString().padEnd(15)} SOL      ║
╚═══════════════════════════════════════════════════╝
        `);
        resolve();
      });
    });

    // Connect WebSocket
    this.connectWebSocket();

    // Set online
    await this.setStatus('online');
  }

  /**
   * Stop the provider
   */
  async stop(): Promise<void> {
    await this.setStatus('offline');
    this.ws?.close();
    console.log('Provider stopped');
  }
}

export default RaymentProvider;
