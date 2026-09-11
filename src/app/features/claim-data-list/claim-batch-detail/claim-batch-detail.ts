import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { ChartsModule } from '@progress/kendo-angular-charts';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { toISOStartOfDay } from '../../../core/utils/date.util';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { ToastService } from '../../../core/services/toast.service';
import { LoaderService } from '../../../core/services/loader.service';
import { ConfigService } from '../../../core/config/config.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { FilterAndSortingService } from '../../../core/services/common-filter-sort.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../../core/constants/permissions';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';
import { CustomDropDownListFilterComponent } from '../../../core/services/dropdownfilter.component';
import dayjs from 'dayjs';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';

type TabKey = 'analysis' | 'claim-data' | 'consecutive-days';

interface ChartValue {
  label: string;
  value: number;
}

interface PaymentStatusByServiceType {
  service_type: string;
  paid: number;
  pending: number;
  denied: number;
}

interface ConsecutiveDayPreviewItem {
  provider_name: string;
  provider_id: string;
  license: string;
  working_streak: number;
  active_working_days: number;
  max_consecutive_streak: number;
  threshold: number;
  status: string;
  is_flagged: boolean;
}

interface ClaimAnalytics {
  id: string;
  file_title: string;
  year: string;
  month: string;
  uploaded_at: string;
  total_providers: number;
  total_claims: number;
  total_patients: number;
  total_paid: number;
  total_pending: number;
  total_denied: number;
  provider_session_volume: ChartValue[];
  session_duration_distribution: ChartValue[];
  payment_status_by_service_type: PaymentStatusByServiceType[];
  consecutive_day_preview: ConsecutiveDayPreviewItem[];
  ai_insights?: string | null;
}

interface ProviderStreakItem {
  provider_name: string;
  provider_id: string;
  license: string;
  working_streak: number;
  active_working_days: number;
  max_consecutive_streak: number;
  threshold: number;
  status: string;
  is_flagged: boolean;
}

interface ConsecutiveDayAnalysis {
  file_name: string;
  month: string;
  year: string;
  consecutive_day_threshold: number;
  total_providers: number;
  flagged_providers: number;
  max_consecutive_streak: number;
  providers: ProviderStreakItem[];
  ai_insights?: string | null;
}

/**
 * Claim batch detail — Analysis / Claim Data / Consecutive Days tabs for one
 * uploaded claim batch. Each tab is lazy-loaded on first activation; the
 * Analysis tab's response also supplies the page header (file title/year/month),
 * since there is no separate "get batch by id" endpoint.
 */
@Component({
  selector: 'app-claim-batch-detail',
  standalone: true,
  imports: [
    BadgeClassPipe,
    GridModule,
    ChartsModule,
    FormsModule,
    DatePipe,
    NgbTooltipModule,
    TrimWhitespaceDirective,
    CustomDropDownListFilterComponent,
  ],
  templateUrl: './claim-batch-detail.html',
  styleUrl: './claim-batch-detail.scss',
})
export class ClaimBatchDetail implements OnInit {
  constructor(
    public api: ApiService,
    public route: ActivatedRoute,
    public router: Router,
    public toast: ToastService,
    public crypto: CryptoService,
    public loader: LoaderService,
    public config: ConfigService,
    public filterSort: FilterAndSortingService,
    public perms: PermissionService,
  ) {}

  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  batchId: string | null = null;
  encryptedBatchId: string | null = null;

  readonly activeTab = signal<TabKey>('analysis');
  readonly exporting = signal(false);

  private claimDataLoaded = false;
  private consecutiveDaysLoaded = false;

  // ── Analysis tab ─────────────────────────────────────────────────
  readonly analytics = signal<ClaimAnalytics | null>(null);

  readonly sessionVolumeCategories = computed(() => this.analytics()?.provider_session_volume.map((c) => c.label) ?? []);
  readonly sessionVolumeSeries = computed(() => this.analytics()?.provider_session_volume.map((c) => c.value) ?? []);
  readonly sessionVolumeChartWidth = computed(() => this.categorySlotWidth(this.sessionVolumeCategories()));

  readonly durationDistribution = computed(() => this.analytics()?.session_duration_distribution ?? []);
  readonly durationCategories = computed(() => this.analytics()?.session_duration_distribution.map((c) => c.label) ?? []);
  readonly durationSeries = computed(() => this.analytics()?.session_duration_distribution.map((c) => c.value) ?? []);

