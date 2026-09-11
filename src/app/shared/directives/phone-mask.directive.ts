import { AfterViewInit, Directive, ElementRef, HostListener, OnDestroy, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { Subscription } from 'rxjs';

/**
 * Live US phone mask `(123) 456-7890`, capped at 10 digits. Reformats on input,
 * paste, and whenever the bound control value changes (e.g. an edit form patch).
 * Usage: `<input formControlName="phone" appPhoneMask>`
 */
@Directive({ selector: '[appPhoneMask]', standalone: true })
export class PhoneMaskDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly control = inject(NgControl);

  private subscription?: Subscription;
  private formatting = false;

  /**
   * Wires up mask-on-patch behavior once the host control is attached, and
   * formats any pre-existing value (e.g. edit form loaded with raw digits).
   */
  ngAfterViewInit(): void {
    if (!this.control.control) return;
    // Reformat whenever the form is patched (e.g. edit page fills raw digits).
    this.subscription = this.control.control.valueChanges.subscribe((value) => {
      if (this.formatting) return;
      if (value && !/^\(/.test(value)) {
        this.applyMask();
      }
    });
    // Format any value present at init time.
    setTimeout(() => this.applyMask(), 0);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  @HostListener('input')
  onInput(): void {
    this.applyMask();
  }

  @HostListener('paste')
  onPaste(): void {
    // Defer until after the browser has actually inserted the pasted text
    // into the input's value, otherwise applyMask() would read the stale value.
    setTimeout(() => this.applyMask(), 0);
  }

  /**
   * Strips all non-digit characters (capped at 10), rebuilds the
   * `(123) 456-7890` display string, and pushes it back into both the DOM
   * input and the bound form control.
   */
  private applyMask(): void {
    const input = this.el.nativeElement;
    let digits = (input.value ?? '').toString().replace(/\D/g, '');
    if (digits.length > 10) {
      digits = digits.substring(0, 10);
    }

    let formatted = '';
    if (digits.length > 0) formatted = '(' + digits.substring(0, 3);
    if (digits.length > 3) formatted += ') ' + digits.substring(3, 6);
    if (digits.length > 6) formatted += '-' + digits.substring(6, 10);

    input.value = formatted;
    // Guard flag: setValue() below re-triggers valueChanges, which would
    // otherwise recurse back into the subscription in ngAfterViewInit().
    this.formatting = true;
    this.control.control?.setValue(formatted);
    this.formatting = false;
  }
}
