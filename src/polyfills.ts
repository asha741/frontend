/**
 * Polyfills — loaded before the application bootstraps.
 * Referenced from the `polyfills` option of the build target in angular.json.
 */

/** i18n runtime support ($localize). */
import '@angular/localize/init';

/** Zone.js — required by provideZoneChangeDetection() in app.config.ts. */
import 'zone.js';
