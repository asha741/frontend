import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';

/** One provider's Extract Data row, as returned by the batch detail endpoint. */
interface ProviderSummaryRow {
  provider_name: string;
  license?: string;
  total_patient: number;
  total_progress_notes: number;
  flag_notes: number | null;
}

/**
 * Travel Time — Batch Detail (read-only).
 *
 * POST /organization/travel-time/detail  { batch_id }
 * → { travel_batch_id, file_name, file_size, file_url, uploaded_at,
 *     extraction_status, travel_time_status, failure_reason, providers_summary }
 */
@Component({
  selector: 'app-travel-time-detail',
  standalone: true,
  imports: [BadgeClassPipe, GridModule, NgbTooltipModule, DatePipe],
  templateUrl: './travel-time-detail.html',
  styleUrl: './travel-time-detail.scss',
})
export class TravelTimeDetail implements OnInit {
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

  readonly batchLabel = computed(() => this.pick(['travel_batch_id']) || this.batchId());
  readonly fileName = computed(() => this.pick(['file_name']));
  readonly fileSize = computed(() => this.pick(['file_size']));
  readonly uploadedAt = computed(() => this.pick(['uploaded_at']));
  readonly extractionStatus = computed(() => this.pick(['extraction_status']));
  readonly travelTimeStatus = computed(() => this.pick(['travel_time_status']));
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
      API_ROUTES.GET_TRAVEL_TIME_DETAIL,
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

  /** The per-provider Result page only opens once travel time validation has finished for the whole batch. */
  canViewResult(): boolean {
    return this.travelTimeStatus().toLowerCase() === 'completed';
  }

  /** Opens the Travel Time Justification – Result page for one provider. */
  async viewProviderResult(row: ProviderSummaryRow): Promise<void> {
    if (!this.canViewResult() || !this.encryptedBatchId) return;
    const encProviderId = await this.crypto.encryptId(String(row?.provider_name ?? ''));
    this.router.navigate(['/travel-time', this.encryptedBatchId, 'detail', 'result', encProviderId]);
  }
}
