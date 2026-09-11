import { Component, Input, inject, signal } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

export interface MediaAttachment {
  isImage?: boolean;
  fileName?: string;
  originalName?: string;
  [key: string]: unknown;
}

/**
 * Extra-large carousel modal for previewing image/video attachments with a
 * download action. Open via the static `MediaPreviewModalComponent.open(...)` factory.
 */
@Component({
  selector: 'app-media-preview-modal',
  standalone: true,
  templateUrl: './media-preview-modal.component.html',
  styleUrl: './media-preview-modal.component.scss',
})
export class MediaPreviewModalComponent {
  private readonly activeModal = inject(NgbActiveModal);

  @Input() attachments: MediaAttachment[] = [];
  @Input() title = 'Media';
  @Input() attachmentPathKey = 'attachmentFullPath';

  readonly selectedIndex = signal(0);

  /** Opens the modal via `NgbModal` and pre-populates its inputs, returning the resulting `NgbModalRef`. */
  static open(
    modalService: NgbModal,
    attachments: MediaAttachment[],
    options: { title?: string; attachmentPathKey?: string; startIndex?: number } = {},
  ) {
    const modalRef = modalService.open(MediaPreviewModalComponent, {
      keyboard: false,
      backdrop: 'static',
      size: 'xl',
      centered: true,
      scrollable: false,
    });
    const instance = modalRef.componentInstance as MediaPreviewModalComponent;
    instance.attachments = attachments;
    if (options.title) instance.title = options.title;
    if (options.attachmentPathKey) instance.attachmentPathKey = options.attachmentPathKey;
    if (options.startIndex != null) instance.selectedIndex.set(options.startIndex);
    return modalRef;
  }

  close(): void {
    this.activeModal.close('close');
  }

  /** Jumps the carousel directly to the given attachment index (e.g. from a thumbnail strip). */
  select(index: number): void {
    this.selectedIndex.set(index);
  }

  /** Steps back one attachment, wrapping around to the last one from the first. */
  previous(): void {
    this.selectedIndex.update((i) => (i > 0 ? i - 1 : this.attachments.length - 1));
  }

  /** Steps forward one attachment, wrapping around to the first one from the last. */
  next(): void {
    this.selectedIndex.update((i) => (i < this.attachments.length - 1 ? i + 1 : 0));
  }

  /**
   * Resolves the media URL for an attachment, trying the configured
   * `attachmentPathKey` first and falling back to the two field names used by
   * older/other API responses before giving up on an empty string.
   */
  getPath(attachment: MediaAttachment): string {
    return (
      (attachment?.[this.attachmentPathKey] as string) ??
      (attachment?.['attachmentFullPath'] as string) ??
      (attachment?.['fullURL'] as string) ??
      ''
    );
  }

  /**
   * Downloads the currently selected attachment by fetching its bytes and
   * triggering a save via a temporary, invisible `<a download>` link — needed
   * because the file lives on a remote URL, so a plain anchor `download`
   * attribute alone wouldn't force a save (cross-origin navigation instead).
   */
  async downloadFile(): Promise<void> {
    const attachment = this.attachments[this.selectedIndex()];
    const url = this.getPath(attachment);
    if (!url) return;
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = attachment?.fileName || attachment?.originalName || 'media';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    // Deferred cleanup: some browsers need the link to remain in the DOM
    // briefly after the click for the download to actually start.
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    }, 100);
  }
}
