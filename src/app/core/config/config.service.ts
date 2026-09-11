import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Central, typed access point for build-time environment configuration.
 *
 * Values come from `src/environments/environment.ts` (swapped for
 * `environment.prod.ts` in production builds via `fileReplacements` in
 * angular.json). Inject this service and read these getters instead of
 * importing `environment` directly, so the whole app funnels configuration
 * through a single facade.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  /** True when running a production build. */
  get production(): boolean {
    return environment.production;
  }

  /** Active environment name: 'dev' | 'qa' | 'stage' | 'prod'. */
  get name(): string {
    return environment.name ?? 'dev';
  }

  /** Base URL of the backend API (e.g. https://.../api/v1). */
  get apiUrl(): string {
    return environment.apiUrl ?? '';
  }

  /** AES-GCM key used by CryptoService (must match the backend). */
  get encryptionKey(): string {
    return environment.encryptionKey ?? '';
  }

  /** Default USA country id for dropdowns / lookups. */
  get usaCountryId(): number | string {
    return environment.usaCountryId ?? 0;
  }

  /** Which admin portal this build represents (drives the login role switcher). */
  get portalRole(): 'super-admin' | 'admin' {
    return (environment.portalRole as 'super-admin' | 'admin') ?? 'admin';
  }

  /** Login URLs for each admin portal, used by the login role switcher. */
  get portalUrls(): { superAdmin: string; organizationAdmin: string } {
    return environment.portalUrls ?? { superAdmin: '', organizationAdmin: '' };
  }

  /** Azure Blob Storage account name used by FileUploadService. */
  get azureStorageAccount(): string {
    return environment.azureStorageAccount ?? '';
  }

  /** Azure Blob Storage SAS token (query string, no leading '?'). */
  get azureStorageSasToken(): string {
    return environment.azureStorageSasToken ?? '';
  }

  /** Azure Blob containers per claim document category (each category has its own). */
  get claimDocumentContainers(): { treatmentPlan: string; progressNotes: string; dla20: string } {
    return (
      environment.claimDocumentContainers ?? {
        treatmentPlan: '',
        progressNotes: '',
        dla20: '',
      }
    );
  }

  /** Azure Blob container for profile image uploads. */
  get profileImageContainer(): string {
    return environment.profileImageContainer ?? '';
  }

  /** Azure Blob container for claim batch import files. */
  get claimBatchContainer(): string {
    return environment.claimBatchContainer ?? '';
  }

  /** Azure Blob container for bulk upload documents. */
  get bulkUploadContainer(): string {
    return environment.bulkUploadContainer ?? '';
  }
}
