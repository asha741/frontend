import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FocusFirstInputDirective } from '../../../core/services/focusFirstInput.directive';
import { CookieService } from 'ngx-cookie-service';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { MfaSessionService } from '../../../core/services/mfa-session.service';
import { ConfigService } from '../../../core/config/config.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { Countdown } from '../../../core/utils/countdown.util';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';

dayjs.extend(duration);

type AdminRole = 'super-admin' | 'admin';

/** Cookie holding the AES-GCM-encrypted remembered credentials. */
const REMEMBER_COOKIE = 'rememberLogin';
/** How long the remembered login is kept, in days. */
const REMEMBER_DAYS = 90;

interface RememberedLogin {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TrimWhitespaceDirective, FocusFirstInputDirective],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
/**
 * Sign-in form shared by the super-admin and organization-admin portals.
 * Handles credential submission, MFA hand-off, progressive lockout display,
 * and the optional "Remember Me" encrypted-cookie autofill.
 */
export class LoginComponent implements OnInit, OnDestroy {
  isSubmitted = signal(false);
  readonly selectedRole = signal<AdminRole>('super-admin');
  readonly showPassword = signal(false);

  /** Sign-in failure text, rendered inline — the toaster is off for this call. */
  readonly loginError = signal('');
  /** Consecutive attempts left before the account is locked for good. */
  readonly attemptsLeft = signal<number | null>(null);
  /** Which step of the progressive lockout schedule the backend applied. */
  readonly lockoutStage = signal<number | null>(null);
  /**
   * Seconds until sign-in is allowed again; 0 when not blocked. Deadline-based,
   * so a backgrounded tab (where timers are throttled to ~1/minute) can't stall
   * the countdown and leave the button disabled past the real lockout.
   */
  readonly lockout = new Countdown();

  readonly isLocked = computed(() => this.lockout.seconds() > 0);

  /** Countdown for the template — mm:ss, or HH:mm:ss once past an hour. */
  readonly lockoutDisplay = computed(() => {
    const left = this.lockout.seconds();
    const remaining = dayjs.duration(left, 'seconds');
    return left >= 3600 ? remaining.format('HH:mm:ss') : remaining.format('mm:ss');
  });

  readonly form: FormGroup;

