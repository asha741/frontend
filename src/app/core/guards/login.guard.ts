import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Route guard for the public auth pages (login, accept-invitation,
 * reset-password). Keeps an already-authenticated user off the login page by
 * redirecting to the dashboard, except for deep links that must be usable
 * while logged out.
 */
export const LoginGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    // An emailed deep link (invitation / password reset) outranks the active
    // session: drop the session and let the link's page load logged-out,
    // instead of bouncing to the dashboard.
    if (state.url.includes('/auth/accept-invitation') || state.url.includes('/auth/reset-password')) {
      auth.logoutWithoutRedirect();
      return true;
    }
    // User already logged in → redirect to dashboard
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
