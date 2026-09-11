import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router} from '@angular/router';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { FilterAndSortingService } from '../../../core/services/common-filter-sort.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoaderService } from '../../../core/services/loader.service';
import { ConfigService } from '../../../core/config/config.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../../core/constants/permissions';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';
import { DeleteConfirmationComponent } from '../../../shared/components/delete-confirmation/delete-confirmation.component';
import { ImportFileModalComponent } from '../../../shared/components/import-file-modal/import-file-modal.component';

/** Formats the backend's `format` param accepts for sample/export files. */
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
 * BHS Matrix master list screen: Kendo grid with server-side paging/sorting/
 * filtering, search, CSV/Excel sample download and export, bulk import, and
 * row edit/delete against the `/organization/masters` endpoints.
 */
@Component({
  selector: 'app-bhs-matrix',
  standalone: true,
  imports: [GridModule, NgbTooltipModule, FormsModule, TrimWhitespaceDirective],
  templateUrl: './bhs-matrix.component.html',
  styleUrl: './bhs-matrix.component.scss',
})
export class BhsMatrixComponent implements OnInit {
  constructor(
    public api: ApiService,
    public filterSort: FilterAndSortingService,
    public router: Router,
    public crypto: CryptoService,
    public modal: NgbModal,
    public toast: ToastService,
    public loader: LoaderService,
    public config: ConfigService,
    public perms: PermissionService,
  ) {}

  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly bhsData = signal<GridDataResult>({ data: [], total: 0 });
  readonly pageSizes = [10, 25, 50];

  /** Guards each split-button action against a second click mid-download. */
  readonly downloadingSample = signal(false);
  readonly exporting = signal(false);

