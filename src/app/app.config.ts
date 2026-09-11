import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
  withViewTransitions,
} from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { NgbDateParserFormatter, NgbTooltipConfig } from '@ng-bootstrap/ng-bootstrap';

import { routes } from './app.routes';
import { PermissionService } from './core/services/permission.service';
import { NgbDateMMDDYYYYParserFormatter } from './core/utils/ngb-date-mmddyyyy.formatter';

/**
 * Token attachment, request encryption and 401 handling now live in `ApiService`
 * (matching the reference app's structure), so no HTTP interceptor is registered.
 * Runtime settings come from `src/environments/environment.ts` (compiled in).
 *
 * Root DI configuration bootstrapped via `bootstrapApplication`. Wires up the
 * router, HTTP client, animations, and app-wide overrides for ng-bootstrap
 * tooltip/date-parsing behavior.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withComponentInputBinding(),
      withViewTransitions(),
      // Without this, navigating (e.g. list -> edit) keeps whatever scroll
      // position the previous page was left at, so a form scrolled down to
      // find a row opens partway down the next page instead of at the top.
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    // Enables HttpClient (used app-wide, e.g. by ApiService, for all backend calls).
    provideHttpClient(),
    // Enables Angular animations, required by ng-bootstrap components (tooltips, modals, etc.).
    provideAnimations(),
    // Decrypt the cached permissions before the first route resolves, so a hard
    // refresh doesn't gate the sidebar and guards against an empty set.
    provideAppInitializer(() => inject(PermissionService).ensureLoaded()),
    {
      // Drops the default 'focus' trigger app-wide. A modal restores focus to the
      // button that opened it, which would otherwise re-open that button's tooltip
      // with no pointer over it to dismiss it. Icon-only buttons need an aria-label
      // to stay accessible, since the tooltip no longer shows on keyboard focus.
      provide: NgbTooltipConfig,
      useFactory: () => Object.assign(new NgbTooltipConfig(), { triggers: 'hover' }),
    },
    // App-wide: every ngbDatepicker input displays/parses as MM-DD-YYYY.
    { provide: NgbDateParserFormatter, useClass: NgbDateMMDDYYYYParserFormatter },
  ],
};
