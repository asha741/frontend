import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { FocusFirstInputDirective } from '../../../core/services/focusFirstInput.directive';
import { ConfigService } from '../../../core/config/config.service';
import { ToastService } from '../../../core/services/toast.service';
import { FileUploadService } from '../../../core/services/fileUpload.service';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';
import { noWhitespaceValidator } from '../../../core/utils/validators.util';
import { DeleteConfirmationComponent } from '../../../shared/components/delete-confirmation/delete-confirmation.component';
import { ImportSummary } from '../../../shared/components/import-file-modal/import-file-modal.component';

/** Same shape as `ImportSummary`, plus the backend's row-error `detail` line (e.g. "File rejected: 23 row(s) have validation errors."). */
interface ClaimImportSummary extends ImportSummary {
  detail?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Recent years, newest first (current year back to 5 years prior). */
function recentYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => current - i);
}

/**
 * Import Claim Data — uploads the file straight to Azure Blob (same pattern as
 * `validate-claim.ts`), then submits `{ file_title, year, month, file_blob_name }`.
 *
 * POST /organization/claims/import
 *   { file_title, year, month, file_blob_name, replace }
 * → ClaimDataBatchResponse
 */
@Component({
  selector: 'app-claim-import',
  standalone: true,
  imports: [ReactiveFormsModule, TrimWhitespaceDirective, FocusFirstInputDirective],
  templateUrl: './claim-import.html',
  styleUrl: './claim-import.scss',
})
export class ClaimImport {
  readonly form: FormGroup;
  readonly isSubmitted = signal(false);
  readonly submitting = signal(false);
  readonly selectedFile = signal<File | null>(null);
  /** Set as soon as the selected file finishes uploading to Azure — before Submit is ever clicked. */
  readonly uploadedBlobName = signal<string | null>(null);
  readonly uploading = signal(false);

  readonly months = MONTHS;
  readonly years = recentYears();
  readonly allowedExtensions = ['xlsx', 'csv'];

  constructor(
    public fb: FormBuilder,
    public api: ApiService,
    public router: Router,
    public config: ConfigService,
    public toast: ToastService,
    public fileUpload: FileUploadService,
    public modal: NgbModal,
  ) {
    this.form = this.fb.group({
      file_title: [
        '',
        [Validators.required, Validators.minLength(3), Validators.maxLength(100), noWhitespaceValidator()],
      ],
      year: ['', [Validators.required]],
      month: ['', [Validators.required]],
    });
  }

  /** Shorthand accessor for the form's controls, used in the template for validation-state checks. */
  get f() {
    return this.form.controls;
  }

  readonly fileError = signal<string | null>(null);
  readonly dragOver = signal(false);
  /** Row-level created/skipped/error breakdown from a failed import — same shape the Providers/Patients import modal renders. */
  readonly importSummary = signal<ClaimImportSummary | null>(null);

