import { Component, Input, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

/**
 * Generic destructive-action confirmation modal.
 * Open with `NgbModal.open(DeleteConfirmationComponent)`, set inputs on
 * `modalRef.componentInstance`, and read `modalRef.result` which resolves to
 * `'confirmed' | 'canceled' | 'closed'`.
 */
@Component({
  selector: 'app-delete-confirmation',
  standalone: true,
  templateUrl: './delete-confirmation.component.html',
  styleUrl: './delete-confirmation.component.scss',
})
export class DeleteConfirmationComponent {
  readonly activeModal = inject(NgbActiveModal);

  @Input() title = 'Delete Confirmation';
  @Input() message = 'Are you sure you want to delete this record? This action cannot be undone.';
  @Input() confirmButtonText = 'Delete';
  @Input() cancelButtonText = 'Cancel';

  close(): void {
    this.activeModal.close('closed');
  }

  confirmDelete(): void {
    this.activeModal.close('confirmed');
  }

  cancel(): void {
    this.activeModal.close('canceled');
  }
}
