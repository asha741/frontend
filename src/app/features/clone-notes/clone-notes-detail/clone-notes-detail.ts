import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';

/** One provider's Extract Data row (`ExtractDataProviderSummaryItem`). */
interface ProviderSummaryRow {
  sr_no: number;
  provider_name: string;
  provider_license: string;
  provider_id: string | null;
  total_patient: number;
  total_progress_notes: number;
  /** Sent as a formatted string (e.g. "42%") — shown verbatim. */
  clone_notes_percent: string;
  page_numbers: number[];
  /** The page list already formatted for display (e.g. "3, 7-9"). */
  page_numbers_display: string;
  action_accessible: boolean;
}

/**
 * Clone Notes — Batch Detail (read-only).
 *
 * POST /organization/clone-notes/detail  { batch_id }
 * → { clone_batch_id, file_name, file_size, file_url, uploaded_at,
 *     extraction_status, clone_notes_status, failure_reason, providers_summary }
 */
@Component({
  selector: 'app-clone-notes-detail',
  standalone: true,
  imports: [BadgeClassPipe, GridModule, NgbTooltipModule, DatePipe],
  templateUrl: './clone-notes-detail.html',
  styleUrl: './clone-notes-detail.scss',
})
export class CloneNotesDetail implements OnInit {
  constructor(
    public api: ApiService,
    public route: ActivatedRoute,
    public router: Router,
    public crypto: CryptoService,
  ) {}

  readonly loading = signal(false);

  readonly batchId = signal<string>('');
  readonly batchInfo = signal<Record<string, any>>({});

  /** The id exactly as it sits in the URL — reused when linking to the result sub-page. */
  private encryptedBatchId = '';

  /**
   * The human-readable batch reference. Deliberately NOT falling back to the
   * raw id: until the detail response lands this is empty and the heading
   * reads just 'Batch Detail', rather than flashing the internal UUID.
   */
  readonly batchLabel = computed(() => this.pick(['clone_batch_id']));
  readonly fileName = computed(() => this.pick(['file_name']));
  readonly fileSize = computed(() => this.pick(['file_size']));
  readonly uploadedAt = computed(() => this.pick(['uploaded_at']));
  readonly extractionStatus = computed(() => this.pick(['extraction_status']));
  readonly cloneNotesStatus = computed(() => this.pick(['clone_notes_status']));
  readonly failureReason = computed(() => this.pick(['failure_reason']));

  readonly providersGridData = signal<GridDataResult>({ data: [], total: 0 });

  async ngOnInit(): Promise<void> {
    const encId = this.route.snapshot.paramMap.get('id');
    if (!encId) return;

    this.encryptedBatchId = encId;
    let batchId = encId;
    try {
      batchId = await this.crypto.decryptId(encId);
    } catch {
      // A plain (unencrypted) id in the URL is still usable.
    }
    this.batchId.set(batchId);
    await this.loadDetail();
  }

  async loadDetail(): Promise<void> {
    this.loading.set(true);
    const res = await this.api.request(
      'POST',
      API_ROUTES.GET_CLONE_NOTES_DETAIL,
      { batch_id: this.batchId() },
      { showToaster: false },
    );

    if (res?.status) {
      const d = res.data ?? {};
      this.batchInfo.set(d);
      const providers: ProviderSummaryRow[] = d?.providers_summary ?? [];
      this.providersGridData.set({ data: providers, total: providers.length });
    }
    this.loading.set(false);
  }

  /** First non-empty value among `batchInfo`'s candidate keys. */
  private pick(keys: string[]): string {
    const info = this.batchInfo();
    for (const key of keys) {
      const value = info?.[key];
      if (value !== null && value !== undefined && value !== '') return String(value);
    }
    return '';
  }

  /** True when a status value should show the failure-reason info icon. */
  isFailedStatus(status: string): boolean {
    return (status ?? '').toLowerCase() === 'failed';
  }

  /** The per-provider Result page only opens once clone notes validation has finished for the whole batch. */
  canViewResult(): boolean {
    return this.cloneNotesStatus().toLowerCase() === 'completed';
  }

  /** A row opens only when the batch is done AND the backend marks it accessible. */
  canViewRow(row: ProviderSummaryRow): boolean {
    return this.canViewResult() && !!row?.action_accessible;
  }

  /**
   * Opens the Clone Notes – Result page for one provider. The results endpoint
   * keys on `provider_name`, so that — not `provider_id` — is what travels
   * in the URL.
   */
  async viewProviderResult(row: ProviderSummaryRow): Promise<void> {
    if (!this.canViewRow(row) || !this.encryptedBatchId) return;
    const encProviderId = await this.crypto.encryptId(String(row?.provider_name ?? ''));
    this.router.navigate(['/clone-notes', this.encryptedBatchId, 'detail', 'result', encProviderId]);
  }
}
