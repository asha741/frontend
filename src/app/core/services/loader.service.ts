import { Injectable, computed, signal } from '@angular/core';

/**
 * Global loading indicator. Reference-counted so overlapping requests keep the
 * overlay visible until the last one finishes. Signal-based (modern replacement
 * for the reference app's BehaviorSubject LoaderService).
 */
@Injectable({ providedIn: 'root' })
export class LoaderService {
  private readonly count = signal(0);

  /** True while at least one operation is in flight. */
  readonly loading = computed(() => this.count() > 0);

  show(): void {
    this.count.update((c) => c + 1);
  }

  hide(): void {
    this.count.update((c) => Math.max(0, c - 1));
  }

  reset(): void {
    this.count.set(0);
  }
}
