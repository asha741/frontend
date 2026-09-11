import { Directive, HostListener, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

/**
 * Trims leading/trailing whitespace from a free-text field on blur.
 * Usage: `<input formControlName="name" appTrimWhitespace>`
 *
 * Works both ways:
 *  - bound to a form control (`formControlName` / `[(ngModel)]`) → writes the
 *    trimmed value back through the control;
 *  - plain unbound input (no NgControl) → trims the DOM value directly.
 * That makes it safe to put on ANY free-text input, including static markup
 * that has not been wired to a reactive form yet.
 *
 * Do NOT put it on checkboxes / radios / switches, `ngbDatepicker` fields, or
 * `appPhoneMask` inputs — their value is not free text.
 */
@Directive({ selector: '[appTrimWhitespace]', standalone: true })
export class TrimWhitespaceDirective {
  private readonly ngControl = inject(NgControl, { optional: true });

  /**
   * Trims the field's value on blur. When the host has a bound NgControl,
   * writes through `setValue` so validators/dirty-state stay in sync;
   * otherwise falls back to mutating the DOM value directly.
   */
  @HostListener('blur', ['$event'])
  onBlur(event: FocusEvent): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!target) return;

    const trimmed = (target.value ?? '').trim();
    const control = this.ngControl?.control;

    if (control) {
      // Bound case: go through the control so form state (valid/dirty/touched) updates correctly.
      control.setValue(trimmed);
    } else if (target.value !== trimmed) {
      // Unbound case: no control to update, so just fix up the raw DOM value.
      target.value = trimmed;
    }
  }
}