  /** Drag-and-drop handler: marks the drop zone as active and prevents the browser's default "open file" behavior. */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  /** Handles a file dropped onto the drop zone. */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    void this.handleFiles(event.dataTransfer?.files ?? null);
  }

  /** Handles a file chosen via the file picker input; clears the input value so re-selecting the same file still fires a change event. */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.handleFiles(input.files);
    input.value = '';
  }

  /** Validates the selected file (single file, allowed extension) and immediately uploads it to Azure Blob storage. */
  private async handleFiles(files: FileList | null): Promise<void> {
    const file = files?.[0] ?? null;
    if (!file) return;

    if ((files?.length ?? 0) > 1) {
      this.fileError.set('Only one file can be uploaded.');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!this.allowedExtensions.includes(ext)) {
      this.fileError.set(`"${file.name}" is not a supported format. Only .xlsx and .csv files are allowed.`);
      return;
    }

    this.fileError.set(null);
    this.importSummary.set(null);
    this.uploadedBlobName.set(null);
    this.selectedFile.set(file);

    // Upload to Azure right away, at selection time — not deferred until
    // Submit. Waiting until Submit re-reads the same File handle off disk,
    // and if the source file changed in between (e.g. re-saved in Excel
    // while the form was being filled in), the browser throws
    // ERR_UPLOAD_FILE_CHANGED. Uploading immediately closes that window.
    this.uploading.set(true);
    try {
      // Uploads the raw file directly to Azure Blob storage (not to our API) and returns the resulting blob name.
      const blobName = await this.fileUpload.uploadFile(file, this.config.claimBatchContainer);
      if (!blobName) {
        this.fileError.set('Failed to upload the file. Please try again.');
        this.selectedFile.set(null);
        return;
      }
      this.uploadedBlobName.set(blobName);
    } finally {
      this.uploading.set(false);
    }
  }

  /** Prompts for confirmation, then clears the selected file (and its uploaded blob, if any). */
  removeFile(): void {
    const ref = this.modal.open(DeleteConfirmationComponent, { centered: true });
    ref.componentInstance.title = 'Remove File';
    ref.componentInstance.message =
      'Are you sure you want to remove this file?.';
    ref.componentInstance.confirmButtonText = 'Remove';
    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') return;
        await this.clearSelectedFile();
      },
      () => {},
    );
  }

  /** Clears the selected file and, if it was already uploaded, deletes the now-orphaned blob from Azure. */
  private async clearSelectedFile(): Promise<void> {
    const blobName = this.uploadedBlobName();
    this.selectedFile.set(null);
    this.uploadedBlobName.set(null);
    this.fileError.set(null);
    this.importSummary.set(null);
    if (blobName) {
      // Removes the now-orphaned blob so it doesn't linger in storage unreferenced.
      await this.fileUpload.deleteFile(blobName, this.config.claimBatchContainer);
    }
  }

  /** Human-readable file size (e.g. "1.4 MB"). */


  /** Validates the form and submits the import (as a non-replace request). */
  async onSubmit(): Promise<void> {
    this.isSubmitted.set(true);
    if (this.form.invalid || !this.selectedFile() || this.fileError() || this.uploading()) return;

    this.submitting.set(true);
    try {
      await this.submitImport(false);
    } finally {
      this.submitting.set(false);
    }
  }

  private async submitImport(replace: boolean): Promise<void> {
    // The file was already uploaded to Azure the moment it was selected —
    // Submit only needs the blob name it got back.
    const file_blob_name = this.uploadedBlobName();
    if (!file_blob_name) return;

    this.importSummary.set(null);

    const payload = {
      file_title: this.form.value.file_title,
      year: this.form.value.year,
      month: this.form.value.month,
      file_blob_name,
      replace,
    };

    // Claim import endpoint: registers the already-uploaded blob as a new claim batch (or replaces an existing one if `replace` is true).
    const res = await this.api.request('POST', API_ROUTES.IMPORT_CLAIM_DATA, payload);

    if (res?.status) {
      this.router.navigate(['/claim-data-list']);
      return;
    }

    if (res && this.isDuplicateResponse(res)) {
      this.confirmReplace(res.message);
      return;
    }

    // Row-level failures (e.g. "23 row(s) have validation errors") carry a
    // row/field/message breakdown in `error[0].errors` — render it the same
    // way the Providers/Patients import modal does. Any other failure is
    // already surfaced by ApiService's global error toast, so there's nothing
    // left to do here.
    const summary = this.extractSummary(res);
    if (summary) {
      this.importSummary.set(summary);
    }
  }

  /**
   * Pulls the row-level created/skipped/error breakdown out of a failed import
   * response, if present. The claims import endpoint rejects the whole file
   * and reports `error[0].errors` (row/field/message) plus a `detail` summary
   * line rather than the `error[0].summary` shape some other importers use —
   * accept either.
   */
  private extractSummary(res: any): ClaimImportSummary | null {
    const entry = Array.isArray(res?.error) ? res.error[0] : null;
    if (!entry) return null;
    if (entry.summary) return entry.summary;
    if (Array.isArray(entry.errors) && entry.errors.length) {
      return { errors: entry.errors, detail: entry.detail };
    }
    return null;
  }

  /** Splits a backend message that bundles multiple validation errors (e.g. "X is required.; Y is invalid.") into separate lines. */
  splitMessages(message: string): string[] {
    return message
      .split(/\r?\n|;/)
      .map((m) => m.trim())
      .filter((m) => m.length > 0);
  }

  /** Splits a backend field list (e.g. "Service ID, Claim ID, Service Date") into individual chips. */
  splitFields(field: string): string[] {
    return field
      .split(',')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  /** Prompts to confirm overwriting a duplicate batch, then re-submits the import with `replace: true`. */
  private confirmReplace(message?: string): void {
    const ref = this.modal.open(DeleteConfirmationComponent, { centered: true });
    ref.componentInstance.title = 'Duplicate File';
    ref.componentInstance.message =
      message || 'A file with this title, month and year already exists. Replace it?';
    ref.componentInstance.confirmButtonText = 'Replace';
    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') return;
        this.submitting.set(true);
        try {
          await this.submitImport(true);
        } finally {
          this.submitting.set(false);
        }
      },
      () => {},
    );
  }

  /** Detects a duplicate-batch failure by message content, since the API has no dedicated error code for it. */
  private isDuplicateResponse(res: any): boolean {
    const message = (res?.message ?? '').toLowerCase();
    return message.includes('duplicate') || message.includes('already exist');
  }

  /** Cancels the import, cleaning up any already-uploaded blob so it isn't left orphaned in storage. */
  async cancel(): Promise<void> {
    const blobName = this.uploadedBlobName();
    if (blobName) {
      await this.fileUpload.deleteFile(blobName, this.config.claimBatchContainer);
    }
    this.router.navigate(['/claim-data-list']);
  }
}
