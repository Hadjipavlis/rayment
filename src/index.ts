/**
 * Rayment - Decentralized GPU Rendering Marketplace
 * 
 * A peer-to-peer GPU rendering network with instant crypto payments on Solana.
 * 
 * Hub URL: https://hub.rayment.io
 * 
 * @example
 * ```typescript
 * // Client usage
 * import { RaymentClient } from 'rayment';
 * 
 * const client = new RaymentClient({
 *   hubUrl: 'https://hub.rayment.io',
 *   privateKey: 'your-solana-private-key',
 * });
 * 
 * const result = await client.render({
 *   filePath: './scene.blend',
 *   outputPath: './render.png',
 * });
 * 
 * console.log(`Rendered in ${result.job.renderTime}s, cost: ${result.cost} SOL`);
 * ```
 * 
 * @example
 * ```typescript
 * // Provider usage
 * import { RaymentProvider } from 'rayment';
 * 
 * const provider = new RaymentProvider({
 *   hubUrl: 'https://hub.rayment.io',
 *   wallet: 'your-wallet-address',
 *   privateKey: 'your-private-key',
 *   name: 'My GPU Farm',
 *   endpoint: 'http://my-server.com:4402',
 *   spec: {
 *     gpus: [{ name: 'RTX 4090', vram: 24 }],
 *     gpuCount: 4,
 *     totalVram: 96,
 *     maxFileSize: 2000,
 *     supportedFormats: ['.blend', '.obj', '.fbx'],
 *     blenderVersion: '4.0',
 *     renderEngines: ['cycles', 'eevee'],
 *   },
 *   pricing: {
 *     pricePerFrame: 0.001,
 *     pricePerSecond: 0.0001,
 *     pricePerGb: 0.01,
 *     minimumPrice: 0.005,
 *     currency: 'SOL',
 *   },
 * });
 * 
 * await provider.start(4402);
 * ```
 */

// Hub URL
export const HUB_URL = 'https://hub.rayment.io';

// Client SDK
export { RaymentClient } from './client';
export { default as Client } from './client';

// Provider SDK
export { RaymentProvider } from './provider';
export { default as Provider } from './provider';

// Utilities
export { SolanaPayment, calculatePrice } from './utils/solana';

// Types
export * from './types';

// Version
export const VERSION = '1.0.0';
