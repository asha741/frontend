import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CellRowspanFn, DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { ConfigService } from '../../../core/config/config.service';
import { ToastService } from '../../../core/services/toast.service';
import { FileUploadService } from '../../../core/services/fileUpload.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { DeleteConfirmationComponent } from '../../../shared/components/delete-confirmation/delete-confirmation.component';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';
import { PermissionService } from '../../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../../core/constants/permissions';
import type { FailedPage } from '../bulk-upload-detail/bulk-upload-detail';

/** One row of the Documents tab, as returned by the parse endpoint. */
interface BulkUploadDocument {
  sr_no: number;
  document_name: string;
  status: 'Processing' | 'Completed' | 'Failed' | string;
  pages_processed: number;
  pages_failed: number;
  failed_reason: string;
  failed_pages?: FailedPage[];
}

/** One patient/provider pairing, as returned by the parse endpoint. */
interface BulkUploadExtractRow {
  patient_name: string;
  client_id: string;
  provider_name: string;
  license: string;
  treatment_plan: number;
  progress_notes: number;
  dla_20: number;
  status: string;
  failure_reason: string;
}

/**
 * A single Extract Data table row. Only the first row of a patient's group
 * carries `isGroupStart`, with `groupSize` set to the row count of that
 * group — `extractPatientRowspan` (below) uses these to drive the Patient
 * Name column's Kendo `cellRowspan`.
 */
interface ExtractDisplayRow extends BulkUploadExtractRow {
  isGroupStart: boolean;
  groupSize: number;
}

type BulkUploadTab = 'documents' | 'extract-data';

/** A selected file paired with its Azure blob upload state. */
interface UploadedFile {
  file: File;
  blobName: string | null;
  uploading: boolean;
}

const ALLOWED_EXTENSIONS = ['pdf'];

/** Recommended processing capacity: total file size allowed per upload batch. */
const MAX_BATCH_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

/** How often the batch is re-checked while it is still being extracted. */
const STATUS_POLL_MS = 3000;

/**
 * Safety net for a batch that never leaves "Processing" — polling stops after
 * this long and the user is told to reopen the page rather than the tab
 * hammering the endpoint forever.
 */
const STATUS_POLL_TIMEOUT_MS = 10 * 60 * 1000;

/** Batch statuses that mean extraction has finished, one way or another. */
const TERMINAL_STATUSES = ['completed', 'failed', 'pending verification'];

/**
 * Bulk Upload — Upload Documents / Extract flow.
 *
 * POST /organization/bulk-upload/parse   { file_names } → { batch_id }
 *   Extraction runs asynchronously, so Extract only starts the batch: the id
 *   is put in the URL (`/bulk-upload/:id`) and the page reloads onto it.
 *
 * POST /organization/bulk-upload/status  { batch_id }
 *   → { status, documents: BulkUploadDocument[], extract_data: BulkUploadExtractRow[] }
 *   Polled every 3s while the batch is processing — which also covers landing
 *   here from the listing's View, or refreshing the page mid-extraction.
 */
@Component({
  selector: 'app-bulk-upload-form',
  standalone: true,
  imports: [BadgeClassPipe, GridModule, NgbTooltipModule],
  templateUrl: './bulk-upload-form.html',
  styleUrl: './bulk-upload-form.scss',
})
export class BulkUploadForm implements OnInit, OnDestroy {
  constructor(
    public api: ApiService,
    public router: Router,
    public route: ActivatedRoute,
    public config: ConfigService,
    public toast: ToastService,
    public fileUpload: FileUploadService,
    public crypto: CryptoService,
    public modal: NgbModal,
    public crumbLabels: BreadcrumbService,
    public perms: PermissionService,
  ) {}

  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly allowedExtensions = ALLOWED_EXTENSIONS;
  readonly pageSizes = [10, 25, 50];

  // ── Upload Documents — each file uploads to Azure as soon as it's
  // selected/dropped, not deferred until Extract. ────────────────────
  readonly files = signal<UploadedFile[]>([]);
  readonly fileError = signal<string | null>(null);
  readonly dragOver = signal(false);

  // ── Extract ─────────────────────────────────────────────────────────
  readonly extracting = signal(false);
  readonly extracted = signal(false);
  readonly batchId = signal<string | null>(null);
  readonly activeTab = signal<BulkUploadTab>('documents');

  /** The id exactly as it sits in the URL — reused when linking to a sub-page. */
  private encryptedBatchId = '';