  state: State = {
    skip: 0,
    take: 10,
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  search = '';

  async ngOnInit(): Promise<void> {
    await this.getBhsList();
  }

  /**
   * Fetches the current page of BHS Matrix records from the backend using
   * the current grid state (paging/sort/filter) and search term, then
   * normalizes the various possible response shapes into `GridDataResult`.
   */
  async getBhsList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: { search: this.search?.trim() },
    });

    // Server-side paged/sorted/filtered list of BHS Matrix records.
    const res = await this.api.request('POST', API_ROUTES.GET_MASTERS_LIST, body, {
      showToaster: false,
    });

    if (res?.status) {
      const d = res.data;
      // Response shape varies by endpoint version — fall back across the
      // possible keys rather than assuming one contract.
      const items = d?.items ?? d?.data ?? [];
      const total =
        d?.pagination?.total_records ?? d?.pagination?.totalItems ?? d?.total ?? items.length;
      this.bhsData.set({ data: items, total });
    }
  }

  /** Kendo grid paging/sorting/filtering callback — persists the new state and refetches. */
  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.getBhsList();
  }

  /** Trims the search box, resets to the first page, and refetches. */
  async onSearch(): Promise<void> {
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.getBhsList();
  }

  /** Clears the search term, resets to the first page, and refetches. */
  async clearSearch(): Promise<void> {
    this.search = '';
    this.state = { ...this.state, skip: 0 };
    await this.getBhsList();
  }

  /** Navigates to the edit form for the given row, using an encrypted id in the URL. */
  async editBhs(bhs: any): Promise<void> {
    const encId = await this.crypto.encryptId(String(bhs.id));
    this.router.navigate(['/masters/bhs-form', encId]);
  }

  /** Opens a confirmation modal, then deletes the row and refetches the list if confirmed. */
  deleteBhs(bhs: any): void {
    const ref = this.modal.open(DeleteConfirmationComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });
    ref.componentInstance.message = `Are you sure you want to delete this BHS Matrix record?`;
    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') return;
        // Deletes a single BHS Matrix record by id.
        const res = await this.api.request('DELETE', API_ROUTES.DELETE_MASTERS, { id: bhs.id });
        if (res?.status) await this.getBhsList();
      },
      () => {},
    );
  }

  /**
   * Downloads the BHS Matrix sample file from the backend, honouring the
   * current search term same as export.
   *
   * POST /organization/masters/sample-file  { format, search }
   *
   * The endpoint streams a file rather than the JSON envelope ApiService
   * expects, so it's fetched directly instead of through `api.request` — the
   * same pattern audit-logs export uses. The body is still AES-GCM encrypted
   * and wrapped as `{ data: <cipher> }`, and the bearer token still attached,
   * exactly as ApiService would — only the response handling differs (blob
   * download instead of envelope parsing).
   */
  async downloadSampleFile(format: FileFormat = 'csv'): Promise<void> {
    if (this.downloadingSample()) return;
    this.downloadingSample.set(true);
    this.loader.show();
    try {
      const payload = { format, search: this.search?.trim() || '' };
      const blob = await this.fetchFileBlob(API_ROUTES.DOWNLOAD_MASTERS_SAMPLE, payload);
      if (!blob) {
        this.toast.error('Failed to download sample file.');
        return;
      }
      const { ext } = FILE_FORMAT[format];
      this.triggerDownload(blob, `bhs-matrix-sample.${ext}`);
    } catch {
      this.toast.error('Failed to download sample file.');
    } finally {
      this.loader.hide();
      this.downloadingSample.set(false);
    }
  }

  /**
   * Opens the bulk-import modal for BHS Matrix CSV/XLSX files and wires up
   * grid refreshes for both the success path and the partial-import path
   * (see comments below on each subscription).
   */
  openImportModal(): void {
    const ref = ImportFileModalComponent.open(this.modal, {
      title: 'Import BHS Matrix',
      instructions: 'Drag and drop a BHS Matrix file here, or click to browse.',
      acceptedExtensions: ['csv', 'xlsx'],
      uploadFn: (file) => this.api.uploadFile(API_ROUTES.IMPORT_MASTERS, file, 'file', { showToaster: true }),
    });

    // Refetch as soon as at least one row is created (covers the clean
    // "all rows imported" path, which auto-closes the modal).
    ref.componentInstance.imported.subscribe(async () => {
      await this.refreshAfterImport();
    });

    // Safety net for the partial-import path: the modal stays open to show
    // the created/skipped/error summary, and the grid behind it must reflect
    // the newly created rows by the time the user dismisses it — refetch
    // again on close so a stale grid is never left showing after refresh.
    ref.result.then(
      async () => {
        await this.refreshAfterImport();
      },
      () => {},
    );
  }

  private async refreshAfterImport(): Promise<void> {
    this.state = { ...this.state, skip: 0 };
    await this.getBhsList();
  }

  /**
   * Exports the BHS Matrix list in `format` (CSV or Excel), honouring the
   * current search term.
   *
   * POST /organization/masters/export  { format, search }
   *
   * Same fetch/blob pattern as `downloadSampleFile` — the endpoint streams a
   * file rather than the JSON envelope ApiService expects.
   */
  async exportBhs(format: FileFormat = 'csv'): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.loader.show();
    try {
      const payload = { format, search: this.search?.trim() || '' };
      const blob = await this.fetchFileBlob(API_ROUTES.EXPORT_MASTERS, payload);
      if (!blob) {
        this.toast.error('Failed to export BHS Matrix.');
        return;
      }
      const { ext } = FILE_FORMAT[format];
      this.triggerDownload(blob, `bhs-matrix-export.${ext}`);
    } catch {
      this.toast.error('Failed to export BHS Matrix.');
    } finally {
      this.loader.hide();
      this.exporting.set(false);
    }
  }

  /**
   * POSTs an AES-GCM encrypted body (same shape ApiService sends) directly via
   * `fetch` and returns the response re-typed as a `Blob` under the format's
   * MIME type — a stream can arrive as application/octet-stream, which Excel
   * won't associate with .xlsx on some systems. Returns `null` on a non-2xx
   * response so callers can surface their own error toast.
   */
  private async fetchFileBlob(endpoint: string, payload: { format: FileFormat; search?: string }): Promise<Blob | null> {
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
    return new Blob([await resp.blob()], { type: FILE_FORMAT[payload.format].mime });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
