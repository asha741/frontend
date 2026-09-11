import { Component, OnDestroy, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgOtpInputComponent, NgOtpInputConfig } from 'ng-otp-input';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { FocusFirstInputDirective } from '../../../core/services/focusFirstInput.directive';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { MfaSessionService } from '../../../core/services/mfa-session.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { Countdown } from '../../../core/utils/countdown.util';

dayjs.extend(duration);

@Component({
  selector: 'app-otp-verification',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgOtpInputComponent, FocusFirstInputDirective],
  templateUrl: './otp-verification.component.html',
  styleUrl: './otp-verification.component.scss',
})
/**
 * MFA step shown after a login that required a one-time code. Verifies the
 * 6-digit code against the temp token from the login step, supports resending
 * a fresh code, and mirrors the progressive lockout UX used on the login form.
 */
export class OtpVerificationComponent implements OnDestroy {
  isSubmitted = signal(false);
  readonly verifying = signal(false);
  readonly email = signal('');

  /**
   * How long the emailed code stays valid, per the backend's
   * `mfa_expires_in_seconds` (from login, and refreshed on resend). Deadline-
   * based: a tick-counting timer stalls in a backgrounded tab, which would
   * leave this claiming the code is still live minutes after the backend
   * expired it — and with `canResend` still false, no way to get a fresh one.
   */
  readonly mfaWindow = new Countdown();

  readonly countdown = computed(() => {
    const s = this.mfaWindow.seconds();
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  });

  /** Verification failure text, rendered inline — the toaster is off for this call. */
  readonly verifyError = signal('');
  /** Consecutive wrong codes left before the account is locked. */
  readonly attemptsLeft = signal<number | null>(null);
  /** Which step of the progressive lockout schedule the backend applied. */
  readonly lockoutStage = signal<number | null>(null);
  /** Seconds until verification is allowed again; 0 when not blocked. */
  readonly lockout = new Countdown();

  readonly isLocked = computed(() => this.lockout.seconds() > 0);

  /** Countdown for the template — mm:ss, or HH:mm:ss once past an hour. */
  readonly lockoutDisplay = computed(() => {
    const left = this.lockout.seconds();
    const remaining = dayjs.duration(left, 'seconds');
    return left >= 3600 ? remaining.format('HH:mm:ss') : remaining.format('mm:ss');
  });

  // A locked-out user must not be able to pull a fresh code either — that would
  // sidestep the lockout entirely. Once it lifts, resend is the recovery path:
  // the temp token has almost certainly expired by then, and /mfa/resend takes
  // an expired one and issues a new code.
  readonly canResend = computed(() => this.mfaWindow.seconds() === 0 && !this.isLocked());

  /** ng-otp-input configuration — 6 numeric boxes. */
  readonly otpConfig: NgOtpInputConfig = {
    length: 6,
    allowNumbersOnly: true,
    inputMode: 'numeric',
    containerClass: 'ma-otp-container',
    inputClass: 'ma-otp-box',
  };

  readonly form: FormGroup;

  private tempToken = '';

  constructor(
    public fb: FormBuilder,
    public api: ApiService,
    public auth: AuthService,
    public mfaSession: MfaSessionService,
    public router: Router,
  ) {
    // Build service-dependent state in the constructor body (field initializers
    // run before the injected params are assigned).
    this.form = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });

    // No active MFA session — direct navigation or a page refresh wiped the
    // in-memory temp token → restart at login.
    if (!this.mfaSession.isActive) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.tempToken = this.mfaSession.tempToken;
    this.email.set(this.mfaSession.email);
    this.mfaWindow.start(this.mfaSession.mfaExpiresInSeconds);
  }

  ngOnDestroy(): void {
    this.mfaWindow.destroy();
    this.lockout.destroy();
  }

  get f() {
    return this.form.controls;
  }

  /**
   * Verifies the entered 6-digit code against the temp token. On success it
   * clears the MFA session and starts a full authenticated session; on
   * failure it surfaces the error/lockout state inline.
   */
  async onSubmit(): Promise<void> {
    if (this.verifying()) return;
    this.isSubmitted.set(true);
    // Blocked by the lockout countdown — the button is disabled, but a stray
    // Enter key would otherwise still submit.
    if (this.form.invalid || this.isLocked()) return;

    this.verifyError.set('');
    this.verifying.set(true);
    let success = false;
    try {
      // Verifies the OTP against the temp token; unauthenticated call, returns
      // a full access_token (and menu_permissions) on success.
      const resp = await this.api.request(
        'POST',
        API_ROUTES.MFA_VERIFY,
        { temp_token: this.tempToken, code: this.form.value.otp },
        { useToken: false }
      );

      // Handled here rather than by the global toaster, so a lockout can render
      // its countdown inline.
      if (!resp?.status) {
        this.handleFailedVerify(resp);
        return;
      }

      const token = resp.data?.access_token;
      if (!token) {
        this.verifyError.set('Verification failed. Please try again.');
        return;
      }

      success = true;
      this.attemptsLeft.set(null);
      this.lockoutStage.set(null);

      this.mfaWindow.stop();
      this.mfaSession.clear();
      await this.auth.startSession(token, resp.data?.menu_permissions);
      await this.router.navigate([this.auth.perms.landingRoute()]);
    } finally {
      if (!success) {
        this.verifying.set(false);
      }
    }
  }

  /**
   * A rejected code. Beyond the message, a throttled attempt carries
   * `{ retry_after_seconds, attempts_left, stage }` — MFA runs the same
   * progressive lockout schedule as login. It can arrive either as the
   * envelope's `data` or on the error entry, so read both.
   */
  private handleFailedVerify(resp: any): void {
    const body = resp?.data ?? {};
    const errorEntry = (Array.isArray(resp?.error) ? resp.error[0] : resp?.error) ?? {};
    const field = (key: string) => body[key] ?? errorEntry[key];

    const attempts = field('attempts_left');
    const stage = field('stage');
    const retryAfter = Number(field('retry_after_seconds') ?? 0);

    this.verifyError.set(resp?.message || 'Verification failed. Please try again.');
    this.attemptsLeft.set(attempts == null ? null : Number(attempts));
    this.lockoutStage.set(stage == null ? null : Number(stage));

    if (retryAfter > 0) {
      // Counts down to zero, keeping the Verify button disabled.
      this.lockout.start(retryAfter);
    }
  }

  /**
   * Requests a fresh OTP code and temp token when the current code has
   * expired (and the user isn't locked out), then restarts the MFA window.
   */
  async resendOtp(): Promise<void> {
    if (!this.canResend()) return;
    // Issues a new code/temp_token for the same login attempt, replacing the
    // (likely expired) temp token from the initial login call.
    const resp = await this.api.request(
      'POST',
      API_ROUTES.MFA_RESEND,
      { temp_token: this.tempToken },
      { useToken: false }
    );
    if (resp?.status) {
      const fresh = resp.data?.temp_token;
      const freshExpiresInSeconds = resp.data?.mfa_expires_in_seconds;
      if (fresh) {
        this.tempToken = fresh;
        this.mfaSession.refreshToken(fresh, freshExpiresInSeconds);
      }
      this.form.reset({ otp: '' });
      this.isSubmitted.set(false);
      // A fresh code invalidates the previous failure message.
      this.verifyError.set('');
      this.attemptsLeft.set(null);
      this.lockoutStage.set(null);
      this.mfaWindow.start(freshExpiresInSeconds);
    }
  }
}
