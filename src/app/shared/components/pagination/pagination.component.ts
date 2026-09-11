import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Pagination } from '../../../core/services/api.service';

@Component({
  selector: 'app-pagination',
  standalone: true,
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
})
/**
 * Presentational pagination control. Renders a page-number strip from the
 * `pagination` metadata handed in by the parent (which owns the actual data
 * fetch) and emits `pageChange` when the user picks a different page.
 */
export class PaginationComponent {
  @Input() pagination: Pagination | null = null;
  @Output() pageChange = new EventEmitter<number>();

  /** Index (1-based, inclusive) of the last item shown on the current page, capped at `totalItems`. */
  endItem(p: Pagination): number {
    return Math.min(p.currentPage * p.pageSize, p.totalItems);
  }

  /**
   * Page numbers to render as clickable links: a window of up to `delta`
   * pages on either side of the current page, clamped to the valid range.
   */
  get pages(): number[] {
    if (!this.pagination) return [];
    const { currentPage, totalPages } = this.pagination;
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, currentPage - delta); i <= Math.min(totalPages, currentPage + delta); i++) {
      range.push(i);
    }
    return range;
  }

  /** Emits the requested page to the parent, ignoring out-of-range clicks (e.g. from stale UI state). */
  changePage(page: number): void {
    if (!this.pagination) return;
    if (page >= 1 && page <= this.pagination.totalPages) {
      this.pageChange.emit(page);
    }
  }
}
