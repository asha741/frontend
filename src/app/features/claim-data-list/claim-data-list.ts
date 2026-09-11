import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { Router, RouterLink } from '@angular/router';
import { NgbTooltipModule, NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

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
import { BadgeClassPipe } from '../../shared/pipes/badge-class.pipe';

/** Format the backend's `format` param accepts for the sample template. */
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
 * Uploaded claim batches — the sample-template download is a raw fetch
 * (streamed file, no JSON envelope), everything else goes through
 * `ApiService.request`.
 *
 * POST /organization/claims/batches
 *   { page, limit, search, from_date, to_date }
 * → { items: ClaimDataBatchResponse[], pagination }
 */
@Component({
  selector: 'app-claim-data-list',
  standalone: true,
  imports: [BadgeClassPipe, GridModule, NgbTooltipModule, NgbDatepickerModule, FormsModule, DatePipe, RouterLink, TrimWhitespaceDirective],
  templateUrl: './claim-data-list.html',
  styleUrl: './claim-data-list.scss',
})
export class ClaimDataList implements OnInit {
  constructor(
    public api: ApiService,
    public filterSort: FilterAndSortingService,
    public router: Router,
    public crypto: CryptoService,
    public perms: PermissionService,
    public loader: LoaderService,
    public config: ConfigService,
    private toast: ToastService,
  ) {}

  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly batchesData = signal<GridDataResult>({ data: [], total: 0 });
  readonly pageSizes = [10, 25, 50];

  /** Guards the sample-template download against a second click mid-request. */
  readonly downloading = signal(false);

  state: State = {
    skip: 0,
    take: 10,
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  search = '';
  fromDate: NgbDateStruct | null = null;
  toDate: NgbDateStruct | null = null;

  async ngOnInit(): Promise<void> {
    await this.getBatchList();
  }

  /** Fetches one page of the batch grid, applying the current Kendo state plus search/date-range filters. */
  async getBatchList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        search: this.search?.trim(),
        from_date: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        to_date: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      },
    });

    // Claim batches list endpoint: paginated/filterable/sortable list of uploaded claim batches.
    const res = await this.api.request('POST', API_ROUTES.GET_CLAIM_BATCHES, body, {
      showToaster: false,
    });

    if (res?.status) {
      const d = res.data;
      const items = d?.items ?? [];
      const total = d?.pagination?.total_records ?? items.length;
      this.batchesData.set({ data: items, total });
    }
  }

  /** Kendo grid page/sort/filter change handler. */
  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.getBatchList();
  }

  /** Applies the search text + date range, resetting to page 1. Rejects an inverted date range before hitting the API. */
  async onSearch(): Promise<void> {
    if (this.fromDate && this.toDate && this.toDateStr(this.fromDate) > this.toDateStr(this.toDate)) {
      this.toast.warning('"From" date cannot be after "To" date.');
      return;
    }
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.getBatchList();
  }

  /** Resets search text, date range, and grid filters, then reloads the batch list. */
  async clearSearch(): Promise<void> {
    this.search = '';
    this.fromDate = null;
    this.toDate = null;
    this.state = { ...this.state, skip: 0, filter: { logic: 'and', filters: [] } };
    await this.getBatchList();
  }

  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }

  /** Analysis endpoints have data once processing has finished, or failed with partial results. */
  isBatchViewable(row: any): boolean {
    const s = (row?.status ?? '').toLowerCase();
    return s === 'completed' || s === 'failed';
  }

  /** Analysis / Claim Data / Consecutive Days — encrypts the batch id before it lands in the URL. */
  async viewBatch(row: any): Promise<void> {
    if (!this.isBatchViewable(row)) return;
    const encId = await this.crypto.encryptId(String(row?.id));
    this.router.navigate(['/claim-data-list', encId]);
  }

  /**
   * Downloads the sample claim-data import template.
   *
   * POST /organization/claims/sample-template  { format }
   *
   * The endpoint streams a file rather than the JSON envelope ApiService
   * expects, so it's fetched directly instead of through `api.request` — the
   * same pattern the Masters module's sample-file download uses. The body is
   * still AES-GCM encrypted and wrapped as `{ data: <cipher> }`, and the
   * bearer token still attached, exactly as ApiService would — only the
   * response handling differs (blob download instead of envelope parsing).
   */
  async downloadSampleTemplate(format: FileFormat = 'csv'): Promise<void> {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.loader.show();
    try {
      // Sample-template download endpoint: streams the import template file for the requested format.
      const blob = await this.fetchFileBlob(API_ROUTES.DOWNLOAD_CLAIM_IMPORT_TEMPLATE, { format });
      if (!blob) {
        this.toast.error('Failed to download the sample template.');
        return;
      }
      const { ext } = FILE_FORMAT[format];
      this.triggerDownload(blob, `claim-data-import-template.${ext}`);
    } catch {
      this.toast.error('Failed to download the sample template.');
    } finally {
      this.loader.hide();
      this.downloading.set(false);
    }
  }

  /**
   * POSTs an AES-GCM encrypted body (same shape ApiService sends) directly via
   * `fetch` and returns the response re-typed as a `Blob` under the format's
   * MIME type — a stream can arrive as application/octet-stream, which Excel
   * won't associate with .xlsx on some systems. Returns `null` on a non-2xx
   * response so callers can surface their own error toast.
   */
  private async fetchFileBlob(endpoint: string, payload: { format: FileFormat }): Promise<Blob | null> {
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
