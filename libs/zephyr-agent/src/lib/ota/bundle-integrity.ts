import type { BundleMetadata } from 'zephyr-edge-contract';
import { ZephyrError, ZeErrors } from '../errors';

/** Integrity verification result */
export interface IntegrityCheckResult {
  /** Whether the integrity check passed */
  valid: boolean;
  /** Expected checksum from metadata */
  expectedChecksum: string;
  /** Actual checksum computed from data */
  actualChecksum?: string;
  /** Error message if validation failed */
  error?: string;
}

/**
 * BundleIntegrityVerifier handles SHA-256 checksum verification for bundle integrity
 *
 * Features:
 *
 * - SHA-256 checksum verification
 * - Both string and Buffer support
 * - Platform-agnostic (uses Web Crypto API in React Native 0.60+)
 *
 * Platform Support:
 *
 * - React Native 0.60+: Uses global.crypto (Web Crypto API polyfill)
 * - Modern browsers: Uses window.crypto.subtle
 * - Node.js: Uses crypto module (fallback)
 *
 * Security:
 *
 * - Uses SHA-256 (not vulnerable like MD5/SHA-1)
 * - Constant-time comparison to prevent timing attacks
 * - Validates hex format before comparison
 */
export class BundleIntegrityVerifier {
  private debug: boolean;
  private crypto: any;
  private isReactNative: boolean;

  constructor(debug = false) {
    this.debug = debug;
    this.isReactNative = this.detectReactNative();

    // Initialize crypto API based on platform
    if (this.isReactNative || typeof window !== 'undefined') {
      // React Native or browser - use Web Crypto API
      this.crypto =
        typeof globalThis !== 'undefined' ? globalThis.crypto : (window as any)?.crypto;
    } else {
      // Node.js - use crypto module
      try {
        this.crypto = require('crypto');
      } catch {
        this.log('Crypto module not available');
        this.crypto = null;
      }
    }
  }

  /**
   * Verify bundle integrity using SHA-256 checksum
   *
   * @param bundle Bundle metadata with expected checksum
   * @param data Bundle contents (string or Buffer)
   * @returns Integrity check result
   */
  async verify(
    bundle: BundleMetadata,
    data: string | Buffer
  ): Promise<IntegrityCheckResult> {
    try {
      // Validate expected checksum format
      if (!this.isValidSHA256(bundle.checksum)) {
        return {
          valid: false,
          expectedChecksum: bundle.checksum,
          error: 'Expected checksum is not a valid SHA-256 hash',
        };
      }

      // Compute actual checksum
      const actualChecksum = await this.computeSHA256(data);

      // Compare checksums (constant-time to prevent timing attacks)
      const valid = this.constantTimeCompare(
        bundle.checksum.toLowerCase(),
        actualChecksum.toLowerCase()
      );

      if (!valid) {
        this.log('Integrity check failed', {
          expected: bundle.checksum,
          actual: actualChecksum,
          url: bundle.url,
        });
      }

      return {
        valid,
        expectedChecksum: bundle.checksum,
        actualChecksum,
        error: valid ? undefined : 'Checksum mismatch',
      };
    } catch (error) {
      this.log('Integrity verification error:', error);
      return {
        valid: false,
        expectedChecksum: bundle.checksum,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Compute SHA-256 checksum of data
   *
   * @param data String or Buffer to hash
   * @returns Hex-encoded SHA-256 hash
   */
  async computeSHA256(data: string | Buffer): Promise<string> {
    if (this.isReactNative || typeof window !== 'undefined') {
      return this.computeSHA256WebCrypto(data);
    } else {
      return this.computeSHA256Node(data);
    }
  }

  /** Compute SHA-256 using Web Crypto API (React Native / Browser) */
  private async computeSHA256WebCrypto(data: string | Buffer): Promise<string> {
    if (!this.crypto?.subtle) {
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: 'Web Crypto API not available',
      });
    }

    // Convert to Uint8Array
    const encoder = new TextEncoder();
    const dataBytes =
      typeof data === 'string' ? encoder.encode(data) : new Uint8Array(data);

    // Compute hash
    const hashBuffer = await this.crypto.subtle.digest('SHA-256', dataBytes);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }

  /** Compute SHA-256 using Node.js crypto module */
  private computeSHA256Node(data: string | Buffer): string {
    if (!this.crypto?.createHash) {
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: 'Node.js crypto module not available',
      });
    }

    const hash = this.crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }

  /** Validate SHA-256 hash format (64 hex characters) */
  private isValidSHA256(hash: string): boolean {
    return /^[a-f0-9]{64}$/i.test(hash);
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   *
   * @param a First string
   * @param b Second string
   * @returns True if strings are equal
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /** Detect if running in React Native environment */
  private detectReactNative(): boolean {
    try {
      return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
    } catch {
      return false;
    }
  }

  /** Debug logging */
  private log(message: string, data?: any): void {
    if (this.debug) {
      console.log(`[BundleIntegrity] ${message}`, data || '');
    }
  }
}

/**
 * Helper function to verify a bundle's integrity
 *
 * @param bundle Bundle metadata
 * @param data Bundle contents
 * @param debug Enable debug logging
 * @returns Integrity check result
 */
export async function verifyBundleIntegrity(
  bundle: BundleMetadata,
  data: string | Buffer,
  debug = false
): Promise<IntegrityCheckResult> {
  const verifier = new BundleIntegrityVerifier(debug);
  return verifier.verify(bundle, data);
}