  /** Batch status from the status endpoint ('Processing' → 'Completed' / 'Failed'). */
  readonly batchStatus = signal<string>('');
  /** Human-readable batch reference (e.g. "BCH-2026-010"), shown instead of the id. */
  readonly batchCode = signal<string>('');
  readonly submitting = signal(false);

  /**
   * `patient_provider_pairs` from the status response, sent back verbatim as
   * `verified_pairs` when the batch is submitted for claim validation.
   */
  private patientProviderPairs: any[] = [];
  /** True while the very first status response is still outstanding. */
  readonly statusLoading = signal(false);
  /** True while the 3s poll loop is running, so the UI can say it's live. */
  readonly polling = signal(false);

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollDeadline = 0;
  private destroyed = false;

  // ── Documents tab (client-paged from the parse response) ──────────
  private allDocuments: BulkUploadDocument[] = [];
  documentsState: State = { skip: 0, take: 10, sort: [], filter: { logic: 'and', filters: [] } };
  readonly documentsGridData = signal<GridDataResult>({ data: [], total: 0 });

  // ── Extract Data tab (grouped by patient, shown unpaginated) ───────
  readonly extractGridData = signal<GridDataResult>({ data: [], total: 0 });

  /**
   * Merges the Patient Name column's cell over `groupSize` rows, starting at
   * each group's first row. Kendo's `RowArgs.dataItem` is its internal row
   * wrapper (`{ data, index, type, ... }`), not the raw row — unwrap `.data`
   * to reach the fields `groupExtractRows` set.
   */
  readonly extractPatientRowspan: CellRowspanFn = (row) => {
    const item = (row.dataItem?.data ?? row.dataItem) as ExtractDisplayRow;
    return item?.isGroupStart ? item.groupSize : 1;
  };

  // ── Resume a batch from the URL ─────────────────────────────────────

  /**
   * `/bulk-upload/:id` carries an encrypted batch id — set by Extract, or by
   * the listing's View on a batch that is still processing. Either way the page
   * starts from the status endpoint rather than from local state.
   */
  async ngOnInit(): Promise<void> {
    const encId = this.route.snapshot.paramMap.get('id');
    if (!encId) return;

    this.encryptedBatchId = encId;
    let batchId = encId;
    try {
      batchId = await this.crypto.decryptId(encId);
    } catch {
      // A plain (unencrypted) id in the URL is still usable.
    }

    this.batchId.set(batchId);
    this.statusLoading.set(true);
    this.pollDeadline = performance.now() + STATUS_POLL_TIMEOUT_MS;
    await this.loadStatus();
    this.statusLoading.set(false);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopPolling();
  }

  /**
   * One status read. Refreshes both tabs, then either schedules the next poll
   * (still processing) or stops (finished / timed out / component gone).
   */
  private async loadStatus(): Promise<void> {
    const batchId = this.batchId();
    if (!batchId || this.destroyed) return;

    const res = await this.api.request(
      'POST',
      API_ROUTES.BULK_UPLOAD_STATUS,
      { batch_id: batchId },
      // Silent: this runs every 3s, so no global loader or toaster.
      { showToaster: false, showLoader: false },
    );
    if (this.destroyed) return;

    if (res?.status) {
      const d = res.data;
      this.batchStatus.set(d?.status ?? '');
      this.batchCode.set(d?.batch_code ?? '');
      // Otherwise this page's crumb repeats the listing's "Bulk Upload".
      this.crumbLabels.setLabel(`/bulk-upload/${this.encryptedBatchId}`, this.batchCode());
      this.allDocuments = d?.documents ?? [];
      this.patientProviderPairs = Array.isArray(d?.patient_provider_pairs)
        ? d.patient_provider_pairs
        : [];
      const extractRows = this.groupExtractRows(d?.extract_data ?? []).flat();
      this.extractGridData.set({ data: extractRows, total: extractRows.length });
      this.applyDocumentsPage();
      this.extracted.set(true);
    }

    // A failed request is treated as "still processing" — a single dropped
    // poll shouldn't kill the loop while the batch is genuinely running.
    if (this.isBatchFinished()) {
      this.stopPolling();
      return;
    }
    if (performance.now() >= this.pollDeadline) {
      this.stopPolling();
      this.toast.info('This batch is taking longer than usual. Reopen the page to keep tracking it.');
      return;
    }
    this.scheduleNextPoll();
  }