  readonly serviceTypeCategories = computed(() => this.analytics()?.payment_status_by_service_type.map((c) => c.service_type) ?? []);
  readonly paidByServiceType = computed(() => this.analytics()?.payment_status_by_service_type.map((c) => c.paid) ?? []);
  readonly pendingByServiceType = computed(() => this.analytics()?.payment_status_by_service_type.map((c) => c.pending) ?? []);
  readonly deniedByServiceType = computed(() => this.analytics()?.payment_status_by_service_type.map((c) => c.denied) ?? []);
  readonly serviceTypeChartWidth = computed(() => this.categorySlotWidth(this.serviceTypeCategories()));

  readonly consecutiveDayPreview = computed(() => this.analytics()?.consecutive_day_preview ?? []);

  // ── Claim Data tab ───────────────────────────────────────────────
  readonly claimRecordsData = signal<GridDataResult>({ data: [], total: 0 });
  readonly pageSizes = [10, 25, 50];
  claimRecordsState: State = { skip: 0, take: 10, sort: [], filter: { logic: 'and', filters: [] } };

  claimSearch = '';
  claimLocation = '';

  paymentStatusOptions: { label: string; value: string }[] = [];
  claimStatusOptions: { label: string; value: string }[] = [];

  // ── Consecutive Days tab ─────────────────────────────────────────
  readonly consecutiveDays = signal<ConsecutiveDayAnalysis | null>(null);
  readonly consecutiveDaysData = signal<GridDataResult>({ data: [], total: 0 });
  private allProviderStreaks: ProviderStreakItem[] = [];
  consecutiveDaysState: State = { skip: 0, take: 10, sort: [], filter: { logic: 'and', filters: [] } };

  async ngOnInit(): Promise<void> {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;

    this.encryptedBatchId = idParam;
    try {
      this.batchId = await this.crypto.decryptId(idParam);
    } catch {
      this.batchId = idParam;
    }

    const tabParam = this.route.snapshot.queryParamMap.get('tab') as TabKey | null;
    if (tabParam === 'claim-data' || tabParam === 'consecutive-days') {
      this.activeTab.set(tabParam);
    }

    await this.loadStatusOptions();

    // Analysis doubles as the page header, so it always loads first.
    await this.loadAnalytics();
    await this.ensureTabLoaded(this.activeTab());
  }

  /** Fetches the master-list options (payment status = typeId 9, claim status = typeId 10) used by the Claim Data tab's filter dropdowns. */
  async loadStatusOptions(): Promise<void> {
    // Master-list lookup endpoint: returns enum option lists keyed by typeId.
    const enumsResp = await this.api.request('POST', API_ROUTES.GET_MASTER_LIST, { typeIds: [9, 10] }, {
      showToaster: false,
    });
    if (enumsResp?.status && Array.isArray(enumsResp.data)) {
      const data = enumsResp.data;

      const paymentStatusType = data.find((d: any) => d.typeId === 9);
      if (paymentStatusType && Array.isArray(paymentStatusType.options)) {
        this.paymentStatusOptions = [...paymentStatusType.options];
      }

      const claimStatusType = data.find((d: any) => d.typeId === 10);
      if (claimStatusType && Array.isArray(claimStatusType.options)) {
        this.claimStatusOptions = [...claimStatusType.options];
      }
    }
  }

  /** Switches the active tab and triggers its first-load fetch if it hasn't been loaded yet. */
  async setActiveTab(tab: TabKey): Promise<void> {
    this.activeTab.set(tab);
    // Analysis is preloaded once in ngOnInit (it doubles as the page header)
    // and has no "loaded" guard in ensureTabLoaded, so clicking back into it
    // otherwise triggers no fetch — and no loader — unlike the other two
    // tabs. Refresh it explicitly on every switch so the loader shows
    // consistently across all three tabs.
    if (tab === 'analysis') {
      await this.loadAnalytics();
    } else {
      await this.ensureTabLoaded(tab);
    }
  }

