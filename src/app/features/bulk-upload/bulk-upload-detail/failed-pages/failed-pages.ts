import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../../core/services/api.service';
import { API_ROUTES } from '../../../../core/constants/api-routes';
import { CryptoService } from '../../../../core/services/crypto.service';
import { BreadcrumbService } from '../../../../core/services/breadcrumb.service';
import type { BatchDocument, FailedPage } from '../bulk-upload-detail';

const emptyState = (): State => ({ skip: 0, take: 10, sort: [], filter: { logic: 'and', filters: [] } });

/**
 * Where the batch's `documents[]` is read from. Both endpoints return the same
 * document shape, but a batch that is still being extracted only exists on the
 * status endpoint, while a submitted one is read from the detail endpoint — so
 * the route says which one applies.
 */
type FailedPagesSource = 'status' | 'detail';

/**
 * Bulk Upload — Failed Pages Reason (read-only).
 *
 * Reached from the Documents tab's eye icon on either Bulk Upload page, for a
 * document that reported `pages_failed > 0`. There is no per-document endpoint,
 * so this re-reads the batch (the same call its parent page made) and picks the
 * one document out by its `sr_no` — the same approach the claim-analyst Failed
 * Notes page takes. That keeps the page deep-linkable and refresh-safe instead
 * of depending on router state handed over from the parent.
 */
@Component({
  selector: 'app-failed-pages',
  standalone: true,
  imports: [GridModule, NgbTooltipModule],
  templateUrl: './failed-pages.html',
  styleUrl: './failed-pages.scss',
})
export class FailedPages implements OnInit {
  constructor(
    public api: ApiService,
    public route: ActivatedRoute,
    public crypto: CryptoService,
    public crumbLabels: BreadcrumbService,
  ) {}

  readonly pageSizes = [10, 25, 50];
  readonly loading = signal(false);

  readonly document = signal<BatchDocument | null>(null);
  readonly documentName = computed(() => this.document()?.document_name ?? '');
  readonly pagesFailed = computed(() => this.document()?.pages_failed ?? 0);

  private allFailedPages: FailedPage[] = [];
  pagesState: State = emptyState();
  readonly pagesGridData = signal<GridDataResult>({ data: [], total: 0 });

  private batchId = '';
  private encryptedBatchId = '';
  private documentSrNo: number | null = null;

  /** Decrypts the batch and document ids from the route, then loads the failed-pages breakdown. */
  async ngOnInit(): Promise<void> {
    // `:id` lives on the componentless parent route, so it is inherited here.
    const encBatchId = this.route.snapshot.paramMap.get('id');
    const encDocId = this.route.snapshot.paramMap.get('docId');
    if (!encBatchId || !encDocId) return;

    this.encryptedBatchId = encBatchId;
    this.batchId = await this.decryptParam(encBatchId);
    this.documentSrNo = Number(await this.decryptParam(encDocId));
    await this.loadFailedPages();
  }

  /** A plain (unencrypted) id in the URL is still usable. */
  private async decryptParam(value: string): Promise<string> {
    try {
      return await this.crypto.decryptId(value);
    } catch {
      return value;
    }
  }

  /**
   * Re-fetches the whole batch (status or detail endpoint, per route data) and picks out
   * the one document by `sr_no` to read its `failed_pages[]`.
   */
  async loadFailedPages(): Promise<void> {
    if (!this.batchId || this.documentSrNo === null) return;

    const source: FailedPagesSource = this.route.snapshot.data['source'] === 'status' ? 'status' : 'detail';
    const endpoint =
      source === 'status' ? API_ROUTES.BULK_UPLOAD_STATUS : API_ROUTES.GET_BULK_UPLOAD_BATCH_DETAIL;

    this.loading.set(true);
    // Returns the full batch (including documents[]); no per-document endpoint exists.
    const res = await this.api.request(
      'POST',
      endpoint,
      { batch_id: this.batchId },
      { showToaster: false },
    );

    if (res?.status) {
      const documents: BatchDocument[] = res.data?.documents ?? [];
      const match = documents.find((doc) => Number(doc?.sr_no) === this.documentSrNo) ?? null;
      this.document.set(match);
      this.allFailedPages = match?.failed_pages ?? [];
      this.applyPagesPage();

      // Landing here directly (refresh / deep link) leaves the parent batch
      // crumb unnamed, since the page that names it was never mounted. The
      // batch code sits at the top level on status, nested on detail.
      const batchCode = res.data?.batch_code ?? res.data?.batch_information?.batch_code ?? '';
      this.crumbLabels.setLabel(`/bulk-upload/${this.encryptedBatchId}`, batchCode);
    }
    this.loading.set(false);
  }

  onPagesStateChange(state: DataStateChangeEvent): void {
    this.pagesState = state;
    this.applyPagesPage();
  }

  /** The whole batch arrives in one response, so this grid pages in the browser. */
  private applyPagesPage(): void {
    const skip = this.pagesState.skip ?? 0;
    const take = this.pagesState.take ?? 10;
    this.pagesGridData.set({
      data: this.allFailedPages.slice(skip, skip + take),
      total: this.allFailedPages.length,
    });
  }
}