  private scheduleNextPoll(): void {
    this.stopPolling();
    this.polling.set(true);
    this.pollTimer = setTimeout(() => this.loadStatus(), STATUS_POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.polling.set(false);
  }

  /** Extraction has finished (completed, failed, or awaiting verification). */
  isBatchFinished(): boolean {
    return TERMINAL_STATUSES.includes(this.batchStatus().toLowerCase());
  }

  // ── Upload Documents: drag & drop / browse ─────────────────────────

  /**
   * `/bulk-upload/:id` is a resumed/extracted batch — its files were already
   * uploaded and extracted, so the upload box is view-only.
   */
  uploadDisabled(): boolean {
    return !!this.batchId();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.uploadDisabled()) return;
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (this.uploadDisabled()) return;
    void this.addFiles(event.dataTransfer?.files ?? null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (this.uploadDisabled()) {
      input.value = '';
      return;
    }
    void this.addFiles(input.files);
    input.value = '';
  }

  /**
   * Validates and queues the selected files, then uploads each one to Azure
   * right away — not deferred until Extract. Each file appears immediately
   * as "Uploading…" and gets its blob name filled in once the upload
   * finishes (or is dropped from the list if the upload fails).
   */
  private async addFiles(fileList: FileList | null): Promise<void> {
    if (!fileList?.length) return;

    this.fileError.set(null);
    let batchSize = this.files().reduce((sum, f) => sum + f.file.size, 0);
    const newFiles: File[] = [];
    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!this.allowedExtensions.includes(ext)) {
        this.fileError.set(`"${file.name}" is not a supported format. Only PDF files are allowed.`);
        continue;
      }
      const isDuplicate =
        this.files().some((f) => f.file.name === file.name && f.file.size === file.size) ||
        newFiles.some((f) => f.name === file.name && f.size === file.size);
      if (isDuplicate) continue;

      if (batchSize + file.size > MAX_BATCH_SIZE_BYTES) {
        this.fileError.set('This upload batch exceeds the recommended processing capacity of 2 GB.');
        continue;
      }

      batchSize += file.size;
      newFiles.push(file);
    }
    if (!newFiles.length) return;

    const entries: UploadedFile[] = newFiles.map((file) => ({ file, blobName: null, uploading: true }));
    this.files.set([...this.files(), ...entries]);

