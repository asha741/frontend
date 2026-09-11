import { ChangeDetectorRef, Injectable } from '@angular/core';

export interface ToastInfo {
  header?: string;
  body: string;
  classname?: string;
  delay?: number;
}

/**
 * App-wide toast/notification queue. Components push toasts via the
 * `success`/`error`/`info`/`warning` helpers; the toast container component
 * renders whatever is currently in `toasts` and registers itself via
 * `registerChangeDetector` so this service can force a re-render on OnPush
 * components when the queue changes.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts: ToastInfo[] = [];
  private cdr?: ChangeDetectorRef;

  /** Lets the (typically OnPush) toast container opt in to manual change detection. */
  registerChangeDetector(cdr: ChangeDetectorRef) {
    this.cdr = cdr;
  }

  /** Marks the registered container for check — needed because mutating `toasts` in place won't trigger OnPush on its own. */
  triggerChange() {
    if (this.cdr) {
      this.cdr.markForCheck();
    }
  }

  /** Pushes a toast and schedules its auto-dismissal (unless `delay` is 0/negative, meaning "stay until dismissed"). */
  private show(body: string, options: Partial<ToastInfo> = {}) {
    const toast: ToastInfo = { body, ...options };
    this.toasts.push(toast);
    this.triggerChange();
    const delay = options.delay ?? 10000; // Default delay of 10 seconds
    if (delay > 0) {
      setTimeout(() => this.remove(toast), delay);
    }
  }

  // The four methods below are thin convenience wrappers around `show()`,
  // each pinning the header default and Bootstrap contextual class for that
  // toast style.

  success(body: string, header?: string, delay?: number) {
    this.show(body, {
      header: header ?? 'Success',
      classname: 'bg-success text-white',
      delay,
    });
  }

  error(body: string, header?: string, delay?: number) {
    this.show(body, {
      header: header ?? 'Error',
      classname: 'bg-danger text-white',
      delay,
    });
  }

  info(body: string, header?: string, delay?: number) {
    this.show(body, {
      header: header ?? 'Info',
      classname: 'bg-info text-white',
      delay,
    });
  }

  warning(body: string, header?: string, delay?: number) {
    this.show(body, {
      header: header ?? 'Warning',
      classname: 'bg-warning text-dark',
      delay,
    });
  }

  remove(toast: ToastInfo) {
    this.toasts = this.toasts.filter(t => t !== toast);
    this.triggerChange();
  }

  clear() {
    this.toasts = [];
    this.triggerChange();
  }
}