  constructor(
    public fb: FormBuilder,
    public auth: AuthService,
    public api: ApiService,
    public toast: ToastService,
    public router: Router,
    public cookie: CookieService,
    public crypto: CryptoService,
    public mfaSession: MfaSessionService,
    public config: ConfigService,
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      rememberMe: [false],
    });
    // Default the active tab to whichever portal this build is.
    this.selectedRole.set(this.config.portalRole);
  }

  async ngOnInit(): Promise<void> {
    await this.prefillRememberedLogin();
  }

  ngOnDestroy(): void {
    this.lockout.destroy();
  }

  /** If a remembered login is stored, decrypt it and pre-fill the form. */
  private async prefillRememberedLogin(): Promise<void> {
    const saved = this.cookie.get(REMEMBER_COOKIE);
    if (!saved) return;

    const creds = await this.crypto.tryDecryptPayload<RememberedLogin>(saved);
    if (!creds?.email) {
      // Corrupt / stale (e.g. key rotated) — drop it so we don't keep retrying.
      this.cookie.delete(REMEMBER_COOKIE, '/');
      return;
    }

    this.form.patchValue({
      email: creds.email,
      password: creds.password,
      rememberMe: true,
    });
  }

  /**
   * Handles the super-admin / organization-admin tab toggle. Switching to the
   * portal already loaded just changes the active tab; switching to the other
   * portal navigates away to its separate deployment URL.
   */
  selectRole(role: AdminRole): void {
    // The tab for THIS portal just activates in place; the other tab is a link
    // to the sibling portal, whose URL comes from the environment config.
    if (role === this.config.portalRole) {
      this.selectedRole.set(role);
      return;
    }
    const target =
      role === 'super-admin'
        ? this.config.portalUrls.superAdmin
        : this.config.portalUrls.organizationAdmin;
    if (target) {
      window.location.href = target;
    }
  }

  get f() {
    return this.form.controls;
  }

  /**
   * Authenticates the entered credentials. On success this either routes to
   * OTP verification (MFA enabled) or starts the session directly (MFA
   * disabled); on failure it surfaces the error/lockout state inline.
   */
  async onSubmit(): Promise<void> {
    this.isSubmitted.set(true);
    // Blocked by the lockout countdown — the button is disabled, but a stray
    // Enter key would otherwise still submit.
    if (this.form.invalid || this.isLocked()) {
      return;
    }
    this.loginError.set('');
    const { email, password, rememberMe } = this.form.getRawValue();

    // Persist or clear the remembered credentials before authenticating.
    await this.syncRememberedLogin(rememberMe, email, password);

    // Authenticates against the backend; unauthenticated call since there's no
    // session yet. Response indicates either an MFA challenge or a full token.
    const resp = await this.api.request(
      'POST',
      API_ROUTES.LOGIN,
      { email, password },
      { useToken: false }
    );

    // Handled here rather than by the global toaster, so a lockout can render
    // its countdown inline.
    if (!resp?.status) {
      this.handleFailedLogin(resp);
      return;
    }

    this.attemptsLeft.set(null);
    this.lockoutStage.set(null);

    const data: any = resp.data ?? {};

    // MFA enabled → a 6-digit code was emailed. Hand the short-lived temp token
    // to the OTP screen via an in-memory session (never the URL or history state,
    // both of which survive a refresh) so that refreshing the OTP page abandons
    // the attempt and bounces back to login.
    if (data.requires_mfa) {
      this.mfaSession.start(data.temp_token, email, data.mfa_expires_in_seconds);
      this.router.navigate(['/auth/otp-verification']);
      return;
    }

    // MFA disabled → a full access token is issued immediately.
    if (data.access_token) {
      await this.auth.startSession(data.access_token, data.menu_permissions);
      // The first menu this user can actually open — never a route their
      // permissions would bounce them straight back out of.
      this.router.navigate([this.auth.perms.landingRoute()]);
    }
  }

  /**
   * A rejected sign-in. Beyond the message, a throttled attempt carries
   * `{ retry_after_seconds, attempts_left, stage }` — the progressive lockout
   * the backend applied. It can arrive either as the envelope's `data` or on the
   * error entry, so read both.
   */
  private handleFailedLogin(resp: any): void {
    const body = resp?.data ?? {};
    const errorEntry = (Array.isArray(resp?.error) ? resp.error[0] : resp?.error) ?? {};
    const field = (key: string) => body[key] ?? errorEntry[key];

    const attempts = field('attempts_left');
    const stage = field('stage');
    const retryAfter = Number(field('retry_after_seconds') ?? 0);

    this.loginError.set(resp?.message || 'Sign in failed. Please try again.');
    this.attemptsLeft.set(attempts == null ? null : Number(attempts));
    this.lockoutStage.set(stage == null ? null : Number(stage));

    if (retryAfter > 0) {
      // Counts down to zero, keeping the Sign In button disabled.
      this.lockout.start(retryAfter);
    }
  }

  /**
   * When "Remember Me" is checked, store the (AES-GCM encrypted) credentials in
   * a cookie; when it's unchecked, remove any previously stored login.
   */
  private async syncRememberedLogin(
    rememberMe: boolean | null,
    email: string | null,
    password: string | null
  ): Promise<void> {
    if (rememberMe && email && password) {
      const encrypted = await this.crypto.encryptPayload({ email, password });
      this.cookie.set(
        REMEMBER_COOKIE,
        encrypted,
        REMEMBER_DAYS,
        '/',
        undefined,
        location.protocol === 'https:',
        'Lax'
      );
    } else {
      this.cookie.delete(REMEMBER_COOKIE, '/');
    }
  }
}
