import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/**
 * Runtime settings (apiUrl + encryption keys) are compiled in from
 * `src/environments/environment.ts` (swapped for `environment.prod.ts` in prod
 * builds via `fileReplacements` in angular.json), so no runtime config fetch is
 * needed before bootstrap.
 */
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
