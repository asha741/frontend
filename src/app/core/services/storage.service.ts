import { Injectable } from '@angular/core';

/**
 * Thin, JSON-aware wrapper around `localStorage`. Centralizes the
 * serialize/deserialize + error handling so callers never touch the raw
 * Web Storage API directly.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  /**
   * Reads and JSON-parses a stored value.
   * @returns The parsed value, or `null` if the key is missing or the
   * stored JSON is malformed (parse errors are swallowed, not thrown).
   */
  get<T>(key: string): T | null {
    try {
      const value = localStorage.getItem(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  }

  set(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }

  clear(): void {
    localStorage.clear();
  }

  has(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }
}