  /** Lazy-loads a tab's data on first activation only; subsequent tab switches are free. */
  private async ensureTabLoaded(tab: TabKey): Promise<void> {
    if (tab === 'claim-data' && !this.claimDataLoaded) {
      this.claimDataLoaded = true;
      await this.loadClaimRecords();
    } else if (tab === 'consecutive-days' && !this.consecutiveDaysLoaded) {
      this.consecutiveDaysLoaded = true;
      await this.loadConsecutiveDays();
    }
  }

  /** Loads the Analysis tab's data, which also supplies the page header (file title/year/month). */
  async loadAnalytics(): Promise<void> {
    if (!this.batchId) return;
    // Batch analytics endpoint: charts, totals, and the consecutive-day preview for this batch.
    const res = await this.api.request(
      'POST',
      API_ROUTES.GET_CLAIM_ANALYTICS,
      { batch_id: this.batchId },
      { showToaster: false },
    );
    if (res?.status && res.data) {
      this.analytics.set(res.data as ClaimAnalytics);
    }
  }

  // ── Claim Data tab ───────────────────────────────────────────────

  /** Fetches one page of the Claim Data tab's grid, applying the current Kendo state plus search/location/service-date filters. */
  async loadClaimRecords(): Promise<void> {
    if (!this.batchId) return;

    const body = this.filterSort.buildRequestBody(this.claimRecordsState, {
      extra: {
        batch_id: this.batchId,
        search: this.claimSearch?.trim(),
        location: this.claimLocation?.trim(),
      },
    });
    // The "Service Date" column filter emits a raw `Date`, which the generic
    // flattener serialises with local-timezone `toISOString()` — that shifts
    // the day backward for any timezone behind UTC (e.g. 26-07-2025 becomes
    // ...T18:30:00.000Z on 25-07-2025). Re-derive it as a date-only string and
    // route it through the same UTC start-of-day helper used elsewhere.
    const serviceDate = this.extractServiceDateFilter();
    if (serviceDate) {
      body['service_date'] = serviceDate;
    } else {
      delete body['service_date'];
    }

    // Claim records endpoint: paginated/filterable/sortable list of individual claim rows for this batch.
    const res = await this.api.request('POST', API_ROUTES.GET_CLAIM_RECORDS, body, { showToaster: false });
    if (res?.status) {
      const d = res.data;
      const items = d?.items ?? [];
      const total = d?.pagination?.total_records ?? items.length;
      this.claimRecordsData.set({ data: items, total });
    }
  }

  /** Kendo grid page/sort/filter change handler for the Claim Data tab. */
  async claimRecordsStateChange(state: DataStateChangeEvent): Promise<void> {
    this.claimRecordsState = state;
    await this.loadClaimRecords();
  }

  async applyClaimFilters(): Promise<void> {
    this.claimRecordsState = { ...this.claimRecordsState, skip: 0 };
    await this.loadClaimRecords();
  }

  async resetClaimFilters(): Promise<void> {
    this.claimSearch = '';
    this.claimLocation = '';
    this.claimRecordsState = {
      ...this.claimRecordsState,
      skip: 0,
      filter: { logic: 'and', filters: [] },
    };
    await this.loadClaimRecords();
  }

  /** Reads the "Service Date" column's `eq` filter value into a UTC start-of-day ISO string. */
  private extractServiceDateFilter(): string | null {
    for (const leaf of this.filterSort.flattenFilters(this.claimRecordsState.filter)) {
      if (leaf.field !== 'service_date' || !(leaf.value instanceof Date)) continue;
      return toISOStartOfDay(this.toDateOnlyStr(leaf.value));
    }
    return null;
  }

