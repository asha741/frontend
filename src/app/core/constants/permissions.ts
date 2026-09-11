/**
 * Permission vocabulary, as issued with the access token at login
 * (`menu_permissions` on the login / MFA-verify response).
 *
 * A granted permission is identified by its `module` + `name` pair (e.g.
 * Provider + Create), and its menu is identified by the `menuType` id.
 * The backend's `code` field (`provider:create`) is deliberately NOT used
 * here — it exists for the backend's own checks.
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
  // Masters (BHS Matrix / CPT to Credential) is disabled for now — the
  // backend's menu map doesn't issue these ids. Kept (renumbered out of the
  // way, past TravelTime) only so the still-present masters components keep
  // compiling while their nav entry/routes are commented out below.
  Bhs = 14,
  Cpt = 15,
}

/** `module` values. */
export const PERMISSION_MODULE = {
  Dashboard: 'Dashboard',
  User: 'User',
  Role: 'Role',
  Claim: 'Claim',
  Patient: 'Patient',
  Provider: 'Provider',
  Audit: 'Audit',
  Bhs: 'Bhs',
  Cpt: 'Cpt',
  Claimdata: 'Claimdata',
  Reports: 'Reports',
  Settings: 'Settings',
  BulkUpload: 'BulkUpload',
  TravelTime: 'TravelTime',
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
