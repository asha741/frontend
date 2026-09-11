import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TrimWhitespaceDirective } from '../../directives/trim-whitespace.directive';

/**
 * Status-change confirmation modal with an optional (optionally required) reason.
 * Open with `NgbModal.open(StatusConfirmationComponent)`, set inputs on
 * `modalRef.componentInstance`, read `modalRef.result` (`'confirmed' | 'canceled' | 'closed'`)
 * and, when confirmed, `modalRef.componentInstance.reason`.
 */
@Component({
  selector: 'app-status-confirmation',
  standalone: true,
  imports: [FormsModule, TrimWhitespaceDirective],
  templateUrl: './status-confirmation.component.html',
  styleUrl: './status-confirmation.component.scss',
})
export class StatusConfirmationComponent {
  readonly activeModal = inject(NgbActiveModal);

  @Input() title = 'Confirm Status Change';
  @Input() message = 'Are you sure you want to change the status of this record?';
  @Input() confirmButtonText = 'Confirm';
  @Input() cancelButtonText = 'Cancel';
  @Input() reasonLabel = 'Reason';
  @Input() remarkVisible = false;
  @Input() isRequiredReason = false;
  @Input() reason: string | null = null;

  showReasonError = false;

  close(): void {
    this.activeModal.close('closed');
  }

  /**
   * Confirms the action, unless a reason is both visible and required but
   * left blank — in that case it blocks the close and surfaces the inline
   * validation error instead.
   */
  confirm(): void {
    if (this.isRequiredReason && this.remarkVisible && !this.reason?.trim()) {
      this.showReasonError = true;
      return;
    }
    this.showReasonError = false;
    this.activeModal.close('confirmed');
  }

  cancel(): void {
    this.activeModal.close('canceled');
  }
}
