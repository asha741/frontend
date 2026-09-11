import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';

/** One side (Visit 1 / Visit 2) of a visit-pair result row. */
interface VisitInfo {
  time?: string;
  patient_name?: string;
  location?: string;
  address?: string;
}

/** One visit-pair row of the Travel Time Result table. */
interface VisitPairResult {
  visit_date?: string;
  visit_ids?: string[] | string;
  patient_names?: string[] | string;
  visit_1?: VisitInfo;
  visit_2?: VisitInfo;
  travel_time_taken?: string;
  actual_time?: string;
  result?: string;
}

/**
 * Travel Time — Justification Result (per provider).
 *
 * POST /organization/travel-time/provider-results  { batch_id, provider_name }
 * → { travel_batch_id, provider_name, provider_id, total_notes, invalid_travel_time, results }
 */
@Component({
  selector: 'app-travel-time-result',
  standalone: true,
  imports: [BadgeClassPipe, GridModule, NgbTooltipModule],
  templateUrl: './travel-time-result.html',
  styleUrl: './travel-time-result.scss',
})
export class TravelTimeResult implements OnInit {
  constructor(
    public api: ApiService,
    public route: ActivatedRoute,
    public router: Router,
    public crypto: CryptoService,
  ) {}

  readonly loading = signal(false);

  readonly batchId = signal<string>('');
  readonly batchLabel = signal<string>('');
  readonly providerName = signal<string>('');
  readonly totalNotes = signal<number>(0);
  readonly invalidTravelTime = signal<number>(0);

  readonly resultsGridData = signal<GridDataResult>({ data: [], total: 0 });

  async ngOnInit(): Promise<void> {
    const encBatchId = this.route.snapshot.paramMap.get('id');
    const encProviderId = this.route.snapshot.paramMap.get('providerId');
    if (!encBatchId || !encProviderId) return;

    let batchId = encBatchId;
    let providerName = encProviderId;
    try {
      batchId = await this.crypto.decryptId(encBatchId);
    } catch {
      // A plain (unencrypted) id in the URL is still usable.
    }
    try {
      providerName = await this.crypto.decryptId(encProviderId);
    } catch {
      // A plain (unencrypted) provider name in the URL is still usable.
    }

    this.batchId.set(batchId);
    this.providerName.set(providerName);
    await this.loadResults();
  }

  async loadResults(): Promise<void> {
    this.loading.set(true);
    const res = await this.api.request(
      'POST',
      API_ROUTES.GET_TRAVEL_TIME_PROVIDER_RESULTS,
      { batch_id: this.batchId(), provider_name: this.providerName() },
      { showToaster: false },
    );

    if (res?.status) {
      const d = res.data ?? {};
      this.batchLabel.set(d?.travel_batch_id ?? '');
      this.providerName.set(d?.provider_name ?? this.providerName());
      this.totalNotes.set(d?.total_notes ?? 0);
      this.invalidTravelTime.set(d?.invalid_travel_time ?? 0);
      const results: VisitPairResult[] = d?.results ?? [];
      this.resultsGridData.set({ data: results, total: results.length });
    }
    this.loading.set(false);
  }

  /** Comma-joined ids/names for the Visit IDs / Patient Names columns — the backend may send an array or an already-comma-joined string. */
  joinValues(values: string[] | string | undefined | null): string {
    if (Array.isArray(values)) return values.filter(Boolean).join(', ') || '-';
    return values || '-';
  }
}
