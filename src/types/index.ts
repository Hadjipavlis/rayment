/**
 * Rayment Type Definitions
 */

// ============================================
// PROVIDER TYPES
// ============================================

export interface GpuSpec {
  name: string;           // "NVIDIA A100 80GB"
  vram: number;           // VRAM in GB
  cudaCores?: number;
  tensorCores?: number;
}

export interface ProviderPricing {
  pricePerFrame: number;      // SOL per frame
  pricePerSecond: number;     // SOL per second of render time
  pricePerGb: number;         // SOL per GB of scene file
  minimumPrice: number;       // Minimum job price in SOL
  currency: 'SOL';
}

export interface ProviderSpec {
  gpus: GpuSpec[];
  gpuCount: number;
  totalVram: number;          // Total VRAM in GB
  maxFileSize: number;        // Max file size in MB
  supportedFormats: string[]; // ['.blend', '.obj', ...]
  blenderVersion: string;
  renderEngines: string[];    // ['cycles', 'eevee']
}

export interface Provider {
  id: string;
  name: string;
  wallet: string;             // Solana wallet address
  endpoint: string;           // Provider's render endpoint
  spec: ProviderSpec;
  pricing: ProviderPricing;
  status: ProviderStatus;
  rating: number;             // 0-5 stars
  completedJobs: number;
  registeredAt: number;
  lastSeen: number;
}

export type ProviderStatus = 'online' | 'offline' | 'busy' | 'maintenance';

export interface ProviderRegistration {
  name: string;
  wallet: string;
  endpoint: string;
  spec: ProviderSpec;
  pricing: ProviderPricing;
  signature: string;          // Signed message to verify wallet ownership
}

// ============================================
// JOB TYPES
// ============================================

export interface RenderJob {
  id: string;
  clientWallet: string;
  providerId: string;
  status: JobStatus;
  
  // File info
  fileName: string;
  fileSize: number;           // bytes
  fileHash: string;           // SHA256
  
  // Render settings
  settings: RenderSettings;
  
  // Pricing
  estimatedPrice: number;     // SOL
  finalPrice?: number;        // SOL (after completion)
  
  // Payment
  paymentTx?: string;         // Solana transaction signature
  paymentStatus: PaymentStatus;
  
  // Timing
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  renderTime?: number;        // seconds
  
  // Result
  resultUrl?: string;
  error?: string;
}

export type JobStatus = 
  | 'pending_payment'
  | 'paid'
  | 'queued'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type PaymentStatus = 
  | 'pending'
  | 'confirming'
  | 'confirmed'
  | 'failed';

export interface RenderSettings {
  resolution: {
    width: number;
    height: number;
  };
  frames?: {
    start: number;
    end: number;
  };
  engine?: 'cycles' | 'eevee';
  samples?: number;
  outputFormat: 'PNG' | 'JPEG' | 'EXR';
}

// ============================================
// API TYPES
// ============================================

export interface RenderRequest {
  file: Buffer | string;      // File buffer or URL
  fileName: string;
  settings: RenderSettings;
  clientWallet: string;
  preferredProvider?: string; // Provider ID
  maxPrice?: number;          // Max price willing to pay
}

export interface PaymentRequired {
  jobId: string;
  price: number;              // SOL
  breakdown: PriceBreakdown;
  payTo: string;              // Provider wallet
  expiresAt: number;          // Unix timestamp
  memo: string;               // Payment memo/reference
}

export interface PriceBreakdown {
  basePrice: number;
  fileSizeFee: number;
  frameFee: number;
  estimatedRenderFee: number;
  platformFee: number;
  total: number;
}

export interface PaymentConfirmation {
  jobId: string;
  txSignature: string;
}

export interface JobResult {
  jobId: string;
  status: JobStatus;
  renderTime?: number;
  resultUrl?: string;
  resultHash?: string;
}

// ============================================
// CLIENT CONFIG
// ============================================

export interface RaymentClientConfig {
  hubUrl: string;
  wallet?: string;
  privateKey?: string;
  autoRetry?: boolean;
  timeout?: number;
}

export interface RaymentProviderConfig {
  hubUrl: string;
  wallet: string;
  privateKey: string;
  name: string;
  endpoint: string;
  spec: ProviderSpec;
  pricing: ProviderPricing;
  renderCommand?: (inputPath: string, outputPath: string, settings: RenderSettings) => Promise<void>;
}

// ============================================
// EVENTS
// ============================================

export type HubEvent = 
  | { type: 'job:new'; job: RenderJob }
  | { type: 'job:paid'; jobId: string; txSignature: string }
  | { type: 'job:started'; jobId: string }
  | { type: 'job:progress'; jobId: string; progress: number }
  | { type: 'job:completed'; jobId: string; resultUrl: string }
  | { type: 'job:failed'; jobId: string; error: string }
  | { type: 'provider:online'; providerId: string }
  | { type: 'provider:offline'; providerId: string };

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ProvidersListResponse {
  providers: Provider[];
  total: number;
}

export interface HubStats {
  totalProviders: number;
  onlineProviders: number;
  totalJobs: number;
  completedJobs: number;
  totalVolumeSOL: number;
  avgRenderTime: number;
}

// ============================================
// BATCH RENDERING
// ============================================

export interface BatchRenderOptions {
  files: string[];
  outputDir: string;
  settings?: Partial<RenderSettings>;
  providerId?: string;
  concurrency?: number;
  stopOnError?: boolean;
  onFileProgress?: (file: string, status: BatchFileStatus) => void;
  onBatchProgress?: (progress: BatchProgress) => void;
}

export interface BatchFileStatus {
  file: string;
  status: 'pending' | 'uploading' | 'paying' | 'rendering' | 'downloading' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  jobId?: string;
  cost?: number;
  renderTime?: number;
  outputPath?: string;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  totalCost: number;
  elapsedTime: number;
}

export interface BatchRenderResult {
  successful: BatchFileResult[];
  failed: BatchFileResult[];
  totalCost: number;
  totalTime: number;
  stats: {
    total: number;
    completed: number;
    failed: number;
    avgRenderTime: number;
    avgCost: number;
  };
}

export interface BatchFileResult {
  file: string;
  outputPath?: string;
  jobId?: string;
  cost?: number;
  renderTime?: number;
  error?: string;
}
