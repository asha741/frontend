import { Injectable } from '@angular/core';

/**
 * Holds the short-lived MFA hand-off (the login `temp_token` + email) purely
 * in memory between the login step and the OTP screen.
 *
 * It is deliberately NOT persisted to localStorage/sessionStorage or the router
 * `history.state`: those all survive a hard page refresh, whereas the whole
 * point is that refreshing the OTP page abandons the MFA attempt and sends the
 * user back to login. A `providedIn: 'root'` singleton is recreated empty on
 * every full page load, so an empty `tempToken` reliably means "no active MFA
 * session" (direct navigation or refresh).
 */
@Injectable({ providedIn: 'root' })
export class MfaSessionService {
  tempToken = '';
  email = '';
  /** How long the current code is valid for, in seconds, per the backend. */
  mfaExpiresInSeconds = 0;

  /** Begin an MFA hand-off after a login that returned `requires_mfa`. */
  start(tempToken: string, email: string, mfaExpiresInSeconds: number): void {
    this.tempToken = tempToken;
    this.email = email;
    this.mfaExpiresInSeconds = mfaExpiresInSeconds;
  }

  /** Swap in the fresh temp token + validity window returned by a successful resend. */
  refreshToken(tempToken: string, mfaExpiresInSeconds: number): void {
    this.tempToken = tempToken;
    this.mfaExpiresInSeconds = mfaExpiresInSeconds;
  }

  /** Is there an MFA hand-off in progress (i.e. not a refresh / direct hit)? */
  get isActive(): boolean {
    return !!this.tempToken;
  }

  /** Abandon/complete the MFA hand-off (cancel, success, or logout). */
  clear(): void {
    this.tempToken = '';
    this.email = '';
    this.mfaExpiresInSeconds = 0;
  }
}
