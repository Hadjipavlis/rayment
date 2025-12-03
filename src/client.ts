/**
 * Rayment Client SDK
 * For clients who want to submit render jobs
 */

import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

import {
  RaymentClientConfig,
  Provider,
  RenderJob,
  RenderSettings,
  PaymentRequired,
  PriceBreakdown,
  ProvidersListResponse,
  HubStats,
} from './types';
import { SolanaPayment } from './utils/solana';

const DEFAULT_HUB_URL = 'https://hub.rayment.io';

export class RaymentClient {
  private api: AxiosInstance;
  private solana?: SolanaPayment;
  private config: RaymentClientConfig;

  constructor(config: RaymentClientConfig) {
    this.config = {
      ...config,
      hubUrl: config.hubUrl || DEFAULT_HUB_URL,
      timeout: config.timeout || 300000, // 5 minutes default
      autoRetry: config.autoRetry ?? true,
    };

    this.api = axios.create({
      baseURL: this.config.hubUrl,
      timeout: this.config.timeout,
    });

    if (config.privateKey) {
      this.solana = new SolanaPayment(undefined, config.privateKey);
    }
  }

  /**
   * Get hub statistics
   */
  async getStats(): Promise<HubStats> {
    const res = await this.api.get('/stats');
    return res.data.data;
  }

  /**
   * List available providers
   */
  async getProviders(status?: 'online' | 'offline' | 'busy'): Promise<Provider[]> {
    const res = await this.api.get('/providers', { params: { status } });
    return res.data.data.providers;
  }

  /**
   * Get provider details
   */
  async getProvider(providerId: string): Promise<Provider> {
    const res = await this.api.get(`/providers/${providerId}`);
    return res.data.data;
  }

  /**
   * Request a render job (returns payment info)
   */
  async requestRender(options: {
    filePath: string;
    settings?: Partial<RenderSettings>;
    providerId?: string;
  }): Promise<PaymentRequired> {
    const wallet = this.config.wallet || this.solana?.getPublicKey();
    if (!wallet) {
      throw new Error('Wallet address required');
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(options.filePath));
    form.append('clientWallet', wallet);
    
    if (options.providerId) {
      form.append('providerId', options.providerId);
    }

    const settings: RenderSettings = {
      resolution: { width: 1920, height: 1080 },
      outputFormat: 'PNG',
      ...options.settings,
    };
    form.append('settings', JSON.stringify(settings));

    try {
      await this.api.post('/render', form, {
        headers: form.getHeaders(),
      });
      throw new Error('Expected 402 response');
    } catch (error: any) {
      if (error.response?.status === 402) {
        return error.response.data.payment;
      }
      throw error;
    }
  }

  /**
   * Pay for a render job
   */
  async payForRender(payment: PaymentRequired): Promise<string> {
    if (!this.solana) {
      throw new Error('Private key required for payments');
    }

    console.log(`💰 Paying ${payment.price} SOL to ${payment.payTo}...`);

    const txSignature = await this.solana.sendPayment(
      payment.payTo,
      payment.price,
      payment.memo
    );

    console.log(`✅ Payment sent: ${txSignature}`);

    // Confirm payment with hub
    const res = await this.api.post('/render/pay', {
      jobId: payment.jobId,
      txSignature,
    });

    if (!res.data.success) {
      throw new Error(res.data.error || 'Payment confirmation failed');
    }

    return payment.jobId;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<RenderJob> {
    const res = await this.api.get(`/render/${jobId}`);
    return res.data.data;
  }

  /**
   * Wait for job completion
   */
  async waitForCompletion(
    jobId: string,
    options: {
      pollInterval?: number;
      timeout?: number;
      onProgress?: (job: RenderJob) => void;
    } = {}
  ): Promise<RenderJob> {
    const pollInterval = options.pollInterval || 2000;
    const timeout = options.timeout || 600000; // 10 minutes
    const startTime = Date.now();

    while (true) {
      const job = await this.getJobStatus(jobId);

      if (options.onProgress) {
        options.onProgress(job);
      }

      if (job.status === 'completed') {
        return job;
      }

      if (job.status === 'failed') {
        throw new Error(`Render failed: ${job.error}`);
      }

      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for render');
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Download render result
   */
  async downloadResult(jobId: string, outputPath: string): Promise<string> {
    const res = await this.api.get(`/render/${jobId}/result`, {
      responseType: 'arraybuffer',
    });

    const finalPath = outputPath.endsWith('.png') ? outputPath : `${outputPath}.png`;
    fs.writeFileSync(finalPath, res.data);
    
    return finalPath;
  }

  /**
   * Complete render flow: request -> pay -> wait -> download
   */
  async render(options: {
    filePath: string;
    outputPath: string;
    settings?: Partial<RenderSettings>;
    providerId?: string;
    onProgress?: (status: string, job?: RenderJob) => void;
  }): Promise<{
    job: RenderJob;
    resultPath: string;
    cost: number;
  }> {
    const { filePath, outputPath, settings, providerId, onProgress } = options;

    // Step 1: Request render
    onProgress?.('Requesting render...');
    const payment = await this.requestRender({ filePath, settings, providerId });
    
    onProgress?.(`Price: ${payment.price} SOL`);
    console.log('Price breakdown:', payment.breakdown);

    // Step 2: Pay
    onProgress?.('Processing payment...');
    const jobId = await this.payForRender(payment);

    // Step 3: Wait for completion
    const job = await this.waitForCompletion(jobId, {
      onProgress: (j) => onProgress?.(`Status: ${j.status}`, j),
    });

    // Step 4: Download result
    onProgress?.('Downloading result...');
    const resultPath = await this.downloadResult(jobId, outputPath);

    onProgress?.('Done!');

    return {
      job,
      resultPath,
      cost: payment.price,
    };
  }

  /**
   * Estimate render cost without submitting
   */
  async estimateCost(options: {
    fileSizeMb: number;
    frameCount?: number;
    providerId?: string;
  }): Promise<{
    provider: Provider;
    breakdown: PriceBreakdown;
  }> {
    let provider: Provider;

    if (options.providerId) {
      provider = await this.getProvider(options.providerId);
    } else {
      const providers = await this.getProviders('online');
      if (providers.length === 0) {
        throw new Error('No providers available');
      }
      provider = providers[0];
    }

    const frameCount = options.frameCount || 1;
    const estimatedSeconds = 60; // Rough estimate

    const fileSizeFee = (options.fileSizeMb / 1024) * provider.pricing.pricePerGb;
    const frameFee = frameCount * provider.pricing.pricePerFrame;
    const estimatedRenderFee = estimatedSeconds * provider.pricing.pricePerSecond;
    
    const subtotal = fileSizeFee + frameFee + estimatedRenderFee;
    const basePrice = Math.max(subtotal, provider.pricing.minimumPrice);
    const platformFee = basePrice * 0.05;
    const total = basePrice + platformFee;

    return {
      provider,
      breakdown: {
        basePrice,
        fileSizeFee,
        frameFee,
        estimatedRenderFee,
        platformFee,
        total,
      },
    };
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<number> {
    if (!this.solana) {
      throw new Error('Private key required');
    }
    return this.solana.getBalance();
  }
}

export default RaymentClient;
