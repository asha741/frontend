import { Component, signal, WritableSignal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FocusFirstInputDirective } from '../../../core/services/focusFirstInput.directive';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { ConfigService } from '../../../core/config/config.service';
import { ToastService } from '../../../core/services/toast.service';
import { FileUploadService } from '../../../core/services/fileUpload.service';
import { SearchAutocompleteComponent } from '../../../shared/components/search-autocomplete/search-autocomplete.component';
import { DeleteConfirmationComponent } from '../../../shared/components/delete-confirmation/delete-confirmation.component';

/** The three required document categories. */
type DocCategory = 'treatmentPlan' | 'progressNotes' | 'dla20';

@Component({
  selector: 'app-validate-claim',
  standalone: true,
  imports: [ReactiveFormsModule, SearchAutocompleteComponent, FocusFirstInputDirective],
  templateUrl: './validate-claim.html',
  styleUrl: './validate-claim.scss',
})
/**
 * "Submit claim for validation" form. Lets the analyst pick a provider and
 * patient, upload the three required document categories (each file is
 * uploaded to Azure blob storage as soon as it's selected, not deferred to
 * Submit), and then POSTs the claim with the resulting blob URLs.
 *
 * Provider / patient lists are never preloaded — both selects search their POST
 * lookup endpoints as the user types (300ms debounce, 3+ characters).
 */
export class ValidateClaim {
  readonly form: FormGroup;
  readonly isSubmitted = signal(false);
  readonly submitting = signal(false);

  /** Category currently being dragged over (drives the drop-zone highlight). */
  readonly dragOver = signal<DocCategory | null>(null);

  // Selected files per document category.
  readonly treatmentPlanFiles = signal<File[]>([]);
  readonly progressNotesFiles = signal<File[]>([]);
  readonly dla20Files = signal<File[]>([]);

  // Set as soon as a category's file finishes uploading to Azure — before
  // Submit is ever clicked (uploads start right at selection time, same as
  // the claim-import page). Lets removeFile()/cancel() clean up an
  // already-uploaded blob rather than leaving it orphaned in storage.
  readonly treatmentPlanBlob = signal<string | null>(null);
  readonly progressNotesBlob = signal<string | null>(null);
  readonly dla20Blob = signal<string | null>(null);

  // True while a category's file is mid-upload to Azure.
  readonly treatmentPlanUploading = signal(false);
  readonly progressNotesUploading = signal(false);
  readonly dla20Uploading = signal(false);

  /** Exposed so the template can name the lookup endpoints. */
  readonly API_ROUTES = API_ROUTES;

  /** The three required upload categories, rendered as identical cards. */
  readonly categories: { key: DocCategory; title: string }[] = [
    { key: 'treatmentPlan', title: 'Treatment Plan Documents' },
    { key: 'progressNotes', title: 'Progress / Clinical Notes Documents' },
    { key: 'dla20', title: 'DLA 20 Documents' },
  ];

