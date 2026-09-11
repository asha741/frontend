import { Injectable, computed, signal, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { CryptoService } from './crypto.service';
import { ApiService } from './api.service';
import { MenuPermission, PermissionService } from './permission.service';
import { NotificationService } from './notification.service';
import { API_ROUTES } from '../constants/api-routes';

/** The logged-in user's profile — the single source of truth for the session. */
export interface AuthUser {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  role: string;
  roleName: string;
  roleId: string;
  status: string;
  mfaEnabled: boolean;
  profilePictureKey: string;
  profileImagePath: string;
  /** True for the organization's admin user — gates the Organization Details section on Profile. */
  isOrgAdmin: boolean;
}

/** localStorage keys — both hold AES-GCM ciphertext. */
const TOKEN_KEY = 'accessToken';
const PROFILE_KEY = 'userProfile';

/**
 * Owns the session lifecycle: login/logout, the cached JWT + profile, and the
 * `currentUser` signal the rest of the app reads for identity and role checks.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  /** The logged-in user. Anything that displays the user binds to this signal. */
  readonly currentUser = signal<AuthUser | null>(null);

  readonly userFullName = computed(() => {
    const u = this.currentUser();
    return u ? `${u.firstName} ${u.lastName}`.trim() : '';
  });

  readonly userInitials = computed(() => {
    const u = this.currentUser();
    if (!u) return '';
    return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
  });

  /** Role label for display — shown exactly as the API sends it. */
  readonly userRoleLabel = computed(() => this.currentUser()?.roleName ?? '');

  /** Avatar image URL, or '' when there isn't a usable http(s) URL to show. */
  readonly userAvatarUrl = computed(() => {
    const path = this.currentUser()?.profileImagePath ?? '';
    return /^https?:\/\//i.test(path) ? path : '';
  });

  /** True for the organization's admin user — gates org-level settings across the app. */
  readonly isOrgAdmin = computed(() => this.currentUser()?.isOrgAdmin ?? false);

  constructor(
    public router: Router,
    public crypto: CryptoService,
    public perms: PermissionService,
    public injector: Injector,
  ) {
    // Page refresh: paint from the cached profile instead of blocking on the API.
    if (this.isLoggedIn()) {
      void this.restoreProfile();
      // Deferred: `startPolling` → `fetchUnreadCount` resolves `ApiService`,
      // which itself injects `AuthService`. Resolving that synchronously here
      // would hit it mid-construction (NG0200) — push it past this constructor.
      setTimeout(() => this.injector.get(NotificationService).startPolling());
    }
  }

  /** Whether an access token is cached — does not verify it hasn't expired. */
  isLoggedIn(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Start a session: persist the JWT and the permissions issued with it, then
   * load the profile. The single call made after a direct login (MFA disabled)
   * or a successful MFA verification.
   */
  async startSession(
    accessToken: string,
    menuPermissions?: MenuPermission[] | null,
  ): Promise<AuthUser | null> {
    this.injector.get(ApiService).resetLogoutFlag();
    localStorage.setItem(TOKEN_KEY, await this.crypto.encryptPayload(accessToken));
    await this.perms.setPermissions(menuPermissions);
    this.injector.get(NotificationService).startPolling();
    return this.loadProfile();
  }

  /**
   * The one profile function: fetch `/organization/auth/profile`, cache it
   * (encrypted) in localStorage and publish it to `currentUser`. Call it after
   * login and after ANY profile / avatar change — the header and profile page
   * update themselves, and the cache stays in step for the next refresh.
   */
  async loadProfile(): Promise<AuthUser | null> {
    const api = this.injector.get(ApiService);
    // Fetch the current user's profile; silent (no toaster) since this also
    // runs on every page refresh.
    const resp = await api.request('GET', API_ROUTES.GET_PROFILE, null, { showToaster: false });
    if (!resp?.status || !resp.data) return this.currentUser();

    const d: any = resp.data;
    const user: AuthUser = {
      id: d.id ?? d.user_id ?? '',
      userId: d.admin_id ?? '',
      firstName: d.first_name ?? '',
      lastName: d.last_name ?? '',
      email: d.email ?? '',
      contactNumber: d.contact_number ?? '',
      role: d.role ?? '',
      roleName: d.role_name ?? d.role ?? '',
      roleId: d.role_id ?? '',
      status: d.status ?? '',
      mfaEnabled: d.mfa_enabled ?? false,
      profilePictureKey: d.profile_picture_key ?? '',
      // Display image prefers the ready-to-use URL, falling back to the key.
      profileImagePath: d.profile_picture_url ?? d.profile_picture_key ?? '',
      isOrgAdmin: d.is_org_admin ?? false,
    };

    this.currentUser.set(user);
    localStorage.setItem(PROFILE_KEY, await this.crypto.encryptPayload(user));
    return user;
  }

  /**
   * The current user for non-template callers, restoring the cache first when
   * the signal hasn't been populated yet (e.g. a deep-link straight into a page).
   */
  async getUser(): Promise<AuthUser | null> {
    if (!this.currentUser()) await this.restoreProfile();
    return this.currentUser();
  }

  /** Decrypt the cached profile back into `currentUser` (page refresh). */
  private async restoreProfile(): Promise<void> {
    const cached = await this.crypto.tryDecryptPayload<AuthUser>(localStorage.getItem(PROFILE_KEY));
    if (cached) this.currentUser.set(cached);
  }

  /** Notify the backend to invalidate the session, then clear local state and redirect to login. */
  async logout() {
    try {
      const api = this.injector.get(ApiService);
      // Invalidate the session server-side; local state is cleared regardless below.
      await api.request('POST', API_ROUTES.LOGOUT, {});
    } catch (e) {
      // Ignore errors on logout
    }
    this.logoutWithoutRedirect();
    this.router.navigate(['/auth/login']);
  }

  /** Clear session state (token, profile, permissions, notifications) without navigating away. */
  logoutWithoutRedirect() {
    localStorage.clear();
    this.currentUser.set(null);
    // localStorage.clear() drops the ciphertext; this drops the live signal too.
    this.perms.clear();
    this.injector.get(NotificationService).stopPolling();
  }
}
