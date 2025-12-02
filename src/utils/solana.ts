/**
 * Solana Payment Utilities for Rayment
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
  sendAndConfirmTransaction,
  TransactionSignature,
} from '@solana/web3.js';
import bs58 from 'bs58';

// Default to mainnet, can be overridden
const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

export class SolanaPayment {
  private connection: Connection;
  private keypair?: Keypair;

  constructor(rpcUrl: string = DEFAULT_RPC, privateKey?: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    
    if (privateKey) {
      const secretKey = bs58.decode(privateKey);
      this.keypair = Keypair.fromSecretKey(secretKey);
    }
  }

  /**
   * Get wallet public key
   */
  getPublicKey(): string | null {
    return this.keypair?.publicKey.toBase58() || null;
  }

  /**
   * Get wallet balance in SOL
   */
  async getBalance(wallet?: string): Promise<number> {
    const publicKey = wallet 
      ? new PublicKey(wallet) 
      : this.keypair?.publicKey;
    
    if (!publicKey) throw new Error('No wallet specified');
    
    const balance = await this.connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Send SOL payment
   */
  async sendPayment(
    toWallet: string,
    amountSOL: number,
    memo?: string
  ): Promise<TransactionSignature> {
    if (!this.keypair) {
      throw new Error('Private key required for sending payments');
    }

    const toPubkey = new PublicKey(toWallet);
    const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.keypair.publicKey,
        toPubkey,
        lamports,
      })
    );

    // Add memo if provided (for job reference)
    if (memo) {
      // Memo program
      const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
      transaction.add({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo),
      });
    }

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.keypair]
    );

    return signature;
  }

  /**
   * Verify a payment transaction
   */
  async verifyPayment(
    txSignature: string,
    expectedTo: string,
    expectedAmountSOL: number,
    expectedMemo?: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const tx = await this.connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return { valid: false, error: 'Transaction not found' };
      }

      if (tx.meta?.err) {
        return { valid: false, error: 'Transaction failed' };
      }

      // Check recipient and amount
      const postBalances = tx.meta?.postBalances || [];
      const preBalances = tx.meta?.preBalances || [];
      const accountKeys = tx.transaction.message.getAccountKeys();

      const toIndex = accountKeys.staticAccountKeys.findIndex(
        key => key.toBase58() === expectedTo
      );

      if (toIndex === -1) {
        return { valid: false, error: 'Recipient not found in transaction' };
      }

      const received = (postBalances[toIndex] - preBalances[toIndex]) / LAMPORTS_PER_SOL;
      const tolerance = 0.0001; // Small tolerance for fees

      if (received < expectedAmountSOL - tolerance) {
        return { 
          valid: false, 
          error: `Insufficient amount: expected ${expectedAmountSOL}, got ${received}` 
        };
      }

      // Optionally verify memo
      if (expectedMemo) {
        // Memo verification would go here
        // For simplicity, we skip this in MVP
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Sign a message to prove wallet ownership
   */
  signMessage(message: string): string {
    if (!this.keypair) {
      throw new Error('Private key required for signing');
    }

    const messageBytes = Buffer.from(message);
    const signature = require('tweetnacl').sign.detached(
      messageBytes,
      this.keypair.secretKey
    );

    return bs58.encode(signature);
  }

  /**
   * Verify a signed message
   */
  static verifySignature(
    message: string,
    signature: string,
    publicKey: string
  ): boolean {
    try {
      const messageBytes = Buffer.from(message);
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = new PublicKey(publicKey).toBytes();

      return require('tweetnacl').sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate a new wallet
   */
  static generateWallet(): { publicKey: string; privateKey: string } {
    const keypair = Keypair.generate();
    return {
      publicKey: keypair.publicKey.toBase58(),
      privateKey: bs58.encode(keypair.secretKey),
    };
  }

  /**
   * Validate Solana address
   */
  static isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Calculate price breakdown for a render job
 */
export function calculatePrice(
  pricing: {
    pricePerFrame: number;
    pricePerSecond: number;
    pricePerGb: number;
    minimumPrice: number;
  },
  jobInfo: {
    fileSizeMb: number;
    frameCount: number;
    estimatedRenderSeconds: number;
  },
  platformFeePercent: number = 5
): {
  basePrice: number;
  fileSizeFee: number;
  frameFee: number;
  estimatedRenderFee: number;
  platformFee: number;
  total: number;
} {
  const fileSizeFee = (jobInfo.fileSizeMb / 1024) * pricing.pricePerGb;
  const frameFee = jobInfo.frameCount * pricing.pricePerFrame;
  const estimatedRenderFee = jobInfo.estimatedRenderSeconds * pricing.pricePerSecond;
  
  const subtotal = fileSizeFee + frameFee + estimatedRenderFee;
  const basePrice = Math.max(subtotal, pricing.minimumPrice);
  const platformFee = basePrice * (platformFeePercent / 100);
  const total = basePrice + platformFee;

  return {
    basePrice,
    fileSizeFee,
    frameFee,
    estimatedRenderFee,
    platformFee,
    total: Math.round(total * 1000000) / 1000000, // 6 decimal places
  };
}