  private toDateOnlyStr(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  /** Navigates to the detail page for one claim record, encrypting the record id for the URL. */
  async viewClaimRecord(row: any): Promise<void> {
    if (!this.encryptedBatchId) return;
    const encRecordId = await this.crypto.encryptId(String(row?.id));
    this.router.navigate(['/claim-data-list', this.encryptedBatchId, 'claim-records', encRecordId]);
  }

  // ── Consecutive Days tab ─────────────────────────────────────────

  /** Loads the full consecutive-working-days analysis for this batch; pagination is then handled client-side (see below). */
  async loadConsecutiveDays(): Promise<void> {
    if (!this.batchId) return;
    // Consecutive-days analysis endpoint: flags providers whose working streak exceeds the configured threshold.
    const res = await this.api.request(
      'POST',
      API_ROUTES.GET_CONSECUTIVE_DAYS,
      { batch_id: this.batchId, page: 1, limit: 10 },
      { showToaster: false },
    );
    if (res?.status && res.data) {
      const data = res.data as ConsecutiveDayAnalysis;
      this.consecutiveDays.set(data);
      this.allProviderStreaks = data.providers ?? [];
      this.consecutiveDaysState = { ...this.consecutiveDaysState, skip: 0 };
      this.updateConsecutiveDaysPage();
    }
  }

  // The endpoint's response has no `pagination`/`total_records` — page the
  // returned array locally instead of round-tripping to the server.
  consecutiveDaysStateChange(state: DataStateChangeEvent): void {
    this.consecutiveDaysState = state;
    this.updateConsecutiveDaysPage();
  }

  private updateConsecutiveDaysPage(): void {
    const skip = this.consecutiveDaysState.skip ?? 0;
    const take = this.consecutiveDaysState.take ?? 10;
    this.consecutiveDaysData.set({
      data: this.allProviderStreaks.slice(skip, skip + take),
      total: this.allProviderStreaks.length,
    });
  }

  // ── Exports ──────────────────────────────────────────────────────

  /** Downloads the Claim Data tab's export as a CSV file. */
  async exportClaimData(): Promise<void> {
    await this.exportBatch(API_ROUTES.EXPORT_CLAIM_DATA, 'claim-data-export.csv');
  }

  /** Downloads the Consecutive Days tab's export as a CSV file. */
  async exportConsecutiveDays(): Promise<void> {
    await this.exportBatch(API_ROUTES.EXPORT_CONSECUTIVE_DAYS, 'consecutive-days-export.csv');
  }

  /** Shared export flow: fetches the CSV blob for `endpoint`, then triggers a browser download of it as `filename`. */
  private async exportBatch(endpoint: string, filename: string): Promise<void> {
    if (this.exporting() || !this.batchId) return;
    this.exporting.set(true);
    this.loader.show();
    try {
      const blob = await this.fetchFileBlob(endpoint, { batch_id: this.batchId });
      if (!blob) {
        this.toast.error('Failed to export the report.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      this.toast.error('Failed to export the report.');
    } finally {
      this.loader.hide();
      this.exporting.set(false);
    }
  }

  /**
   * POSTs an AES-GCM encrypted body directly via `fetch` (not `ApiService.request`)
   * because the export endpoints stream a raw CSV file rather than the JSON
   * envelope `ApiService` expects. Returns `null` on a non-2xx response so
   * callers can show their own error toast.
   */
  private async fetchFileBlob(endpoint: string, payload: Record<string, any>): Promise<Blob | null> {
    const url = this.config.apiUrl + endpoint;
    const token = (await this.crypto.tryDecryptPayload<string>(localStorage.getItem('accessToken'))) ?? '';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ data: await this.crypto.encryptPayload(payload) }),
    });
    if (!resp.ok) return null;
    return new Blob([await resp.blob()], { type: 'text/csv' });
  }

  // ── Helpers ──────────────────────────────────────────────────────

  /**
   * Horizontal-scroll chart width: each category gets a slot wide enough for
   * its own label (measured, not a flat per-bar guess), so labels stay
   * horizontal without touching their neighbors.
   */
  private categorySlotWidth(categories: string[]): string {
    if (categories.length <= 5) return '100%';
    const longest = categories.reduce((max, c) => Math.max(max, c.length), 0);
    const slotWidth = Math.max(90, longest * 7.5 + 40);
    return `${categories.length * slotWidth}px`;
  }

  /** Stack total (paid + pending + denied) for one service type — used by the chart tooltip. */
  serviceTypeTotal(serviceType: string): number {
    const row = this.analytics()?.payment_status_by_service_type.find((c) => c.service_type === serviceType);
    return row ? row.paid + row.pending + row.denied : 0;
  }

  /** Days in the given month — accepts a month name ("January", "Jan") or a 1-12 number. */
  getDaysInMonth(month?: string, year?: string): number {
    if (!month || !year) return 0;
    // return dayjs().year(dayjs(year, 'YYYY').year()).month(dayjs(month, 'MMMM').month()).daysInMonth();
    return dayjs(`${year}-${month}`, 'YYYY-MMMM').daysInMonth();
  }
}
