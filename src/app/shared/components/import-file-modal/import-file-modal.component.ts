import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { TrimWhitespaceDirective } from '../../directives/trim-whitespace.directive';

import { ApiResponse } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { DeleteConfirmationComponent } from '../delete-confirmation/delete-confirmation.component';

export interface ImportErrorRow {
  row?: number;
  field?: string;
  message?: string;
}

export interface ImportSuccessRow {
  row?: number;
  message?: string;
}

export interface ImportSummary {
  total_rows?: number;
  created?: number;
  /** Rows that matched a soft-deleted record and were brought back. */
  restored?: number;
  /** Rows that matched an existing record and overwrote it. */
  updated?: number;
  skipped?: number;
  errors?: ImportErrorRow[];
  successes?: ImportSuccessRow[];
}

/** Errors and successes flattened into one table row, so the result reads in file order. */
export interface ImportResultRow {
  row?: number;
  field?: string;
  message?: string;
  ok: boolean;
}

export interface ImportFileModalOptions {
  title?: string;
  instructions?: string;
  acceptedExtensions?: string[];
  successMessage?: string;
  /**
   * Set to show a required free-text field above the drop zone, labelled with
   * this string. Its value is passed to `uploadFn` as `fileTitle`. Imports that
   * only need the file (patients, providers, BHS matrix) leave it unset.
   */
  titleLabel?: string;
  titlePlaceholder?: string;
  uploadFn: (file: File, fileTitle: string) => Promise<ApiResponse<any>>;
}

/**
 * Generic "import file" modal — drag-and-drop or click-to-browse a single
 * file, then hand it to the caller's `uploadFn`. A clean response closes the
 * modal (caller toasts + refreshes); a response carrying a row-level error
 * summary renders it as a table instead of closing, so partial-import
 * failures stay visible. Open via the static `ImportFileModalComponent.open(...)` factory.
 */
@Component({
  selector: 'app-import-file-modal',
  standalone: true,
  imports: [FormsModule, TrimWhitespaceDirective],
  templateUrl: './import-file-modal.component.html',
  styleUrl: './import-file-modal.component.scss',
})
export class ImportFileModalComponent {
  readonly activeModal = inject(NgbActiveModal);

  @Input() title = 'Import File';
  @Input() instructions = 'Drag and drop a file here, or click to browse.';
  @Input() acceptedExtensions: string[] = ['csv', 'xlsx'];
  @Input() successMessage = 'File imported successfully.';
  /** Non-empty turns on the title field above the drop zone — see {@link ImportFileModalOptions.titleLabel}. */
  @Input() titleLabel = '';
  @Input() titlePlaceholder = '';
  @Input() uploadFn!: (file: File, fileTitle: string) => Promise<ApiResponse<any>>;

  /** Fires whenever at least one row was created — even if the modal stays open to show errors. */
  @Output() imported = new EventEmitter<void>();

  constructor(private toast: ToastService, private modal: NgbModal) {}

  /**
   * Convenience factory: opens this modal with `xl`/centered/static-backdrop
   * config and applies the given options to the component instance.
   * @param uploadFn caller-supplied function that performs the actual API upload.
   */
  static open(modalService: NgbModal, options: ImportFileModalOptions): NgbModalRef {
    const modalRef = modalService.open(ImportFileModalComponent, {
      size: 'xl',
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });
    const instance = modalRef.componentInstance as ImportFileModalComponent;
    instance.uploadFn = options.uploadFn;
    if (options.title) instance.title = options.title;
    if (options.instructions) instance.instructions = options.instructions;
    if (options.acceptedExtensions) instance.acceptedExtensions = options.acceptedExtensions;
    if (options.successMessage) instance.successMessage = options.successMessage;
    if (options.titleLabel) instance.titleLabel = options.titleLabel;
    if (options.titlePlaceholder) instance.titlePlaceholder = options.titlePlaceholder;
    return modalRef;
  }

