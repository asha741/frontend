import { Injectable, computed, signal } from '@angular/core';
import { CryptoService } from './crypto.service';
import { FALLBACK_ROUTE, NAV_ITEMS, NavItem } from '../constants/navigation';
import { MenuType, PERMISSION_ACTION, PermissionAction, PermissionModule } from '../constants/permissions';

/** One granted permission, as issued alongside the access token at login. */
export interface MenuPermission {
  id: string;
  /** The action, e.g. `Create` — half of what `can()` gates on. */
  name: string;
  /** Display-only label (`Provider Management`); never compared against. */
  module: string;
  /** Backend-only (`provider:create`). The UI never reads this. */
  code?: string;
  /** The module's menu id — the other half of what `can()`, routes, and the sidebar key off. */
  menuType: number;
}

/** localStorage key — holds AES-GCM ciphertext, like the token and profile. */
const PERMISSIONS_KEY = 'menuPermissions';

/** Case/space-insensitive, so 'Bulk Upload' and 'BulkUpload' both match. */
const norm = (v: unknown): string => String(v ?? '').replace(/\s+/g, '').toLowerCase();

/**
 * Central authority for the logged-in user's granted permissions. Caches the
 * permission list (encrypted) so it survives a hard refresh, and exposes the
 * `can`/`canAny`/`canAccessMenu` checks that templates, guards, and the
 * sidebar all key off instead of touching `permissions` directly.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  /** The granted permissions. Templates gate on `can()`, not on this directly. */
  readonly permissions = signal<MenuPermission[]>([]);

  /** `menuType::name` keys, for menu, route, and `can()` checks. */
  private readonly byMenuType = computed(
    () => new Set(this.permissions().map((p) => `${p.menuType}::${norm(p.name)}`)),
  );

  /** The sidebar items this user can actually reach. */
  readonly menu = computed<NavItem[]>(() =>
    NAV_ITEMS.filter((i) => i.menuType == null || this.canAccessMenu(i.menuType)),
  );

  /**
   * Memoises the restore so the app initializer and every guard share one
   * decrypt. Set eagerly by `setPermissions` / `clear` to skip a pointless read.
   */
  private loaded: Promise<void> | null = null;

  constructor(public crypto: CryptoService) {}

  /** Persist the permissions issued with the access token. */
  async setPermissions(list: MenuPermission[] | null | undefined): Promise<void> {
    const granted = Array.isArray(list) ? list : [];
    this.permissions.set(granted);
    this.loaded = Promise.resolve();
    localStorage.setItem(PERMISSIONS_KEY, await this.crypto.encryptPayload(granted));
  }

  /**
   * Restore the cached permissions into the signal, once. Decryption is async,
   * so the app initializer awaits this before the first route resolves —
   * otherwise a hard refresh would gate against an empty set.
   */
  ensureLoaded(): Promise<void> {
    this.loaded ??= this.restore();
    return this.loaded;
  }

  /**
   * The check every template uses: was this action granted on this menu?
   *
   *   @if (perms.can(PERMISSION_MODULE.Provider, PERMISSION_ACTION.Create)) { ... }
   *
   * `PERMISSION_MODULE.X` resolves to a `MenuType` id, not a display string —
   * see the comment on `PERMISSION_MODULE` for why. Typed to the constants
   * rather than `string` so that, with strictTemplates, a typo is a build
   * error instead of a silently-false check.
   */
  can(module: PermissionModule, action: PermissionAction): boolean {
    return this.byMenuType().has(`${module}::${norm(action)}`);
  }

  /** True when any one of the actions was granted on the module. */
  canAny(module: PermissionModule, ...actions: PermissionAction[]): boolean {
    return actions.some((a) => this.can(module, a));
  }

  /**
   * True when the user holds `Read` on a menu — what shows it in the sidebar.
   * Accepts an array (e.g. `[MenuType.Bhs, MenuType.Cpt]` for the shared
   * Masters page) and passes when the user holds `Read` on any one of them.
   */
  canAccessMenu(menuType: MenuType | number | (MenuType | number)[]): boolean {
    if (Array.isArray(menuType)) return menuType.some((m) => this.canAccessMenu(m));

    if (this.byMenuType().has(`${menuType}::${norm(PERMISSION_ACTION.Read)}`)) return true;
    // Roles are managed inside the Team Management page, so a user granted only
    // role permissions still needs that menu/route even without User read.
    if (menuType === MenuType.User) {
      return this.permissions().some((p) => p.menuType === MenuType.Role);
    }
    return false;
  }

  /**
   * The first menu item this user can open, for post-login and for bouncing a
   * blocked deep link. Only ever returns a route that passes its own guard.
   */
  landingRoute(): string {
    return this.menu()[0]?.route ?? FALLBACK_ROUTE;
  }

  /** Drop the permissions on logout so the next user can't inherit them. */
  clear(): void {
    this.permissions.set([]);
    this.loaded = Promise.resolve();
    localStorage.removeItem(PERMISSIONS_KEY);
  }

  private async restore(): Promise<void> {
    const cached = await this.crypto.tryDecryptPayload<MenuPermission[]>(
      localStorage.getItem(PERMISSIONS_KEY),
    );
    this.permissions.set(Array.isArray(cached) ? cached : []);
  }
}
