import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { Router, RouterLink } from '@angular/router';
import { NgbModal, NgbTooltipModule, NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../core/services/api.service';
import { toISOStartOfDay, toISOEndOfDay } from '../../core/utils/date.util';
import { ToastService } from '../../core/services/toast.service';
import { LoaderService } from '../../core/services/loader.service';
import { ConfigService } from '../../core/config/config.service';
import { CryptoService } from '../../core/services/crypto.service';
import { PermissionService } from '../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../core/constants/permissions';
import { API_ROUTES } from '../../core/constants/api-routes';
import { FilterAndSortingService } from '../../core/services/common-filter-sort.service';
import { TrimWhitespaceDirective } from '../../shared/directives/trim-whitespace.directive';
import { UsPhonePipe } from '../../shared/pipes/us-phone.pipe';
import { DeleteConfirmationComponent } from '../../shared/components/delete-confirmation/delete-confirmation.component';
import { ImportFileModalComponent } from '../../shared/components/import-file-modal/import-file-modal.component';
import { BadgeClassPipe } from '../../shared/pipes/badge-class.pipe';

/** Formats the backend's `format` param accepts for export files. */
type FileFormat = 'csv' | 'xlsx';

/** Filename extension + MIME type to save each format under. */
const FILE_FORMAT: Record<FileFormat, { ext: string; mime: string }> = {
  csv: { ext: 'csv', mime: 'text/csv' },
  xlsx: {
    ext: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
};

/**
 * Provider Management list/grid page: search, filter, paginate providers,
 * plus edit/delete, import, export and sample-file download actions.
 */
@Component({
  selector: 'app-provider-management',
  standalone: true,
  imports: [BadgeClassPipe, GridModule, NgbTooltipModule, NgbDatepickerModule, FormsModule, DatePipe, RouterLink, UsPhonePipe, TrimWhitespaceDirective],
  templateUrl: './provider-management.html',
  styleUrl: './provider-management.scss',
})
export class ProviderManagement implements OnInit {
  constructor(
    public api: ApiService,
    public filterSort: FilterAndSortingService,
    public router: Router,
    public modal: NgbModal,
    public crypto: CryptoService,
    public perms: PermissionService,
    public loader: LoaderService,
    public config: ConfigService,
    private toast: ToastService,
  ) {}

  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly providersData = signal<GridDataResult>({ data: [], total: 0 });
  readonly pageSizes = [10, 25, 50];

  /** Guards each split-button action against a second click mid-download. */
  readonly exporting = signal(false);
  readonly downloadingSample = signal(false);

  state: State = {
    skip: 0,
    take: 10,
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  search = '';
  fromDate: NgbDateStruct | null = null;
  toDate: NgbDateStruct | null = null;

  // ── Graph / cards / Provider Information were removed from the template;
  //    their supporting state is intentionally gone. ─────────────────────

  async ngOnInit(): Promise<void> {
    await this.getProviderList();
  }

  /**
   * Fetches the current page of providers using the grid state (paging/sort/filter)
   * plus the search text and created-date range, and populates `providersData`.
   */
  async getProviderList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        search: this.search?.trim(),
        created_date_from: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        created_date_to: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      },
      valueMap: {
        status: (v: any) => (v === true ? 'Active' : v === false ? 'Inactive' : null),
      },
    });

    // Paginated/filtered/sorted provider list.
    const res = await this.api.request('POST', API_ROUTES.GET_PROVIDERS, body, {
      showToaster: false,
    });

    if (res?.status) {
      const d = res.data;
      // Defensive: backend list envelopes vary (`items`/`data`, `total_records`/`totalItems`).
      const items = d?.items ?? d?.data ?? [];
      const total =
        d?.pagination?.total_records ?? d?.pagination?.totalItems ?? d?.total ?? items.length;
      this.providersData.set({ data: items, total });
    }
  }

  /** Kendo grid page/sort/filter change handler — refetches the list for the new state. */
  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.getProviderList();
  }

  /** Applies the search box + date range filter, resetting to the first page. */
  async onSearch(): Promise<void> {
    if (this.fromDate && this.toDate && this.toDateStr(this.fromDate) > this.toDateStr(this.toDate)) {
      this.toast.warning('"From" date cannot be after "To" date.');
      return;
    }
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.getProviderList();
  }

  /** Resets search text and date filters, then reloads the first page. */
  async clearSearch(): Promise<void> {
    this.search = '';
    this.fromDate = null;
    this.toDate = null;
    this.state = { ...this.state, skip: 0 };
    await this.getProviderList();
  }

  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }

  /** Opens the bulk provider import modal (CSV/XLSX) and refreshes the list once a file is imported. */
  openImportModal(): void {
    const ref = ImportFileModalComponent.open(this.modal, {
      title: 'Import Providers',
      instructions: 'Drag and drop a provider file here, or click to browse.',
      acceptedExtensions: ['csv', 'xlsx'],
      // Uploads the provider import file for bulk create/update.
      uploadFn: (file) => this.api.uploadFile(API_ROUTES.IMPORT_PROVIDERS, file, 'file', { showToaster: true }),
    });
    ref.componentInstance.imported.subscribe(async () => {
      this.state = { ...this.state, skip: 0 };
      await this.getProviderList();
    });
  }

  /** Full name for a provider row, tolerant of snake / camel field names. */
  providerName(row: any): string {
    const first = row?.first_name ?? row?.firstName ?? '';
    const last = row?.last_name ?? row?.lastName ?? '';
    return `${first} ${last}`.trim() || (row?.name ?? '-');
  }

  /** Comma-joined display string for a provider's license(s), which the API may return as an array or a single value. */
  licenseDisplay(row: any): string {
    const license = row?.license;
    return Array.isArray(license) ? license.join(', ') : (license ?? '');
  }

  /**
   * Edit Provider — `ProviderForm` fetches the provider by id itself via
   * `GET_PROVIDER_BY_ID`. The `:id` route param is AES-GCM encrypted so the
   * raw provider id is never exposed in the URL.
   */
  async editProvider(row: any): Promise<void> {
    const encId = await this.crypto.encryptId(String(row?.id));
    this.router.navigate(['/provider-management/edit-provider', encId]);
  }

  

  /** Provider Patients — encrypts the id before it lands in the URL. */
  async viewProviderPatients(row: any): Promise<void> {
    const encId = await this.crypto.encryptId(String(row?.id));
    this.router.navigate(['/provider-management', encId, 'patients']);
  }

  /** Opens a confirmation modal and, if confirmed, deletes the provider and refreshes the list. */
  deleteProvider(row: any): void {
    const id = row?.id;
    const ref = this.modal.open(DeleteConfirmationComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });
    ref.componentInstance.message = `Are you sure you want to delete this provider?`;
    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') return;
        // Deletes the provider record by id.
        const res = await this.api.request('DELETE', API_ROUTES.DELETE_PROVIDER, { id });
        if (res?.status) {
          await this.getProviderList();
        }
      },
      // Modal dismissed (cancel/backdrop) — nothing to do.
      () => {},
    );
  }

  /**
   * Exports the provider list (CSV or Excel), honouring the current search
   * and date-range filters. Same fetch/blob pattern as the BHS Matrix export —
   * the endpoint streams a file rather than the JSON envelope `ApiService`
   * expects, so it's fetched directly instead of through `api.request`.
   */
  async exportProviders(format: FileFormat = 'csv'): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.loader.show();
    try {
      const payload = {
        format,
        search: this.search?.trim() || '',
        created_date_from: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        created_date_to: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      };
      // Streams the filtered provider list as a CSV/XLSX file.
      const blob = await this.fetchFileBlob(API_ROUTES.EXPORT_PROVIDERS, payload);
      if (!blob) {
        this.toast.error('Failed to export providers.');
        return;
      }
      const { ext } = FILE_FORMAT[format];
      this.triggerDownload(blob, `providers-export.${ext}`);
    } catch {
      this.toast.error('Failed to export providers.');
    } finally {
      this.loader.hide();
      this.exporting.set(false);
    }
  }

  /**
   * Downloads the provider import sample file from the backend.
   *
   * POST /organization/providers/sample-file  { format }
   *
   * Same fetch/blob pattern as `exportProviders` / BHS Matrix's
   * `downloadSampleFile` — the endpoint streams a file rather than the JSON
   * envelope `ApiService` expects, so it's fetched directly instead of
   * through `api.request`.
   */
  async downloadSampleFile(format: FileFormat = 'csv'): Promise<void> {
    if (this.downloadingSample()) return;
    this.downloadingSample.set(true);
    this.loader.show();
    try {
      const blob = await this.fetchFileBlob(API_ROUTES.DOWNLOAD_PROVIDERS_SAMPLE, { format }); // sample file for the import template
      if (!blob) {
        this.toast.error('Failed to download sample file.');
        return;
      }
      const { ext } = FILE_FORMAT[format];
      this.triggerDownload(blob, `providers-sample.${ext}`);
    } catch {
      this.toast.error('Failed to download sample file.');
    } finally {
      this.loader.hide();
      this.downloadingSample.set(false);
    }
  }

  /**
   * Raw `fetch` POST used for file-streaming endpoints that `ApiService`
   * can't handle (it expects a JSON envelope response, not a file blob).
   * Manually attaches the bearer token and encrypts the payload the same
   * way `ApiService` would, then re-wraps the response with the correct MIME type.
   * @returns the downloaded file as a Blob, or null on a non-OK response.
   */
  private async fetchFileBlob(endpoint: string, payload: Record<string, any>): Promise<Blob | null> {
    const url = this.config.apiUrl + endpoint;
    const token = (await this.crypto.tryDecryptPayload<string>(localStorage.getItem('accessToken'))) ?? '';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ data: await this.crypto.encryptPayload(payload) }),
    });
    if (!resp.ok) return null;
    return new Blob([await resp.blob()], { type: FILE_FORMAT[payload['format'] as FileFormat].mime });
  }

  /** Triggers a browser "Save As" for `blob` via a temporary anchor element, then revokes the object URL. */
  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