  /** Accepted upload formats (PDF only) and size cap. */
  readonly allowedExtensions = ['pdf'];
  readonly maxFileSize = 25 * 1024 * 1024; // 25 MB

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
      provider_id: ['', Validators.required],
      patient_id: ['', Validators.required],
    });
  }

  get f() {
    return this.form.controls;
  }

  // ── File selection / drag & drop ───────────────────────────────────

  /** Returns the WritableSignal backing the given category. */
  filesFor(category: DocCategory): WritableSignal<File[]> {
    return category === 'treatmentPlan'
      ? this.treatmentPlanFiles
      : category === 'progressNotes'
        ? this.progressNotesFiles
        : this.dla20Files;
  }

  /** Returns the WritableSignal tracking the given category's already-uploaded blob name, if any. */
  private blobFor(category: DocCategory): WritableSignal<string | null> {
    return category === 'treatmentPlan'
      ? this.treatmentPlanBlob
      : category === 'progressNotes'
        ? this.progressNotesBlob
        : this.dla20Blob;
  }

  /** Returns the WritableSignal tracking whether the given category is mid-upload. */
  uploadingFor(category: DocCategory): WritableSignal<boolean> {
    return category === 'treatmentPlan'
      ? this.treatmentPlanUploading
      : category === 'progressNotes'
        ? this.progressNotesUploading
        : this.dla20Uploading;
  }

  /** True while any category still has a file uploading. */
  anyUploading(): boolean {
    return this.treatmentPlanUploading() || this.progressNotesUploading() || this.dla20Uploading();
  }

  /** Returns the Azure blob container the given category uploads into — same containers as before, unchanged. */
  private containerFor(category: DocCategory): string {
    const containers = this.config.claimDocumentContainers;
    return containers[category];
  }

  onFilesSelected(event: Event, category: DocCategory): void {
    const input = event.target as HTMLInputElement;
    void this.addFiles(input.files, category);
    input.value = ''; // reset so re-selecting the same file re-fires change
  }

  onDrop(event: DragEvent, category: DocCategory): void {
    event.preventDefault();
    this.dragOver.set(null);
    void this.addFiles(event.dataTransfer?.files ?? null, category);
  }

  onDragOver(event: DragEvent, category: DocCategory): void {
    event.preventDefault();
    this.dragOver.set(category);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(null);
  }

  /**
   * Validates the selected file (rejecting bad formats / oversize), then
   * uploads it to Azure right away — not deferred until Submit. If the
   * category already had a file (and blob), the old blob is deleted first
   * so replacing a file doesn't leave the previous one orphaned.
   */
  private async addFiles(fileList: FileList | null, category: DocCategory): Promise<void> {
    if (!fileList || !fileList.length) return;
    const target = this.filesFor(category);

    // ── Single-file mode: keep only the first file, replacing any existing. ──
    const file = fileList[0];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!this.allowedExtensions.includes(ext)) {
      this.toast.error(`"${file.name}" is not a supported format. Only PDF files are allowed.`);
      return;
    }
    if (file.size > this.maxFileSize) {
      this.toast.error(`"${file.name}" exceeds the 25MB limit.`);
      return;
    }

    const blobSignal = this.blobFor(category);
    const previousBlob = blobSignal();

    target.set([file]);
    blobSignal.set(null);
    this.uploadingFor(category).set(true);
    try {
      // Uploads the file to the category's Azure blob container; returns the blob name to submit later.
      const blobName = await this.fileUpload.uploadFile(file, this.containerFor(category));
      if (!blobName) {
        this.toast.error(`Failed to upload "${file.name}". Please try again.`);
        target.set([]);
        return;
      }
      blobSignal.set(blobName);

      if (previousBlob) {
        await this.fileUpload.deleteFile(previousBlob, this.containerFor(category));
      }
    } finally {
      this.uploadingFor(category).set(false);
    }

    // ── Multi-file mode (re-enable in future — also restore `multiple` in the template) ──
    // const next = [...target()];
    // for (const file of Array.from(fileList)) {
    //   const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    //   if (!this.allowedExtensions.includes(ext)) {
    //     this.toast.error(`"${file.name}" is not a supported format. Only PDF files are allowed.`);
    //     continue;
    //   }
    //   if (file.size > this.maxFileSize) {
    //     this.toast.error(`"${file.name}" exceeds the 25MB limit.`);
    //     continue;
    //   }
    //   const isDuplicate = next.some((f) => f.name === file.name && f.size === file.size);
    //   if (!isDuplicate) next.push(file);
    // }
    // target.set(next);
  }

  removeFile(category: DocCategory, index: number): void {
    const ref = this.modal.open(DeleteConfirmationComponent, { centered: true });
    ref.componentInstance.title = 'Remove File';
    ref.componentInstance.message =
      'Are you sure you want to remove this file?';
    ref.componentInstance.confirmButtonText = 'Remove';
    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') return;

        // Clean up the now-orphaned blob rather than leaving it in storage.
        const blobSignal = this.blobFor(category);
        const blobName = blobSignal();
        if (blobName) {
          blobSignal.set(null);
          await this.fileUpload.deleteFile(blobName, this.containerFor(category));
        }

        const target = this.filesFor(category);
        target.set(target().filter((_, i) => i !== index));
      },
      () => {},
    );
  }

  // ── Preview helpers ────────────────────────────────────────────────

  /** Font Awesome + colour class for a file's icon, based on its extension. */
  fileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const base = 'ma-preview-file-icon';
    if (ext === 'pdf') return `fa-solid fa-file-pdf ${base} ma-icon-pdf`;
    if (ext === 'docx') return `fa-solid fa-file-word ${base} ma-icon-doc`;
    if (['jpg', 'jpeg', 'png'].includes(ext)) return `fa-solid fa-file-image ${base} ma-icon-image`;
    return `fa-solid fa-file ${base}`;
  }

  /** Human-readable file size (e.g. "1.4 MB"). */


  // ── Submit / cancel ────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    this.isSubmitted.set(true);
    if (this.form.invalid) return;

    // Business rule: at least one document in every required category.
    // Blocks submit; the inline "At least one document is required." messages
    // under each upload zone surface the error (no toast popup).
    if (
      !this.treatmentPlanFiles().length ||
      !this.progressNotesFiles().length ||
      !this.dla20Files().length
    ) {
      return;
    }

    // Every file already uploaded to Azure at selection time — Submit only
    // needs the blob names it got back. If one is still mid-upload (or
    // failed), there's nothing to submit yet.
    if (this.anyUploading()) return;
    const treatment_plan_url = this.treatmentPlanBlob();
    const progress_notes_url = this.progressNotesBlob();
    const dla_20_url = this.dla20Blob();
    if (!treatment_plan_url || !progress_notes_url || !dla_20_url) return;

    this.submitting.set(true);
    try {
      const payload = {
        patient_id: this.form.value.patient_id,
        provider_id: this.form.value.provider_id,
        treatment_plan_url,
        progress_notes_url,
        dla_20_url,
      };

      // Creates the claim from provider/patient ids + already-uploaded document blob URLs.
      const res = await this.api.request('POST', API_ROUTES.SUBMIT_CLAIM, payload);
      if (res?.status) {
        this.router.navigate(['/claim-analyst']);
      } else if (res) {
        this.toast.error(res.message || 'Failed to submit claim.');
      }
    } finally {
      this.submitting.set(false);
    }
  }

  async cancel(): Promise<void> {
    // Files upload to Azure as soon as they're selected, so backing out
    // (with or without ever clicking Submit) can leave blobs behind —
    // clean up whatever was uploaded rather than orphaning it in storage.
    await Promise.all(
      this.categories.map(async ({ key }) => {
        const blobSignal = this.blobFor(key);
        const blobName = blobSignal();
        if (!blobName) return;
        blobSignal.set(null);
        await this.fileUpload.deleteFile(blobName, this.containerFor(key));
      }),
    );
    this.router.navigate(['/claim-analyst']);
  }
}
