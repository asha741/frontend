import { TestBed } from '@angular/core/testing';

import { PermissionService } from './permission.service';
import { MenuType, PERMISSION_ACTION, PERMISSION_MODULE } from '../constants/permissions';

/** Builds one granted permission, the shape the login response issues. */
const grant = (menuType: MenuType, module: string, name: string) => ({
  id: `${menuType}-${name}`,
  name,
  module,
  menuType,
});

describe('PermissionService', () => {
  let perms: PermissionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    perms = TestBed.inject(PermissionService);
  });

  describe('menu', () => {
    it('renders only the items whose menuType the user holds Read on', () => {
      perms.permissions.set([
        grant(MenuType.Dashboard, PERMISSION_MODULE.Dashboard, PERMISSION_ACTION.Read),
        grant(MenuType.Provider, PERMISSION_MODULE.Provider, PERMISSION_ACTION.Read),
      ]);

      expect(perms.menu().map((i) => i.label)).toEqual(['Dashboard', 'Provider Management']);
    });

    it('renders nothing when no permission was granted', () => {
      perms.permissions.set([]);

      expect(perms.menu()).toEqual([]);
    });

    it('does not render a menu the user only holds a non-Read action on', () => {
      perms.permissions.set([
        grant(MenuType.Patient, PERMISSION_MODULE.Patient, PERMISSION_ACTION.Export),
      ]);

      expect(perms.menu()).toEqual([]);
    });

    it('keeps each menu to its own menuType — Claim read does not unlock others', () => {
      perms.permissions.set([
        grant(MenuType.Claim, PERMISSION_MODULE.Claim, PERMISSION_ACTION.Read),
      ]);

      expect(perms.menu().map((i) => i.label)).toEqual(['Claim Analyst']);
    });

    it('shows a multi-menu item when Read is held on either of its menuTypes', () => {
      perms.permissions.set([
        grant(MenuType.AnalyticWorkload, PERMISSION_MODULE.AnalyticWorkload, PERMISSION_ACTION.Read),
      ]);

      expect(perms.menu().map((i) => i.label)).toEqual(['Threshold Configuration']);
    });

    it('shows Team Management to a user granted only role permissions', () => {
      perms.permissions.set([
        grant(MenuType.Role, PERMISSION_MODULE.Role, PERMISSION_ACTION.Update),
      ]);

      expect(perms.menu().map((i) => i.label)).toEqual(['Team Management']);
    });
  });

  describe('landingRoute', () => {
    it('is the first menu the user can actually open', () => {
      perms.permissions.set([
        grant(MenuType.Audit, PERMISSION_MODULE.Audit, PERMISSION_ACTION.Read),
      ]);

      expect(perms.landingRoute()).toBe('/audit-logs');
    });

    it('falls back to the permission-free route when no menu is reachable', () => {
      perms.permissions.set([]);

      expect(perms.landingRoute()).toBe('/profile');
    });
  });

  describe('can', () => {
    it('matches the module names the backend issues, spaces and all', () => {
      // The backend issues 'Analytic Upload' for the menu labelled 'Claim
      // Analytic Upload' — the two must not be conflated again.
      perms.permissions.set([
        grant(MenuType.AnalyticUpload, 'Analytic Upload', PERMISSION_ACTION.Create),
        grant(MenuType.BulkUpload, 'Bulk Upload', PERMISSION_ACTION.Create),
      ]);

      expect(perms.can(PERMISSION_MODULE.AnalyticUpload, PERMISSION_ACTION.Create)).toBe(true);
      expect(perms.can(PERMISSION_MODULE.BulkUpload, PERMISSION_ACTION.Create)).toBe(true);
      expect(perms.can(PERMISSION_MODULE.AnalyticUpload, PERMISSION_ACTION.Delete)).toBe(false);
    });
  });
});
