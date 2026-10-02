import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';

/**
 * One detected clone — the visits it spans and what was found
 * (`CloneNoteResultPairItem`). Unlike Travel Time's visit pairs, every field
 * here is already a display-ready string.
 */
interface CloneNoteResultRow {
  sr_no: number;
  visit_ids: string;
  patient_names: string;
  clone_notes_description: string;
}

/**
 * Clone Notes — Result (per provider).
 *
 * POST /organization/clone-notes/provider-results  { batch_id, provider_name }
 * → { clone_batch_id, provider_name, provider_id, total_notes,
 *     clone_notes_count, clone_notes_percent, results }
 */
@Component({
  selector: 'app-clone-notes-result',
  standalone: true,
  imports: [GridModule, NgbTooltipModule],
  templateUrl: './clone-notes-result.html',
  styleUrl: './clone-notes-result.scss',
})
export class CloneNotesResult implements OnInit {
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
  readonly cloneNotesCount = signal<number>(0);
  /** Sent as a formatted string (e.g. "42%") — shown verbatim. */
  readonly cloneNotesPercent = signal<string>('');

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
      API_ROUTES.GET_CLONE_NOTES_PROVIDER_RESULTS,
      { batch_id: this.batchId(), provider_name: this.providerName() },
      { showToaster: false },
    );

    if (res?.status) {
      const d = res.data ?? {};
      this.batchLabel.set(d?.clone_batch_id ?? '');
      this.providerName.set(d?.provider_name ?? this.providerName());
      this.totalNotes.set(d?.total_notes ?? 0);
      this.cloneNotesCount.set(d?.clone_notes_count ?? 0);
      this.cloneNotesPercent.set(d?.clone_notes_percent ?? '');
      const results: CloneNoteResultRow[] = d?.results ?? [];
      this.resultsGridData.set({ data: results, total: results.length });
    }
    this.loading.set(false);
  }
}
