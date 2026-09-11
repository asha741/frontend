import { AfterViewInit, Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[appFocusFirstInput]',
  standalone: true,
})
/**
 * Attach to a `<form>` to auto-focus its first input on load, and to
 * re-focus the first invalid field (`.is-invalid`) whenever the form is
 * submitted while invalid — saves each form from wiring this up manually.
 */
export class FocusFirstInputDirective implements AfterViewInit {
  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.focusFirst(true);
  }

  // Fires on every native `submit` of the host form, including a second click
  // while it's still invalid — unlike an @Input trigger, this needs no signal
  // wired up from the component.
  @HostListener('submit')
  onSubmit(): void {
    // Deferred via setTimeout (a macrotask), not queueMicrotask: this listener
    // and the form's own (ngSubmit) → isSubmitted signal → [class.is-invalid]
    // binding update both fire off the same native `submit` event, and their
    // relative order depends on directive/listener registration order. A
    // microtask can still run before Angular finishes that change-detection
    // pass, so `.is-invalid` may not exist in the DOM yet; a macrotask reliably
    // runs after it.
    setTimeout(() => this.focusFirst(false));
  }

  /**
   * Finds and focuses the first `.is-invalid` element. On initial render there's
   * never an invalid field yet, so `fallbackToFirstInput` lets that call still land
   * focus on the first `input`. On submit, no fallback: a valid submit has no
   * `.is-invalid` target, and forcing focus onto the (possibly off-screen, e.g. on
   * a tall form scrolled to the Update button) first input would yank the page's
   * scroll position right as the loading overlay appears.
   */
  private focusFirst(fallbackToFirstInput: boolean): void {
    const target = fallbackToFirstInput
      ? (this.el.nativeElement.querySelector<HTMLElement>('.is-invalid') ??
        this.el.nativeElement.querySelector<HTMLInputElement>('input'))
      : this.el.nativeElement.querySelector<HTMLElement>('.is-invalid');
    target?.focus();
  }
}
