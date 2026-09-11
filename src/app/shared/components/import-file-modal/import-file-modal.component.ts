import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { NgbActiveModal, NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

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
  uploadFn: (file: File) => Promise<ApiResponse<any>>;
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
  templateUrl: './import-file-modal.component.html',
  styleUrl: './import-file-modal.component.scss',
})
export class ImportFileModalComponent {
  readonly activeModal = inject(NgbActiveModal);

  @Input() title = 'Import File';
  @Input() instructions = 'Drag and drop a file here, or click to browse.';
  @Input() acceptedExtensions: string[] = ['csv', 'xlsx'];
  @Input() successMessage = 'File imported successfully.';
  @Input() uploadFn!: (file: File) => Promise<ApiResponse<any>>;

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
    return modalRef;
  }

  readonly dragOver = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly importing = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly importSummary = signal<ImportSummary | null>(null);

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
    this.selectedFile.set(file);
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

    this.importing.set(true);
    this.uploadError.set(null);
    this.importSummary.set(null);
    try {
      // Caller-provided upload call — hits whatever backend import endpoint
      // this modal was opened for and returns a row-level success/error summary.
      const res = await this.uploadFn(file);
      const summary = this.extractSummary(res);

      if (res?.status) {
        // A "successful" response can still skip rows. Keep the modal open on
        // that summary so the failed rows aren't lost behind a success toast.
        if (summary?.errors?.length) {
          this.importSummary.set(summary);
          if ((summary.created ?? 0) > 0) this.imported.emit();
          return;
        }
        this.imported.emit();
        this.activeModal.close('imported');
        return;
      }

      if (summary) {
        this.importSummary.set(summary);
        if ((summary.created ?? 0) > 0) this.imported.emit();
        return;
      }

      this.uploadError.set(res?.message || 'Import failed. Please try again.');
    } finally {
      this.importing.set(false);
    }
  }

  /**
   * The summary rides along in `error[0].summary` on a rejected import and in
   * `data` (or `data.summary`) on an accepted one — accept either.
   */
  private extractSummary(res: ApiResponse<any> | null): ImportSummary | null {
    const fromError = Array.isArray(res?.error) ? res!.error[0]?.summary : null;
    if (fromError) return fromError;

    const data = res?.data as any;
    const candidate = data?.summary ?? data;
    return this.isSummary(candidate) ? candidate : null;
  }

  private isSummary(value: any): value is ImportSummary {
    return (
      !!value &&
      typeof value === 'object' &&
      ('total_rows' in value || 'created' in value || 'errors' in value || 'successes' in value)
    );
  }

  close(): void {
    this.activeModal.close('closed');
  }

  cancel(): void {
    this.activeModal.dismiss('canceled');
  }
}
