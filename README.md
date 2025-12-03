# Rayment

Decentralized GPU rendering marketplace with instant crypto payments on Solana.

## Features

- 🖥️ **Decentralized GPU Marketplace** - Connect with GPU providers worldwide
- 💰 **Instant Crypto Payments** - Pay-per-render with Solana
- ⚡ **Multi-GPU Support** - Utilize multiple GPUs for faster rendering
- 🔒 **Cryptographic Authentication** - Wallet-based identity verification
- 📊 **Real-time Status** - WebSocket updates for job progress
- 🎨 **Blender Support** - Native support for .blend, .obj, .fbx, .gltf files

## Installation

```bash
npm install rayment
```

## Quick Start

### For Clients (Submit Render Jobs)

```typescript
import { RaymentClient } from 'rayment';

const client = new RaymentClient({
  hubUrl: 'https://hub.rayment.io',
  privateKey: 'your-solana-private-key-base58',
});

// One-liner render
const result = await client.render({
  filePath: './scene.blend',
  outputPath: './render.png',
  onProgress: (status) => console.log(status),
});

console.log(`Done! Cost: ${result.cost} SOL, Time: ${result.job.renderTime}s`);
```

### For Providers (Offer Your GPU)

```typescript
import { RaymentProvider } from 'rayment';

const provider = new RaymentProvider({
  hubUrl: 'https://hub.rayment.io',
  wallet: 'your-solana-wallet',
  privateKey: 'your-private-key',
  name: 'My RTX 4090 Farm',
  endpoint: 'http://my-server.com:4402',
  spec: {
    gpus: [{ name: 'RTX 4090', vram: 24 }],
    gpuCount: 4,
    totalVram: 96,
    maxFileSize: 2000,
    supportedFormats: ['.blend', '.obj', '.fbx'],
    blenderVersion: '4.0',
    renderEngines: ['cycles', 'eevee'],
  },
  pricing: {
    pricePerFrame: 0.001,    // SOL
    pricePerSecond: 0.0001,  // SOL
    pricePerGb: 0.01,        // SOL
    minimumPrice: 0.005,     // SOL
    currency: 'SOL',
  },
});

await provider.start(4402);
```

## How It Works

```
┌─────────────┐      1. Upload file       ┌─────────────┐
│             │ ──────────────────────────▶│             │
│   Client    │      2. Price Quote       │     Hub     │
│             │ ◀──────────────────────── │             │
└─────────────┘                           └─────────────┘
       │                                         │
       │ 3. Pay SOL                              │
       ▼                                         │
┌─────────────┐                                  │
│   Solana    │                                  │
│  Blockchain │                                  │
└─────────────┘                                  │
       │                                         │
       │ 4. Confirm                              │
       ▼                                         ▼
┌─────────────┐      5. Send job         ┌─────────────┐
│             │ ◀────────────────────────│             │
│   Client    │      6. Result           │  Provider   │
│             │ ◀────────────────────────│   (GPU)     │
└─────────────┘                          └─────────────┘
```

1. Client uploads a 3D file to the Hub
2. Hub returns price quote
3. Client pays in SOL to provider's wallet
4. Client confirms payment with transaction signature
5. Hub sends the job to the provider
6. Provider renders and returns the result

## API Reference

### Client Methods

| Method | Description |
|--------|-------------|
| `getProviders(status?)` | List available providers |
| `getProvider(id)` | Get provider details |
| `requestRender(options)` | Request a render (returns 402) |
| `payForRender(payment)` | Pay for a render job |
| `getJobStatus(jobId)` | Get job status |
| `waitForCompletion(jobId)` | Wait for job to finish |
| `downloadResult(jobId, path)` | Download render result |
| `render(options)` | Full render flow (request→pay→wait→download) |
| `estimateCost(options)` | Estimate render cost |

### Provider Methods

| Method | Description |
|--------|-------------|
| `register()` | Register with hub |
| `start(port)` | Start accepting jobs |
| `stop()` | Stop provider |
| `setStatus(status)` | Update status |
| `setPricing(pricing)` | Update pricing |

### Hub Endpoints

**Base URL:** `https://hub.rayment.io`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/stats` | GET | Hub statistics |
| `/providers` | GET | List providers |
| `/providers/:id` | GET | Provider details |
| `/render` | POST | Submit render request |
| `/render/pay` | POST | Confirm payment |
| `/render/:jobId` | GET | Job status |
| `/render/:jobId/result` | GET | Download result |
| `/provider/register` | POST | Register provider |
| `/provider/status` | PUT | Update status |
| `/provider/pricing` | PUT | Update pricing |

## Pricing Model

Providers set their own prices with these components:

```typescript
{
  pricePerFrame: 0.001,    // SOL per frame rendered
  pricePerSecond: 0.0001,  // SOL per second of render time
  pricePerGb: 0.01,        // SOL per GB of scene file
  minimumPrice: 0.005,     // Minimum price per job
}
```

The hub adds a platform fee (5%) on top.

**Example calculation:**
- 100MB file × 0.01 SOL/GB = 0.001 SOL
- 1 frame × 0.001 SOL = 0.001 SOL  
- Estimated 60s × 0.0001 SOL/s = 0.006 SOL
- Subtotal: 0.008 SOL
- Platform fee (5%): 0.0004 SOL
- **Total: ~0.0084 SOL**

## Environment Variables

```bash
# For Clients
SOLANA_PRIVATE_KEY=your-base58-private-key

# For Providers
SOLANA_WALLET=your-wallet-address
SOLANA_PRIVATE_KEY=your-private-key
PUBLIC_IP=your-server-ip
```

## Supported File Formats

- `.blend` - Blender (native)
- `.obj` - Wavefront OBJ
- `.fbx` - Autodesk FBX
- `.gltf` / `.glb` - glTF 2.0
- `.stl` - Stereolithography
- `.dae` - Collada

## Requirements

**For Providers:**
- Linux/Windows/macOS
- Blender 4.0+ installed
- NVIDIA GPU with CUDA support (recommended)
- Node.js 18+

**For Clients:**
- Node.js 18+
- Solana wallet with SOL

## Security

- All provider actions require wallet signature verification
- Payments are verified on-chain before processing
- File integrity verified with SHA-256 hashes
- WebSocket connections authenticated

## CA

hjt1aYxsB1eucF5CHHEQVnSsxHnxEvgPyBjED9Zpump

## License

MIT © Rayment