  readonly dragOver = signal(false);
  /** Value of the optional title field; only read when `titleLabel` is set. */
  readonly fileTitle = signal('');
  readonly titleError = signal<string | null>(null);
  readonly selectedFile = signal<File | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly importing = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly importSummary = signal<ImportSummary | null>(null);
  /** Headline the backend puts above the summary on a rejected import (e.g. "1 record failed."). */
  readonly summaryMessage = signal<string | null>(null);

  /**
   * The result table: every reported row, failures and insertions alike, ordered
   * by row number so it lines up with the uploaded file. Rows without a number
   * sink to the bottom rather than jumping to the top as 0.
   */
  readonly importResultRows = computed<ImportResultRow[]>(() => {
    const summary = this.importSummary();
    if (!summary) return [];

    const rows: ImportResultRow[] = [
      ...(summary.errors ?? []).map((e) => ({ row: e.row, field: e.field, message: e.message, ok: false })),
      ...(summary.successes ?? []).map((s) => ({ row: s.row, message: s.message, ok: true })),
    ];

    return rows.sort((a, b) => (a.row ?? Number.MAX_SAFE_INTEGER) - (b.row ?? Number.MAX_SAFE_INTEGER));
  });

  /** Count of failed rows — drives the alert banner above the result table. */
  readonly errorCount = computed(() => this.importSummary()?.errors?.length ?? 0);

  /**
   * Rows the import actually changed — created, restored or updated. Any of the
   * three means the grid behind the modal is stale and must be refreshed.
   */
  readonly affectedCount = computed(() => {
    const summary = this.importSummary();
    if (!summary) return 0;
    return (summary.created ?? 0) + (summary.restored ?? 0) + (summary.updated ?? 0);
  });

  get acceptAttr(): string {
    return this.acceptedExtensions.map((ext) => `.${ext}`).join(',');
  }

  get acceptLabel(): string {
    return this.acceptedExtensions.map((ext) => ext.toUpperCase()).join(', ');
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.importing()) return;
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (this.importing()) return;
    this.handleFiles(event.dataTransfer?.files ?? null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    this.handleFiles(files);
    input.value = '';
  }

  /** Validates the dropped/selected file (single file, allowed extension) and stages it. */
  private handleFiles(files: FileList | null): void {
    const file = files?.[0] ?? null;
    if (!file) return;

    if ((files?.length ?? 0) > 1) {
      this.fileError.set('Only one file can be uploaded at a time.');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!this.acceptedExtensions.includes(ext)) {
      this.fileError.set(`Unsupported file format.`);
      return;
    }

    this.fileError.set(null);
    this.uploadError.set(null);
    this.importSummary.set(null);
    this.summaryMessage.set(null);
    this.selectedFile.set(file);
  }

  /** Clears the required-title error as soon as the user starts typing. */
  onTitleInput(): void {
    if (this.titleError()) this.titleError.set(null);
  }

  removeFile(): void {
    const modalRef = this.modal.open(DeleteConfirmationComponent, { centered: true });
    const instance = modalRef.componentInstance as DeleteConfirmationComponent;
    instance.title = 'Remove File';
    instance.message = 'Are you sure you want to remove this file?';
    instance.confirmButtonText = 'Remove';
    modalRef.result.then((result) => {
      if (result === 'confirmed') {
        this.selectedFile.set(null);
        this.fileError.set(null);
        this.uploadError.set(null);
        this.importSummary.set(null);
        this.summaryMessage.set(null);
      }
    }, () => {});
  }

  /** Splits a backend message that bundles multiple validation errors (e.g. "Email is required.; Phone is invalid.") into separate lines. */
  splitMessages(message: string): string[] {
    return message
      .split(/\r?\n|;/)
      .map((m) => m.trim())
      .filter((m) => m.length > 0);
  }

  /**
   * Status-chip label for a result row. The backend states the outcome in the
   * row message ("Record restored successfully"), so read it back to tell
   * created / restored / updated rows apart instead of labelling them all
   * "Success". Falls back to "Success" for wording this doesn't recognise.
   */
  statusLabel(result: ImportResultRow): string {
    if (!result.ok) return 'Error';
    const message = (result.message ?? '').toLowerCase();
    if (message.includes('restore')) return 'Restored';
    if (message.includes('updat')) return 'Updated';
    if (message.includes('skip')) return 'Skipped';
    if (message.includes('insert') || message.includes('creat')) return 'Created';
    return 'Success';
  }

