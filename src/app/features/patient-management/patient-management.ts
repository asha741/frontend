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

@Component({
  selector: 'app-patient-management',
  standalone: true,
  imports: [BadgeClassPipe, GridModule, NgbTooltipModule, NgbDatepickerModule, FormsModule, DatePipe, RouterLink, UsPhonePipe, TrimWhitespaceDirective],
  templateUrl: './patient-management.html',
  styleUrl: './patient-management.scss',
})
/**
 * Patient Management list page — searchable/filterable/sortable Kendo grid of
 * patients, with import, export, and sample-file download actions and
 * navigation into a patient's tabbed Patient Profile page.
 */
export class PatientManagement implements OnInit {
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

  readonly patientsData = signal<GridDataResult>({ data: [], total: 0 });
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

  async ngOnInit(): Promise<void> {
    await this.getPatientList();
  }

  /** Maps the grid's boolean status filter (`true`/`false`) to `'Active'`/`'Inactive'`. */
  private readonly statusValueMap = {
    status: (v: any) => (v === true ? 'Active' : v === false ? 'Inactive' : null),
  };

  /** Current status filter value applied on the grid, as the backend expects it. */
  private getStatusFilter(): string | null {
    const body = this.filterSort.buildRequestBody(this.state, { valueMap: this.statusValueMap });
    return body['status'] ?? null;
  }

  /** Fetches the current page of patients from the backend using the grid's state (paging/sort/filter) plus search and date-range criteria. */
  async getPatientList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        search: this.search?.trim(),
        created_date_from: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        created_date_to: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      },
      valueMap: this.statusValueMap,
    });

    // POST paginated/filtered/sorted patient list.
    const res = await this.api.request('POST', API_ROUTES.GET_PATIENTS, body, {
      showToaster: false,
    });

    if (res?.status) {
      const d = res.data;
      // Defensive: backend list envelopes vary (`items`/`data`, `total_records`/`totalItems`).
      const items = d?.items ?? d?.data ?? [];
      const total =
        d?.pagination?.total_records ?? d?.pagination?.totalItems ?? d?.total ?? items.length;
      this.patientsData.set({ data: items, total });
    }
  }

  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.getPatientList();
  }

  async onSearch(): Promise<void> {
    if (this.fromDate && this.toDate && this.toDateStr(this.fromDate) > this.toDateStr(this.toDate)) {
      this.toast.warning('"From" date cannot be after "To" date.');
      return;
    }
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.getPatientList();
  }

  async clearSearch(): Promise<void> {
    this.search = '';
    this.fromDate = null;
    this.toDate = null;
    this.state = { ...this.state, skip: 0 };
    await this.getPatientList();
  }

  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }

  /** Opens the shared import-file modal configured for patient CSV/XLSX uploads, then refreshes the grid on a successful import. */
  openImportModal(): void {
    const ref = ImportFileModalComponent.open(this.modal, {
      title: 'Import Patients',
      instructions: 'Drag and drop a patient file here, or click to browse.',
      acceptedExtensions: ['csv', 'xlsx'],
      uploadFn: (file) => this.api.uploadFile(API_ROUTES.IMPORT_PATIENTS, file, 'file', { showToaster: true }),
    });
    ref.componentInstance.imported.subscribe(async () => {
      this.state = { ...this.state, skip: 0 };
      await this.getPatientList();
    });
  }

  /** Full name for a patient row, tolerant of snake / camel field names. */
  patientName(row: any): string {
    const first = row?.first_name ?? row?.firstName ?? '';
    const last = row?.last_name ?? row?.lastName ?? '';
    return `${first} ${last}`.trim() || (row?.name ?? '-');
  }

  /**
   * Patient Profile — opens the tabbed profile page (Edit Patient / Patient
   * Documents / Patient Claims). The `:id` route param is AES-GCM encrypted
   * so the raw patient id is never exposed in the URL.
   */
  async openPatientProfile(row: any): Promise<void> {
    const encId = await this.crypto.encryptId(String(row?.id));
    this.router.navigate(['/patient-management/profile', encId]);
  }

  /** Confirms via modal, then deletes the given patient row and refreshes the grid. */
  deletePatient(row: any): void {
    const id = row?.id;
    const ref = this.modal.open(DeleteConfirmationComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });
    ref.componentInstance.message = `Are you sure you want to delete this patient?`;
    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') return;
        // DELETE the patient record by id.
        const res = await this.api.request('DELETE', API_ROUTES.DELETE_PATIENT, { id: id });
        if (res?.status) {
          await this.getPatientList();
        }
      },
      () => {},
    );
  }

  /**
   * Exports the patient list (CSV or Excel), honouring the current search,
   * status, and date-range filters.
   */
  async exportPatients(format: FileFormat = 'csv'): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.loader.show();
    try {
      const payload = {
        format,
        search: this.search?.trim() || '',
        status: this.getStatusFilter(),
        created_date_from: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        created_date_to: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      };
      const blob = await this.fetchFileBlob(API_ROUTES.EXPORT_PATIENTS, payload);
      if (!blob) {
        this.toast.error('Failed to export patients.');
        return;
      }
      const { ext } = FILE_FORMAT[format];
      this.triggerDownload(blob, `patients-export.${ext}`);
    } catch {
      this.toast.error('Failed to export patients.');
    } finally {
      this.loader.hide();
      this.exporting.set(false);
    }
  }

  /**
   * Downloads the patient import sample file from the backend.
   *
   * POST /organization/patients/sample-file  { format }
   *
   * Same fetch/blob pattern as `exportPatients` / BHS Matrix's
   * `downloadSampleFile` — the endpoint streams a file rather than the JSON
   * envelope `ApiService` expects, so it's fetched directly instead of
   * through `api.request`.
   */
  async downloadSampleFile(format: FileFormat = 'csv'): Promise<void> {
    if (this.downloadingSample()) return;
    this.downloadingSample.set(true);
    this.loader.show();
    try {
      const blob = await this.fetchFileBlob(API_ROUTES.DOWNLOAD_PATIENTS_SAMPLE, { format });
      if (!blob) {
        this.toast.error('Failed to download sample file.');
        return;
      }
      const { ext } = FILE_FORMAT[format];
      this.triggerDownload(blob, `patients-sample.${ext}`);
    } catch {
      this.toast.error('Failed to download sample file.');
    } finally {
      this.loader.hide();
      this.downloadingSample.set(false);
    }
  }

  /**
   * Low-level file download helper for endpoints that stream a raw file
   * (not the standard JSON envelope), so it bypasses `ApiService` and calls
   * `fetch` directly — re-decrypting the stored access token and
   * encrypting the request payload the same way `ApiService` would.
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

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
