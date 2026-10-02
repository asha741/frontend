import { MenuType } from './permissions';

/**
 * The sidebar menu, and the single source of truth for which menu a route
 * belongs to. `PermissionService` filters this list for the menu and picks the
 * landing route from it, so a user can never be redirected to a route they
 * can't access.
 *
 * An item is shown when the user holds `Read` on its `menuType`. An item with
 * no `menuType` carries no permission requirement and is always shown.
 */
export interface NavItem {
  label: string;
  icon: string;
  route: string;
  /**
   * The `menuType` id this item (and its route) belongs to. An array means
   * the item is shown if the user holds `Read` on ANY one of them — used by
   * shared pages like Masters (BHS Matrix + CPT to Credential tabs).
   */
  menuType?: MenuType | MenuType[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard.svg', route: '/dashboard', menuType: MenuType.Dashboard },
  { label: 'Team Management', icon: 'user-access.svg', route: '/team-management', menuType: MenuType.User },
  { label: 'Provider Management', icon: 'provider-manage.svg', route: '/provider-management', menuType: MenuType.Provider },
  { label: 'Patient Management', icon: 'patient-manage.svg', route: '/patient-management', menuType: MenuType.Patient },
  { label: 'Claim Analyst', icon: 'claim-analyst.svg', route: '/claim-analyst', menuType: MenuType.Claim },
  { label: 'Bulk Upload', icon: 'total-upload.svg', route: '/bulk-upload', menuType: MenuType.BulkUpload },
  { label: 'Travel Time', icon: 'recent.svg', route: '/travel-time', menuType: MenuType.TravelTime },
  { label: 'Clone Notes', icon: 'master.svg', route: '/clone-notes', menuType: MenuType.CloneNotes },
  // Claim's Data List disabled for now — its routes are commented out in
  // app.routes.ts, so the entry would bounce off the wildcard to /dashboard.
  // Note the menuType: it read MenuType.Claim, which is the Claim Analyst
  // menu, so the item showed for anyone holding Claim read. Claimdata is the
  // menu this page actually belongs to. Re-enable with the routes.
  // { label: "Claim's Data List", icon: 'claim-data.svg', route: '/claim-data-list', menuType: MenuType.Claimdata },
  { label: 'Claim Analytic Upload', icon: 'total-upload.svg', route: '/analytic-upload', menuType: MenuType.AnalyticUpload },
  // One menu, two tabs (Teams & Supervisors / Thresholds) — shown when the user
  // holds Read on either, same as the Masters entry below.
  { label: 'Threshold Configuration', icon: 'report-analytics.svg', route: '/analytic-rules', menuType: [MenuType.AnalyticTeam, MenuType.AnalyticWorkload] },
  { label: 'Reports & Analytics', icon: 'report-analytics.svg', route: '/reports-analytics', menuType: MenuType.Reports },
  { label: 'Audit Logs', icon: 'audit-logs.svg', route: '/audit-logs', menuType: MenuType.Audit },
  // Masters disabled for now — backend hasn't deployed its menu permissions yet.
  // { label: 'Masters', icon: 'claim-data.svg', route: '/masters', menuType: [MenuType.Bhs, MenuType.Cpt] },
  // Settings disabled for now — its route is commented out in app.routes.ts.
  // { label: 'Settings', icon: 'settings.svg', route: '/settings', menuType: MenuType.Settings },
] as const;

/**
 * Where to send a user who has no accessible menu item. Profile carries no
 * permission requirement, so this always resolves.
 */
export const FALLBACK_ROUTE = '/profile';
