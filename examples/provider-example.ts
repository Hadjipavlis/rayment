/**
 * Rayment Provider Example
 * 
 * This example shows how to set up a GPU provider:
 * 1. Configure your hardware specs
 * 2. Set your pricing
 * 3. Register with the hub
 * 4. Start accepting render jobs
 */

import { RaymentProvider, ProviderSpec, ProviderPricing } from '../src';

async function main() {
  // Your GPU specifications
  const spec: ProviderSpec = {
    gpus: [
      { name: 'NVIDIA A100 80GB', vram: 80, cudaCores: 6912, tensorCores: 432 },
      { name: 'NVIDIA A100 80GB', vram: 80, cudaCores: 6912, tensorCores: 432 },
    ],
    gpuCount: 2,
    totalVram: 160, // 2x 80GB
    maxFileSize: 2000, // 2GB max file size
    supportedFormats: ['.blend', '.obj', '.fbx', '.gltf', '.glb'],
    blenderVersion: '4.0.0',
    renderEngines: ['cycles', 'eevee'],
  };

  // Your pricing in SOL
  const pricing: ProviderPricing = {
    pricePerFrame: 0.001,      // 0.001 SOL per frame
    pricePerSecond: 0.0001,    // 0.0001 SOL per second of render time
    pricePerGb: 0.01,          // 0.01 SOL per GB of scene file
    minimumPrice: 0.005,       // Minimum 0.005 SOL per job
    currency: 'SOL',
  };

  // Create provider
  const provider = new RaymentProvider({
    hubUrl: 'https://hub.rayment.io',
    wallet: process.env.SOLANA_WALLET!,
    privateKey: process.env.SOLANA_PRIVATE_KEY!,
    name: 'My A100 Farm',
    endpoint: `http://${process.env.PUBLIC_IP || 'localhost'}:4402`,
    spec,
    pricing,
  });

  // Start provider
  await provider.start(4402);

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await provider.stop();
    process.exit(0);
  });

  // Example: Update pricing dynamically
  setTimeout(async () => {
    console.log('\n💰 Updating pricing...');
    await provider.setPricing({
      ...pricing,
      pricePerFrame: 0.0015, // Increase price
    });
  }, 60000);
}

main().catch(console.error);
