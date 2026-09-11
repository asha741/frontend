import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { ConfigService } from '../../../core/config/config.service';
import { FileUploadService } from '../../../core/services/fileUpload.service';
import { DeleteConfirmationComponent } from '../../../shared/components/delete-confirmation/delete-confirmation.component';

const ALLOWED_EXTENSIONS = ['pdf'];

/** Supported file size cap for a single Progress Notes upload. */
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Travel Time — Upload Notes / Submit flow.
 *
 * POST /organization/travel-time/upload-process   { file_name } → { batch_id }
 *   Kicks off processing on the backend; the response's toaster message
 *   confirms it, and this page returns straight to the listing.
 */
@Component({
  selector: 'app-travel-time-form',
  standalone: true,
  imports: [],
  templateUrl: './travel-time-form.html',
  styleUrl: './travel-time-form.scss',
})
export class TravelTimeForm {
  constructor(
    public api: ApiService,
    public router: Router,
    public config: ConfigService,
    public fileUpload: FileUploadService,
    public modal: NgbModal,
  ) {}

  readonly allowedExtensions = ALLOWED_EXTENSIONS;

  // ── Upload Documents — the file uploads to Azure as soon as it's
  // selected/dropped, not deferred until Submit. ─────────────────────
  readonly fileName = signal<string | null>(null);
  private blobName: string | null = null;
  readonly uploading = signal(false);
  readonly fileError = signal<string | null>(null);
  readonly dragOver = signal(false);

  // ── Submit ────────────────────────────────────────────────────────
  readonly submitting = signal(false);

  // ── Upload Documents: drag & drop / browse ─────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.fileName()) return;
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (this.fileName()) return;
    void this.addFile(event.dataTransfer?.files ?? null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (this.fileName()) {
      input.value = '';
      return;
    }
    void this.addFile(input.files);
    input.value = '';
  }

  /** Validates the selected file, then uploads it to Azure right away — not deferred until Submit. */
  private async addFile(fileList: FileList | null): Promise<void> {
    if (!fileList?.length) return;
    const file = fileList[0];

    this.fileError.set(null);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!this.allowedExtensions.includes(ext)) {
      this.fileError.set(`"${file.name}" is not a supported format. Only PDF files are allowed.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.fileError.set('This file exceeds the maximum supported size of 2 GB.');
      return;
    }

    this.fileName.set(file.name);
    this.uploading.set(true);
    try {
      const blobName = await this.fileUpload.uploadFile(file, this.config.claimDocumentContainers.progressNotes);
      if (!blobName) {
        this.fileError.set(`Failed to upload "${file.name}". Please try again.`);
        this.fileName.set(null);
        return;
      }
      this.blobName = blobName;
    } finally {
      this.uploading.set(false);
    }
  }

  /** The document can only be removed before Submit has been run. */
  removeFile(): void {
    if (this.submitting() || this.uploading()) return;

    const ref = this.modal.open(DeleteConfirmationComponent, { centered: true });
    ref.componentInstance.title = 'Remove File';
    ref.componentInstance.message = 'Are you sure you want to remove this file?';
    ref.componentInstance.confirmButtonText = 'Remove';
    ref.result.then(
      async (result: string) => {
        if (result !== 'confirmed') return;
        if (this.blobName) {
          await this.fileUpload.deleteFile(this.blobName, this.config.claimDocumentContainers.progressNotes);
          this.blobName = null;
        }
        this.fileName.set(null);
      },
      () => {},
    );
  }

  // ── Submit ────────────────────────────────────────────────────────

  /** Sends the uploaded blob name to the upload-process endpoint, then returns to the listing. */
  async onSubmit(): Promise<void> {
    if (!this.blobName || this.submitting() || this.uploading()) return;

    this.submitting.set(true);
    try {
      const res = await this.api.request(
        'POST',
        API_ROUTES.TRAVEL_TIME_UPLOAD_PROCESS,
        { file_name: this.blobName },
        { showToaster: true },
      );
      if (res?.status) {
        this.router.navigate(['/travel-time']);
      }
    } finally {
      this.submitting.set(false);
    }
  }

  /** Discards an uploaded file that was never submitted, then returns to the listing. */
  async cancel(): Promise<void> {
    if (this.blobName) {
      await this.fileUpload.deleteFile(this.blobName, this.config.claimDocumentContainers.progressNotes);
    }
    this.router.navigate(['/travel-time']);
  }
}
