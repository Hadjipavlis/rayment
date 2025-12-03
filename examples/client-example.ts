/**
 * Rayment Client Example
 * 
 * This example shows how to use the Rayment client to:
 * 1. Connect to the hub
 * 2. List available providers
 * 3. Submit a render job
 * 4. Pay with SOL
 * 5. Download the result
 */

import { RaymentClient } from '../src';

async function main() {
  // Initialize client with your Solana wallet
  const client = new RaymentClient({
    hubUrl: 'https://hub.rayment.io',
    // Your Solana private key (base58 encoded)
    privateKey: process.env.SOLANA_PRIVATE_KEY,
  });

  console.log('🔗 Connected to Rayment Hub');

  // Check balance
  const balance = await client.getBalance();
  console.log(`💰 Wallet balance: ${balance} SOL`);

  // List available providers
  const providers = await client.getProviders('online');
  console.log(`\n📡 Available providers: ${providers.length}`);
  
  providers.forEach(p => {
    console.log(`  - ${p.name}`);
    console.log(`    GPUs: ${p.spec.gpuCount}x (${p.spec.totalVram}GB VRAM)`);
    console.log(`    Price: ${p.pricing.minimumPrice} SOL minimum`);
  });

  if (providers.length === 0) {
    console.log('No providers available!');
    return;
  }

  // Estimate cost before rendering
  const estimate = await client.estimateCost({
    fileSizeMb: 100,
    frameCount: 1,
  });
  console.log(`\n💵 Estimated cost: ${estimate.breakdown.total} SOL`);

  // Full render flow
  console.log('\n🎬 Starting render...');
  
  const result = await client.render({
    filePath: './scene.blend',
    outputPath: './output.png',
    settings: {
      resolution: { width: 1920, height: 1080 },
      outputFormat: 'PNG',
    },
    onProgress: (status, job) => {
      console.log(`  ${status}`);
    },
  });

  console.log(`\n✅ Render complete!`);
  console.log(`  Time: ${result.job.renderTime}s`);
  console.log(`  Cost: ${result.cost} SOL`);
  console.log(`  File: ${result.resultPath}`);
}

// Manual step-by-step flow
async function manualFlow() {
  const client = new RaymentClient({
    hubUrl: 'https://hub.rayment.io',
    privateKey: process.env.SOLANA_PRIVATE_KEY,
  });

  // Step 1: Request render (get price)
  console.log('📤 Requesting render...');
  const payment = await client.requestRender({
    filePath: './scene.blend',
  });

  console.log(`\n💰 Payment Required:`);
  console.log(`  Job ID: ${payment.jobId}`);
  console.log(`  Price: ${payment.price} SOL`);
  console.log(`  Pay to: ${payment.payTo}`);
  console.log(`  Expires: ${new Date(payment.expiresAt).toISOString()}`);
  console.log(`\n  Breakdown:`);
  console.log(`    File size fee: ${payment.breakdown.fileSizeFee} SOL`);
  console.log(`    Frame fee: ${payment.breakdown.frameFee} SOL`);
  console.log(`    Render fee: ${payment.breakdown.estimatedRenderFee} SOL`);
  console.log(`    Platform fee: ${payment.breakdown.platformFee} SOL`);

  // Step 2: Pay
  console.log('\n💸 Sending payment...');
  const jobId = await client.payForRender(payment);
  console.log(`✅ Paid! Job ID: ${jobId}`);

  // Step 3: Wait for completion
  console.log('\n⏳ Waiting for render...');
  const job = await client.waitForCompletion(jobId, {
    onProgress: (j) => console.log(`  Status: ${j.status}`),
  });
  console.log(`✅ Render complete in ${job.renderTime}s`);

  // Step 4: Download
  console.log('\n📥 Downloading result...');
  const resultPath = await client.downloadResult(jobId, './output.png');
  console.log(`✅ Saved to: ${resultPath}`);
}

main().catch(console.error);
