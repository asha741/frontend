/** Normalized shape every {@link ApiService} call resolves to, success or failure. */
export interface ApiResponse<T = any> {
  message: string;
  code: number;
  status: boolean;
  data?: any;
  error?: any;
  [key: string]: any;
}

/** Pagination metadata returned alongside list payloads. */
export interface Pagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** Shape of a decrypted list payload (`ApiResponse.data` for GET_* list routes). */
export interface PaginatedData<T> {
  data: T[];
  pagination: Pagination;
}
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CryptoService } from './crypto.service';
import { ToastService } from './toast.service';
import { LoaderService } from './loader.service';
import { lastValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ConfigService } from '../config/config.service';

/**
 * Central HTTP gateway for the app. Every backend call goes through
 * {@link request} (JSON) or {@link uploadFile} (multipart), which transparently
 * AES-GCM-encrypts outgoing bodies and decrypts incoming envelopes, attaches the
 * bearer token, drives the global loader/toast, and forces a logout on an
 * authenticated 401.
 */
@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl: string = '';
  private isLoggingOut: boolean = false; // Flag to prevent duplicate logout toasts
  apiOptions = {
    showToaster: true,
    showLoader: true,
    useToken: true,
  };

  constructor(
    private http: HttpClient,
    private crypto: CryptoService,
    private loader: LoaderService,
    public toastService: ToastService,
    private authService: AuthService,
    private config: ConfigService
  ) {
    this.baseUrl = this.config.apiUrl;
  }

  /**
   * Reset the logout flag - call this after successful login
   */
  resetLogoutFlag(): void {
    this.isLoggingOut = false;
  }

  /**
   * COMMON API CALLER — the single entry point every service uses to talk to
   * the backend.
   * @param method HTTP verb to use.
   * @param endpoint Path appended to the configured base URL.
   * @param body Request payload; encrypted before it leaves the browser.
   * @param apiOptions Per-call overrides for toaster/loader/token behavior.
   * @returns The decrypted, normalized {@link ApiResponse}. Resolves to `null`
   *   when the call was rejected because the session expired (a redirect to
   *   /login is triggered instead of returning a usable response).
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: any,
    apiOptions: Partial<typeof this.apiOptions> = this.apiOptions
  ): Promise<ApiResponse<T>> {
    const mergedApiOptions = { ...this.apiOptions, ...apiOptions };
    if (mergedApiOptions.showLoader) this.loader.show();
    const url = this.baseUrl + endpoint;

    // Access tokens are stored AES-GCM-encrypted at rest; decrypt before
    // attaching so the backend receives a plain `Bearer <jwt>`.
    let token = '';
    if (mergedApiOptions.useToken) {
      token = (await this.crypto.tryDecryptPayload<string>(localStorage.getItem('accessToken'))) ?? '';
    }
    const headersObj: any = {
      'Content-Type': 'application/json',
      // 'cache-control': 'no-cache',
    };
    if (token) {
      headersObj['Authorization'] = `Bearer ${token}`;
    }
    const headers = new HttpHeaders(headersObj);
    try {
      // Encrypt the outgoing body (AES-GCM) and wrap it as { data: <cipher> }
      // before it leaves the browser. GET carries no body; DELETE may.
      console.log("API Request Url:", url)
      console.log("API Request Body:", body)
      const outgoingBody = body != null ? { data: await this.crypto.encryptPayload(body) } : {};

      let response: any;
      switch (method) {
        case 'GET':
          response = await lastValueFrom(this.http.get(url, { headers }));
          break;
        case 'POST':
          response = await lastValueFrom(this.http.post(url, outgoingBody, { headers }));
          break;
        case 'PUT':
          response = await lastValueFrom(this.http.put(url, outgoingBody, { headers }));
          break;
        case 'PATCH':
          response = await lastValueFrom(this.http.patch(url, outgoingBody, { headers }));
          break;
        case 'DELETE':
          response = await lastValueFrom(
            this.http.delete(url, body != null ? { headers, body: outgoingBody } : { headers })
          );
          break;
        default:
          throw new Error('Invalid Method');
      }

      // The backend AES-GCM-encrypts the *entire* response envelope and ships it
      // as a single `{ data: "<cipher>" }` wrapper. Decrypt it to recover:
      //   { data, error: [{ detail, code }], meta: { success, status, ... }, message }
      const envelope = await this.unwrapEnvelope(response);
      console.log("API Response:", envelope);

      const meta = envelope?.meta;
      const errors = Array.isArray(envelope?.error) ? envelope.error : [];
      const status = typeof meta?.success === 'boolean' ? meta.success : errors.length === 0;

      const result: ApiResponse<T> = {
        message: envelope?.message ?? '',
        code: meta?.status ?? 200,
        status,
        data: envelope?.data ?? null,
        error: errors,
        meta,
      };

      if (mergedApiOptions.showToaster) {
        if (result.status && result.message) {
          this.toastService.success(result.message);
        } else if (!result.status) {
          // Logical failure returned with a 2xx (envelope `success: false`).
          this.toastService.error(this.messageFromEnvelope(envelope) ?? 'Request failed');
        }
      }
      return result;
    } catch (error: any) {
      // HTTP-level failure (non-2xx). The error body is the same encrypted
      // `{ data: "<cipher>" }` envelope, so decrypt it before reading the message.
      const envelope = await this.unwrapEnvelope(error?.error);
      console.error("API Error:", envelope);
      const errorMsg = this.messageFromEnvelope(envelope) ?? this.extractErrorMessage(error);

      // Only force a logout when an *authenticated* request is rejected. Auth
      // endpoints (login / MFA) are called without a token, so a 401 there means
      // bad credentials — surface the message instead of bouncing to /login.
      if (error.status === 401 && mergedApiOptions.useToken) {
        if (!this.isLoggingOut) {
          this.isLoggingOut = true;
          // Always surface the session-expiry reason, even for background
          // requests, so the user understands why they were bounced to /login.
          this.toastService.error(errorMsg);
          this.authService.logout();
        }
        return null as any;
      }

      // Callers that pass `showToaster: false` render the failure themselves
      // (login shows the lockout countdown inline), so stay quiet for them.
      // if (mergedApiOptions.showToaster) 
      this.toastService.error(errorMsg);

      return {
        message: errorMsg,
        code: error.status,
        status: false,
        data: envelope?.data ?? null,
        error: Array.isArray(envelope?.error) ? envelope.error : error.error,
        meta: envelope?.meta,
      };
    } finally {
      if (mergedApiOptions.showLoader) this.loader.hide();
    }
  }

  /**
   * MULTIPART FILE UPLOAD
   * Bypasses the JSON encrypt/decrypt path used by `request()` — a binary file
   * body can't be AES-GCM-encrypted as JSON, so this posts a raw
   * `multipart/form-data` body instead, still attaching the bearer token.
   */
  async uploadFile<T>(
    endpoint: string,
    file: File,
    fieldName: string = 'file',
    apiOptions: Partial<typeof this.apiOptions> = this.apiOptions
  ): Promise<ApiResponse<T>> {
    const mergedApiOptions = { ...this.apiOptions, ...apiOptions };
    if (mergedApiOptions.showLoader) this.loader.show();
    const url = this.baseUrl + endpoint;

    let token = '';
    if (mergedApiOptions.useToken) {
      token = (await this.crypto.tryDecryptPayload<string>(localStorage.getItem('accessToken'))) ?? '';
    }
    const headersObj: any = {};
    if (token) headersObj['Authorization'] = `Bearer ${token}`;
    const headers = new HttpHeaders(headersObj);

    const formData = new FormData();
    formData.append(fieldName, file);

    try {
      console.log("API Request Url:", url)
      console.log("API Request File:", file.name, file.size, file.type)
      const response: any = await lastValueFrom(this.http.post(url, formData, { headers }));
      const envelope = await this.unwrapEnvelope(response);
      console.log("API Response:", envelope);

      const meta = envelope?.meta;
      const errors = Array.isArray(envelope?.error) ? envelope.error : [];
      const status = typeof meta?.success === 'boolean' ? meta.success : errors.length === 0;

      const result: ApiResponse<T> = {
        message: envelope?.message ?? '',
        code: meta?.status ?? 200,
        status,
        data: envelope?.data ?? null,
        error: errors,
        meta,
      };

      if (mergedApiOptions.showToaster) {
        if (result.status && result.message) {
          this.toastService.success(result.message);
        } else if (!result.status) {
          this.toastService.error(this.messageFromEnvelope(envelope) ?? 'Import failed');
        }
      }
      return result;
    } catch (error: any) {
      const envelope = await this.unwrapEnvelope(error?.error);
      console.error("API Error:", envelope);
      const errorMsg = this.messageFromEnvelope(envelope) ?? this.extractErrorMessage(error);

      if (error.status === 401 && mergedApiOptions.useToken) {
        if (!this.isLoggingOut) {
          this.isLoggingOut = true;
          this.toastService.error(errorMsg);
          this.authService.logout();
        }
        return null as any;
      }

      this.toastService.error(errorMsg);
      return {
        message: errorMsg,
        code: error.status,
        status: false,
        data: envelope?.data ?? null,
        error: Array.isArray(envelope?.error) ? envelope.error : error.error,
        meta: envelope?.meta,
      };
    } finally {
      if (mergedApiOptions.showLoader) this.loader.hide();
    }
  }

  /**
   * Unwrap the transport envelope. Responses arrive as `{ data: "<cipher>" }`
   * with the whole envelope AES-GCM-encrypted inside; decrypt it back to
   * `{ data, error, meta, message }`. Bodies that aren't an encrypted wrapper
   * (dev/health responses, network errors) are returned unchanged.
   */
  private async unwrapEnvelope(body: any): Promise<any> {
    if (body && typeof body.data === 'string') {
      const decrypted = await this.crypto.tryDecryptPayload<any>(body.data);
      if (decrypted !== null) return decrypted;
    }
    return body ?? {};
  }

  /** Pull the display message out of a decrypted response envelope. */
  private messageFromEnvelope(envelope: any): string | null {
    if (Array.isArray(envelope?.error) && envelope.error[0]?.detail) return envelope.error[0].detail;
    if (typeof envelope?.message === 'string' && envelope.message) return envelope.message;
    return null;
  }

  /** Pull a human-readable message out of the backend's error envelope. */
  private extractErrorMessage(error: any): string {
    const body = error?.error;
    if (body) {
      if (typeof body === 'string') return body;
      if (typeof body.message === 'string' && body.message) return body.message;
      if (Array.isArray(body.error) && body.error[0]?.detail) return body.error[0].detail;
      if (typeof body.detail === 'string') return body.detail;
      if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
    }
    return error?.message || 'Request failed';
  }
}
