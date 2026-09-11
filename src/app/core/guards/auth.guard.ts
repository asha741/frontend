import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Route guard that blocks access to any protected route unless the user has
 * an active session, redirecting unauthenticated users to the login page.
 */
export const AuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    // Session present → allow navigation to proceed.
    return true;
  } else {
    // No session → send the user to login instead of the requested route.
    router.navigate(['/auth/login']);
    return false;
  }
};
