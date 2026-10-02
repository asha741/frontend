/**
 * Permission vocabulary, as issued with the access token at login
 * (`menu_permissions` on the login / MFA-verify response).
 *
 * A granted permission is identified by its `menuType` + `name` pair (e.g.
 * Provider's menuType 6 + Create). The backend's `module` field is a
 * free-text display label ("Provider Management", "Team Management User",
 * "Claim Analytic Upload"…) that doesn't reliably match across endpoints —
 * see the `AnalyticUpload` note below for a case that already broke — so it
 * is never compared against. `menuType` is the numeric, verified-stable id.
 * The backend's `code` field (`provider:create`) is deliberately NOT used
 * here either — it exists for the backend's own checks.
 */

/** `menuType` ids — the module a permission belongs to. */
export enum MenuType {
  Dashboard = 1,
  User = 2,
  Role = 3,
  Claim = 4,
  Patient = 5,
  Provider = 6,
  Audit = 7,
  Claimdata = 8,
  Reports = 9,
  Settings = 10,
  BulkUpload = 11,
  TravelTime = 12,
  // 13 was assumed when this was written (the Clone Notes API docs don't name
  // its menuType); the live permission payload does issue 13, so it is right.
  CloneNotes = 13,
  // Power BI analytics. These three ids are issued by the backend (seen on the
  // login permission payload), so they are NOT assumed like CloneNotes above.
  AnalyticUpload = 14,
  AnalyticTeam = 15,
  AnalyticWorkload = 16,
  // Masters (BHS Matrix / CPT to Credential) is disabled for now — the
  // backend's menu map doesn't issue these ids. Parked at 90/91 (well clear of
  // anything the backend issues) only so the still-present masters components
  // keep compiling while their nav entry/routes stay commented out. They
  // previously sat on 14/15, which the Analytic menus above now really use.
  Bhs = 90,
  Cpt = 91,
}

/**
 * `PERMISSION_MODULE.X` is the value every `can()`/`canAny()` call site
 * passes as the "module" to check. It resolves straight to the matching
 * `MenuType` id rather than a display string — the backend's `module` text
 * ("Provider Management", "Claim Analyst", "Claim Analytic Upload"…) is a
 * free-text label that has drifted from what a check needs before (see the
 * git history on this file for the 'Analytic Upload' vs 'Claim Analytic
 * Upload' incident) and isn't trustworthy to match against. `menuType` is
 * the numeric id issued consistently everywhere, so keying on it instead
 * makes that whole class of mismatch impossible.
 */
export const PERMISSION_MODULE = {
  Dashboard: MenuType.Dashboard,
  User: MenuType.User,
  Role: MenuType.Role,
  Claim: MenuType.Claim,
  Patient: MenuType.Patient,
  Provider: MenuType.Provider,
  Audit: MenuType.Audit,
  Bhs: MenuType.Bhs,
  Cpt: MenuType.Cpt,
  Claimdata: MenuType.Claimdata,
  Reports: MenuType.Reports,
  Settings: MenuType.Settings,
  BulkUpload: MenuType.BulkUpload,
  TravelTime: MenuType.TravelTime,
  CloneNotes: MenuType.CloneNotes,
  AnalyticUpload: MenuType.AnalyticUpload,
  AnalyticTeam: MenuType.AnalyticTeam,
  AnalyticWorkload: MenuType.AnalyticWorkload,
} as const;

/** `name` values — the action within a module. */
export const PERMISSION_ACTION = {
  Create: 'Create',
  Read: 'Read',
  Update: 'Update',
  Delete: 'Delete',
  Invite: 'Invite',
  Unlock: 'Unlock',
  Export: 'Export',
  Verify: 'Verify',
} as const;

export type PermissionModule = (typeof PERMISSION_MODULE)[keyof typeof PERMISSION_MODULE];
export type PermissionAction = (typeof PERMISSION_ACTION)[keyof typeof PERMISSION_ACTION];
