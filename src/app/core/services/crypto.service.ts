import { Injectable } from '@angular/core';
import { ConfigService } from '../config/config.service';

/**
 * Client-side AES-GCM encryption used to protect data at rest in `localStorage`
 * (tokens, cached profile) and in transit (request/response envelopes), plus
 * a URL-safe variant for encrypting route params/ids.
 */
@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  public pubKey: string = '';
  public saltKey: string = '';

  constructor(private config: ConfigService) {
  }

  // =====================================================================
  // 🔵 URL PARAMETER ENCRYPT / DECRYPT
  // =====================================================================

  /**
   * Encrypt a value (e.g. a record id) for safe use inside a URL path/query.
   * Standard base64 `+ / =` characters are swapped for URL-safe substitutes
   * (`=` uses a distinctive token rather than being dropped, since `decryptId`
   * needs to restore it unambiguously).
   */
  async encryptId(value: string) {
    let encrypted = await this.encryptPayload(value);
    return encrypted.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, 'e4Q3u2A1l');
  }

  /** Inverse of {@link encryptId} — restores the standard base64 alphabet then decrypts. */
  async decryptId(value: string) {
    let str = value
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/e4Q3u2A1l/g, '=');
    return await this.decryptPayload(str) as string;
  }

  // =====================================================================
  // 🔵 AES-GCM PAYLOAD ENCRYPT / DECRYPT (Web Crypto API)
  // =====================================================================
  // Uses Web Crypto API for browser-native security.
  // For production, replace the key derivation with a proper KMS-managed key.

  // NOTE: `crypto` in this file is the crypto-js import; use the Web Crypto
  // global (`webCrypto`) for the AES-GCM primitives below.
  private readonly webCrypto = globalThis.crypto;

  /** Derive the shared AES-GCM {@link CryptoKey} from the configured base64 key. */
  private async getGcmKey(): Promise<CryptoKey> {
    // The key is (URL-safe) base64 encoding 32 raw bytes — decode it to bytes,
    // do NOT TextEncode the string. Must match the backend's key handling.
    const b64 = this.config.encryptionKey.replace(/-/g, '+').replace(/_/g, '/');
    const keyBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return this.webCrypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }

  /**
   * Encrypt any JSON-serializable value with AES-GCM.
   * @param data Value to encrypt (JSON.stringify'd before encryption).
   * @returns URL-safe, unpadded base64 of `iv || ciphertext`.
   */
  async encryptPayload(data: unknown): Promise<string> {
    const key = await this.getGcmKey();
    const iv = this.webCrypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = await this.webCrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    // URL-safe base64, no padding — matches the backend token format.
    return btoa(String.fromCharCode(...combined))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Decrypt a string produced by {@link encryptPayload}.
   * @param ciphertext URL-safe base64 of `iv || ciphertext`.
   * @throws if the input isn't valid base64 or doesn't decrypt/parse.
   */
  async decryptPayload<T>(ciphertext: string): Promise<T> {
    const key = await this.getGcmKey();
    // Accept URL-safe base64 and restore padding before decoding.
    let b64 = ciphertext.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await this.webCrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  }

  /**
   * Decrypt without throwing. Returns `null` when the input is empty, not valid
   * base64, or wasn't encrypted with this key (e.g. stale data from a previous
   * scheme, or a plaintext response). Mirrors the old doubleDecrypt's tolerance.
   */
  async tryDecryptPayload<T>(ciphertext: string | null | undefined): Promise<T | null> {
    if (!ciphertext) return null;
    try {
      return await this.decryptPayload<T>(ciphertext);
    } catch {
      return null;
    }
  }
}
