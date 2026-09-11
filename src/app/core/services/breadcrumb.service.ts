import { Injectable, signal } from '@angular/core';

/**
 * Lets a page rename its own breadcrumb crumb.
 *
 * The breadcrumb is built from each route's static `data.title`, which cannot
 * know anything that has to be fetched — a batch route can only be labelled
 * "Bulk Upload" up front, not "BCH-2026-025". A page calls `setLabel()` with
 * its own URL once the real name arrives, and the breadcrumb (which reads this
 * signal) re-renders itself.
 *
 * Keyed by URL, so labels for different records never collide and a stale one
 * can never be shown for the wrong record.
 */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  /** Crumb URL → label, replacing that route's `data.title`. */
  readonly labels = signal<Record<string, string>>({});

  /** Override the breadcrumb label shown for `url` (no-op if either arg is empty). */
  setLabel(url: string, label: string): void {
    if (!url || !label) return;
    // Guard against re-writing the same value — the batch page polls every few
    // seconds and would otherwise re-render the breadcrumb on every poll.
    if (this.labels()[url] === label) return;
    this.labels.set({ ...this.labels(), [url]: label });
  }
}
