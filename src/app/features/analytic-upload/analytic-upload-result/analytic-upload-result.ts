import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';
import {
  ImportResultRow,
  ImportSummary,
} from '../../../shared/components/import-file-modal/import-file-modal.component';

/** `GET_POWERBI_RESULT` response `data` — the row-level summary plus server-side pagination over the combined errors/successes list. */
interface PowerBiResultSummary extends ImportSummary {
  pagination?: {
    current_page?: number;
    total_pages?: number;
    total_records?: number;
  };
}

const emptyState = (): State => ({
  skip: 0,
  take: 10,
  sort: [],
  filter: { logic: 'and', filters: [] },
});

@Component({
  selector: 'app-analytic-upload-result',
  standalone: true,
  imports: [GridModule],
  templateUrl: './analytic-upload-result.html',
  styleUrl: './analytic-upload-result.scss',
})
export class AnalyticUploadResult implements OnInit {
  constructor(
    public api: ApiService,
    public route: ActivatedRoute,
    public crypto: CryptoService,
  ) {}

  readonly loading = signal(false);
  readonly summary = signal<PowerBiResultSummary | null>(null);
  readonly loadError = signal<string | null>(null);

  readonly pageSizes = [10, 25, 50];
  state: State = emptyState();
  readonly resultGridData = signal<GridDataResult>({ data: [], total: 0 });

  private id = '';

  async ngOnInit(): Promise<void> {
    const encId = this.route.snapshot.paramMap.get('id');
    if (!encId) return;

    let id = encId;
    try {
      id = await this.crypto.decryptId(encId);
    } catch {
      // A plain (unencrypted) id in the URL is still usable.
    }

    this.id = id;
    await this.loadResult();
  }

  /** POST /organization/powerbi/result — { id, page, limit }; the response page's errors/successes become one page of rows. */
  async loadResult(): Promise<void> {
    if (!this.id) return;

    const take = this.state.take && this.state.take > 0 ? this.state.take : 10;
    const page = Math.floor((this.state.skip ?? 0) / take) + 1;

    const res = await this.api.request(
      'POST',
      API_ROUTES.GET_POWERBI_RESULT,
      { id: this.id, page, limit: take },
      { showToaster: false },
    );

    if (res?.status) {
      const data = (res.data ?? null) as PowerBiResultSummary | null;
      this.summary.set(data);

      const rows: ImportResultRow[] = [
        ...(data?.errors ?? []).map((e) => ({
          row: e.row,
          field: e.field,
          message: e.message,
          ok: false,
        })),
        ...(data?.successes ?? []).map((s) => ({ row: s.row, message: s.message, ok: true })),
      ].sort((a, b) => (a.row ?? Number.MAX_SAFE_INTEGER) - (b.row ?? Number.MAX_SAFE_INTEGER));

      this.resultGridData.set({
        data: rows,
        total: data?.pagination?.total_records ?? rows.length,
      });
      return;
    }

    const detail = Array.isArray(res?.error) ? res!.error[0]?.detail : null;
    this.loadError.set(
      (typeof detail === 'string' && detail) || res?.message || 'Unable to load the import result.',
    );
  }

  async onGridStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.loadResult();
  }

  /** Splits a backend message that bundles multiple lines (e.g. "Email is required.; Phone is invalid.") into separate lines. */
  splitMessages(message: string): string[] {
    return message
      .split(/\r?\n|;/)
      .map((m) => m.trim())
      .filter((m) => m.length > 0);
  }

  /** Splits a comma-separated field list (e.g. "SERVICE CATEGORY, PROCEDURE CODE") into individual chips. */
  splitFields(field: string): string[] {
    return field
      .split(',')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  statusLabel(result: ImportResultRow): string {
    if (!result.ok) return 'Error';
    const message = (result.message ?? '').toLowerCase();
    if (message.includes('restore')) return 'Restored';
    if (message.includes('updat')) return 'Updated';
    if (message.includes('skip')) return 'Skipped';
    if (message.includes('insert') || message.includes('creat')) return 'Created';
    return 'Success';
  }
}
