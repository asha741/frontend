import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { PermissionService } from '../services/permission.service';
import { MenuType } from '../constants/permissions';

/**
 * Blocks a route whose `data.menuType` the user holds no `Read` on, and bounces
 * to their landing route. Runs after `AuthGuard`, so the session is already
 * established here.
 */
export const PermissionGuard: CanActivateFn = async (route) => {
  const perms = inject(PermissionService);
  const router = inject(Router);

  // A hard refresh hits this before the initializer's decrypt settles.
  await perms.ensureLoaded();

  const menuType = route.data['menuType'] as MenuType | MenuType[] | undefined;
  if (menuType == null || perms.canAccessMenu(menuType)) return true;

  return router.createUrlTree([perms.landingRoute()]);
};
