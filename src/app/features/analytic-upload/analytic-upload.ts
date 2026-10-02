import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { NgbDatepickerModule, NgbDateStruct, NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';

import { ApiService } from '../../core/services/api.service';
import { ConfigService } from '../../core/config/config.service';
import { CryptoService } from '../../core/services/crypto.service';
import { FileUploadService } from '../../core/services/fileUpload.service';
import { LoaderService } from '../../core/services/loader.service';
import { ToastService } from '../../core/services/toast.service';
import { PermissionService } from '../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../core/constants/permissions';
import { API_ROUTES } from '../../core/constants/api-routes';
import { FilterAndSortingService } from '../../core/services/common-filter-sort.service';
import { toISOStartOfDay, toISOEndOfDay } from '../../core/utils/date.util';
import { TrimWhitespaceDirective } from '../../shared/directives/trim-whitespace.directive';
import { ImportFileModalComponent } from '../../shared/components/import-file-modal/import-file-modal.component';

/** Formats the sample-file endpoint accepts. */
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
 * Same static backend base URL `ApiService` uses (`api.service.ts`) — it
 * currently talks to this host rather than `environment.apiUrl`, so the raw
 * `fetch` below has to match it or it hits the wrong backend.
 */
const API_BASE_URL = 'https://hkdevapi-apccfxfnfwgvcta5.eastus2-01.azurewebsites.net/api/v1';

/**
 * Claim Analytic Upload — the list of Power BI data files uploaded to the org.
 *
 * POST /organization/powerbi/list  { page, limit, search, from_date, to_date }
 *   -> { items: PowerBIUploadResponse[], pagination }
 *
 * Importing is a two-step flow, unlike the patient/provider imports: the file
 * goes straight to Azure Blob Storage first (FileUploadService), and only the
 * resulting blob name is posted to /powerbi/import alongside the user's title.
 */
@Component({
  selector: 'app-analytic-upload',
  standalone: true,
  imports: [
    GridModule,
    NgbTooltipModule,
    NgbDatepickerModule,
    FormsModule,
    DatePipe,
    TrimWhitespaceDirective,
  ],
  templateUrl: './analytic-upload.html',
  styleUrl: './analytic-upload.scss',
})
export class AnalyticUpload implements OnInit {
  constructor(
    public api: ApiService,
    public config: ConfigService,
    public crypto: CryptoService,
    public fileUpload: FileUploadService,
    public loader: LoaderService,
    public toast: ToastService,
    public perms: PermissionService,
    public filterSort: FilterAndSortingService,
    public modal: NgbModal,
    public router: Router,
  ) {}

  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly uploadsData = signal<GridDataResult>({ data: [], total: 0 });
  readonly pageSizes = [10, 25, 50];
  readonly downloadingSample = signal(false);

  state: State = { skip: 0, take: 10, sort: [], filter: { logic: 'and', filters: [] } };

  search = '';
  fromDate: NgbDateStruct | null = null;
  toDate: NgbDateStruct | null = null;

  async ngOnInit(): Promise<void> {
    await this.getUploadList();
  }

  /** NgbDateStruct -> 'YYYY-MM-DD'. */
  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }

  /** Fetches one page of uploaded Power BI files for the current grid state. */
  async getUploadList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        search: this.search?.trim(),
        from_date: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        to_date: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      },
      includeSort: false,
    });

    const res = await this.api.request('POST', API_ROUTES.GET_POWERBI_UPLOADS, body, {
      showToaster: false,
    });

    if (res?.status) {
      const items = res.data?.items ?? [];
      this.uploadsData.set({ data: items, total: res.data?.pagination?.total_records ?? items.length });
    }
  }

  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.getUploadList();
  }

  async onSearch(): Promise<void> {
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.getUploadList();
  }

  async clearSearch(): Promise<void> {
    this.search = '';
    this.fromDate = null;
    this.toDate = null;
    this.state = { ...this.state, skip: 0, filter: { logic: 'and', filters: [] } };
    await this.getUploadList();
  }

  /**
   * Opens the shared import modal with its optional title field turned on, then
   * refreshes the grid once rows land. The upload callback does the blob upload
   * itself so the modal stays in its importing state for the whole two-step flow.
   */
  openImportModal(): void {
    const ref = ImportFileModalComponent.open(this.modal, {
      title: 'Import Analytic Data',
      instructions: 'Drag and drop a Power BI data file here, or click to browse.',
      acceptedExtensions: ['csv', 'xlsx'],
      titleLabel: 'File Title',
      titlePlaceholder: 'Enter a title for this file',
      uploadFn: (file, fileTitle) => this.uploadAndImport(file, fileTitle),
    });
    ref.componentInstance.imported.subscribe(async () => {
      this.state = { ...this.state, skip: 0 };
      await this.getUploadList();
    });
  }

  /**
   * Step 1 — push the file to Azure Blob Storage; step 2 — register it with the
   * backend by blob name. A failed blob upload never reached the API, so there
   * is no backend message to show: `FileUploadService` has already toasted the
   * storage error, and returning null lets the modal stop without this adding a
   * second, invented one.
   */
  private async uploadAndImport(file: File, fileTitle: string): Promise<any> {
    // Power BI analytic files share the claim-data container
    // (AZURE_CONTAINER_CLAIM_DATA) that claim batch imports already use.
    const blobName = await this.fileUpload.uploadFile(file, this.config.claimBatchContainer);
    if (!blobName) return null;

    return this.api.request(
      'POST',
      API_ROUTES.IMPORT_POWERBI,
      { file_title: fileTitle, file_name: blobName },
      { showToaster: true },
    );
  }

  /**
   * Opens the uploaded file via a short-lived Azure SAS URL minted by the
   * backend. Unlike the sample file this returns the normal JSON envelope with
   * a URL inside it, not a binary stream.
   *
   * The toaster is left on so a failure surfaces the backend's own message;
   * nothing is invented here if the call fails or the URL is missing.
   */
  async downloadFile(row: any): Promise<void> {
    const res = await this.api.request('POST', API_ROUTES.DOWNLOAD_POWERBI_FILE, { id: row?.id });
    if (!res?.status) return;

    const url = this.extractFileUrl(res.data);
    if (!url) return;

    // Fetches the file as a blob and saves it directly — avoids opening a new
    // tab (`window.open`), which also blanked out for non-renderable types.
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = row?.file_name || 'download';
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  /**
   * Opens the read-only Import Result page for one uploaded file — same
   * errors/successes table the import modal renders right after an upload,
   * reopened here from the list by id (mirrors `viewBatch` in Travel Time).
   */
  async viewResult(row: any): Promise<void> {
    const encId = await this.crypto.encryptId(String(row?.id));
    this.router.navigate(['/analytic-upload', 'result', encId]);
  }

  /**
   * Pulls the SAS URL out of the download response. The endpoint's 200 body is
   * untyped in the API docs, so accept the shapes this backend uses for URLs
   * elsewhere (`file_url`, `storage_url`, …) as well as a bare string.
   */
  private extractFileUrl(data: any): string {
    if (typeof data === 'string') return data;
    return data?.url ?? data?.sas_url ?? data?.file_url ?? data?.storage_url ?? '';
  }

  /**
   * Downloads the Power BI import sample file. Same fetch/blob pattern as the
   * patient and provider sample downloads — the endpoint streams a file rather
   * than the JSON envelope `ApiService` expects, so it bypasses `api.request`.
   */
  async downloadSampleFile(format: FileFormat = 'csv'): Promise<void> {
    if (this.downloadingSample()) return;
    this.downloadingSample.set(true);
    this.loader.show();
    try {
      const url = API_BASE_URL + API_ROUTES.DOWNLOAD_POWERBI_SAMPLE;
      const token = (await this.crypto.tryDecryptPayload<string>(localStorage.getItem('accessToken'))) ?? '';
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ data: await this.crypto.encryptPayload({ format }) }),
      });
      if (!resp.ok) {
        // This endpoint streams a file, so it never goes through ApiService's
        // toaster. Decrypt the error envelope by hand and show what the backend
        // actually said rather than a canned failure line.
        const message = await this.backendErrorMessage(resp);
        if (message) this.toast.error(message);
        return;
      }
      const { ext, mime } = FILE_FORMAT[format];
      const blob = new Blob([await resp.blob()], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `analytic-upload-sample.${ext}`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Network-level failure — the request never produced a backend message,
      // and this deliberately doesn't substitute one of its own.
    } finally {
      this.loader.hide();
      this.downloadingSample.set(false);
    }
  }

  /**
   * Reads the backend's message off a failed raw `fetch`. The body is the same
   * AES-GCM `{ data: "<cipher>" }` envelope `ApiService` decrypts, so this
   * mirrors its `messageFromEnvelope`: `error[0].detail` is a plain string on
   * most endpoints and an object carrying `.message` on the import ones.
   * Returns '' when the response holds no message to show.
   */
  private async backendErrorMessage(resp: Response): Promise<string> {
    try {
      const body = await resp.json();
      const envelope = typeof body?.data === 'string'
        ? ((await this.crypto.tryDecryptPayload<any>(body.data)) ?? body)
        : body;

      const detail = Array.isArray(envelope?.error) ? envelope.error[0]?.detail : null;
      if (typeof detail === 'string' && detail) return detail;
      if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
        return detail.message;
      }
      return typeof envelope?.message === 'string' ? envelope.message : '';
    } catch {
      return '';
    }
  }
}