  /** Splits a comma-separated field list (e.g. "SERVICE CATEGORY, PROCEDURE CODE") into individual chips. */
  splitFields(field: string): string[] {
    return field
      .split(',')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }



  /**
   * Uploads the staged file via the caller-supplied `uploadFn` and reacts to
   * the outcome: full success closes the modal, partial success (rows
   * created but some skipped/failed) keeps it open to show the error table,
   * and total failure surfaces an error message.
   */
  async doImport(): Promise<void> {
    const file = this.selectedFile();
    if (!file || this.importing()) return;

    // The title field only exists when the caller asked for one, and it's
    // required whenever it does — the import endpoint stores it alongside the file.
    const fileTitle = this.fileTitle().trim();
    if (this.titleLabel) {
      if (!fileTitle) {
        this.titleError.set(`${this.titleLabel} is required.`);
        return;
      }
      this.titleError.set(null);
    }

    this.importing.set(true);
    this.uploadError.set(null);
    this.importSummary.set(null);
    this.summaryMessage.set(null);
    try {
      // Caller-provided upload call — hits whatever backend import endpoint
      // this modal was opened for and returns a row-level success/error summary.
      const res = await this.uploadFn(file, fileTitle);
      const summary = this.extractSummary(res);

      if (res?.status) {
        // A "successful" response can still skip rows. Keep the modal open on
        // that summary so the failed rows aren't lost behind a success toast.
        if (summary?.errors?.length) {
          this.importSummary.set(summary);
          this.summaryMessage.set(res?.message || null);
          if (this.affectedCount() > 0) this.imported.emit();
          return;
        }
        // Clean import — the success toast carries the created / restored /
        // updated breakdown, so there's nothing left to keep the modal open for.
        this.imported.emit();
        this.activeModal.close('imported');
        return;
      }

      if (summary) {
        this.importSummary.set(summary);
        this.summaryMessage.set(this.extractSummaryMessage(res) ?? res?.message ?? null);
        // Rejected overall, but rows may still have been created / restored /
        // updated before the failure — refresh the grid when they were.
        if (this.affectedCount() > 0) this.imported.emit();
        return;
      }

      this.uploadError.set(res?.message || 'Import failed. Please try again.');
    } finally {
      this.importing.set(false);
    }
  }

  /**
   * The summary rides along under `error[0].detail.summary` on a rejected import
   * (older builds put it straight on `error[0].summary`) and in `data` — or
   * `data.summary` — on an accepted one. Accept any of them.
   */
  private extractSummary(res: ApiResponse<any> | null): ImportSummary | null {
    const firstError = Array.isArray(res?.error) ? res!.error[0] : null;
    const detail = firstError?.detail;
    const fromError = (detail && typeof detail === 'object' ? detail.summary : null) ?? firstError?.summary;
    if (this.isSummary(fromError)) return fromError;

    const data = res?.data as any;
    const candidate = data?.summary ?? data;
    return this.isSummary(candidate) ? candidate : null;
  }

  /** Headline that sits beside the summary on a rejected import (`error[0].detail.message`). */
  private extractSummaryMessage(res: ApiResponse<any> | null): string | null {
    const detail = Array.isArray(res?.error) ? res!.error[0]?.detail : null;
    if (typeof detail === 'string') return detail || null;
    if (detail && typeof detail === 'object' && typeof detail.message === 'string') return detail.message || null;
    return null;
  }

  private isSummary(value: any): value is ImportSummary {
    return (
      !!value &&
      typeof value === 'object' &&
      ('total_rows' in value ||
        'created' in value ||
        'restored' in value ||
        'updated' in value ||
        'errors' in value ||
        'successes' in value)
    );
  }

  close(): void {
    this.activeModal.close('closed');
  }

  cancel(): void {
    this.activeModal.dismiss('canceled');
  }
}