    await Promise.all(
      entries.map(async (entry) => {
        const blobName = await this.fileUpload.uploadFile(entry.file, this.config.bulkUploadContainer);
        if (!blobName) {
          this.toast.error(`Failed to upload "${entry.file.name}". Please try again.`);
          this.files.set(this.files().filter((f) => f !== entry));
          return;
        }
        entry.blobName = blobName;
        entry.uploading = false;
        this.files.set([...this.files()]);
      }),
    );
  }

  /** Documents can only be removed before Extract has been run. */
  removeFile(index: number): void {
    if (this.extracting() || this.extracted()) return;
    const entry = this.files()[index];
    if (!entry || entry.uploading) return;

    const ref = this.modal.open(DeleteConfirmationComponent, { centered: true });
    ref.componentInstance.title = 'Remove File';
    ref.componentInstance.message =
      'Are you sure you want to remove this file?.';
    ref.componentInstance.confirmButtonText = 'Remove';
    ref.result.then(
      async (result: string) => {
        if (result !== 'confirmed') return;
        if (entry.blobName) {
          await this.fileUpload.deleteFile(entry.blobName, this.config.bulkUploadContainer);
        }
        this.files.set(this.files().filter((_, i) => i !== index));
      },
      () => {},
    );
  }

  // ── Extract ─────────────────────────────────────────────────────────

  /** True while any selected file is still uploading to Azure. */
  anyUploading(): boolean {
    return this.files().some((f) => f.uploading);
  }

  /** Sends the uploaded blob names to the parse endpoint to start extraction, then navigates onto the new batch id. */
  async extract(): Promise<void> {
    if (!this.files().length || this.extracting()) return;
    // Every file already uploaded to Azure at selection time — wait for any
    // still in flight rather than extracting a partial list.
    if (this.files().some((f) => f.uploading || !f.blobName)) return;

    this.extracting.set(true);
    try {
      const file_names = this.files().map((f) => f.blobName!);

      // Starts async extraction on the backend and returns the new batch id.
      const res = await this.api.request('POST', API_ROUTES.BULK_UPLOAD_PARSE, { file_names }, {
        showToaster: false,
      });
      if (!res?.status) return;

      // Parsing runs in the background: the response only starts the batch.
      // Putting its id in the URL reloads this page onto the status endpoint,
      // so the tables fill in as extraction progresses — and going back to the
      // listing and reopening the batch lands in exactly the same place.
      const newBatchId = res.data?.batch_id;
      if (!newBatchId) {
        this.toast.error('The upload started but no batch id was returned.');
        return;
      }

      const encId = await this.crypto.encryptId(String(newBatchId));
      this.router.navigate(['/bulk-upload', encId]);
    } finally {
      this.extracting.set(false);
    }
  }

  /** Groups extract-data rows by patient name (falling back to client id), preserving first-seen order. */
  private groupExtractRows(rows: BulkUploadExtractRow[]): ExtractDisplayRow[][] {
    const order: string[] = [];
    const groups = new Map<string, ExtractDisplayRow[]>();

    for (const row of rows) {
      const key = String(row.patient_name ?? row.client_id ?? '');
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push({ ...row, isGroupStart: false, groupSize: 0 });
    }

    return order.map((key) => {
      const group = groups.get(key)!;
      group[0].isGroupStart = true;
      group[0].groupSize = group.length;
      return group;
    });
  }

  // ── Documents tab paging ────────────────────────────────────────────

  onDocumentsStateChange(state: DataStateChangeEvent): void {
    this.documentsState = state;
    this.applyDocumentsPage();
  }

  private applyDocumentsPage(): void {
    const skip = this.documentsState.skip ?? 0;
    const take = this.documentsState.take ?? 10;
    this.documentsGridData.set({
      data: this.allDocuments.slice(skip, skip + take),
      total: this.allDocuments.length,
    });
  }

  // ── Documents tab row action ────────────────────────────────────────

  /** Only a document that actually failed pages has a breakdown worth opening. */
  hasFailedPages(row: BulkUploadDocument): boolean {
    return Number(row?.pages_failed) > 0 || !!row?.failed_pages?.length;
  }

  /** Opens the per-page failure breakdown for one document. */
  async viewFailedPages(row: BulkUploadDocument): Promise<void> {
    if (!this.encryptedBatchId) return;
    const encDocId = await this.crypto.encryptId(String(row?.sr_no ?? ''));
    this.router.navigate(['/bulk-upload', this.encryptedBatchId, 'failed-pages', encDocId]);
  }

  // ── Status helpers ──────────────────────────────────────────────────

  /** True when a status value should show the failure-reason info icon. */
  isFailedStatus(status: string): boolean {
    return (status ?? '').toLowerCase() === 'failed';
  }

  // ── Submit / Cancel ──────────────────────────────────────────────────

  /** Submit unlocks only once the batch itself reports extraction is done, and the user holds Create on Bulk Upload. */
  canSubmit(): boolean {
    if (!this.perms.can(PERMISSION_MODULE.BulkUpload, PERMISSION_ACTION.Create)) return false;
    if (!this.extracted() || !this.allDocuments.length || this.submitting()) return false;
    return (
      this.isBatchFinished() &&
      this.allDocuments.every((d) => (d.status ?? '').toLowerCase() !== 'processing')
    );
  }

  /**
   * Hands the extracted pairings to Claim Analyst, which starts OCR, AI
   * validation, rule-engine checks and compliance scoring.
   *
   * POST /organization/bulk-upload/submit-validation
   *   { batch_id, verified_pairs }  — `verified_pairs` is the status
   *   response's `patient_provider_pairs`, passed back as-is.
   */
  async onSubmit(): Promise<void> {
    const batchId = this.batchId();
    if (!this.canSubmit() || !batchId) return;

    if (!this.patientProviderPairs.length) {
      this.toast.error('This batch has no patient / provider pairs to submit.');
      return;
    }

    this.submitting.set(true);
    try {
      // Kicks off Claim Analyst processing (OCR/AI validation/compliance scoring) for this batch.
      const res = await this.api.request('POST', API_ROUTES.BULK_UPLOAD_SUBMIT_VALIDATION, {
        batch_id: batchId,
        verified_pairs: this.patientProviderPairs,
      });
      if (res?.status) {
        this.router.navigate(['/bulk-upload']);
      }
    } finally {
      this.submitting.set(false);
    }
  }
  /** Discards any files uploaded but not yet part of a created batch, then returns to the listing. */
  async cancel(): Promise<void> {
    // Clean up files already uploaded to Azure before a batch was ever
    // created — once Extract succeeds, the backend owns those blobs as part
    // of the batch, so leave them alone at that point.
    if (!this.extracted()) {
      await Promise.all(
        this.files()
          .filter((f) => f.blobName)
          .map((f) => this.fileUpload.deleteFile(f.blobName!, this.config.bulkUploadContainer)),
      );
    }
    this.router.navigate(['/bulk-upload']);
  }
}
