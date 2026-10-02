import { Component, OnInit, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbDateStruct, NgbDatepickerModule } from '@ng-bootstrap/ng-bootstrap';
import { RouterLink } from '@angular/router';
import { ChartsModule } from '@progress/kendo-angular-charts';
import { ApiService } from '../../core/services/api.service';
import { API_ROUTES } from '../../core/constants/api-routes';
import { AuthService } from '../../core/services/auth.service';
import { toISOStartOfDay, toISOEndOfDay, getViewerTimezone } from '../../core/utils/date.util';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

/** True when a trend series has no usable values — every point is null, undefined, or 0. */
function isTrendEmpty(values: (number | null)[]): boolean {
  return values.every((v) => v === null || v === undefined || v === 0);
}

/** A single chart series: x-axis labels paired positionally with their values. */
interface TrendSeries {
  labels: string[];
  values: (number | null)[];
}

/** Shape of the aggregated KPI + chart data returned by the dashboard metrics endpoint. */
interface DashboardMetrics {
  total_team_users: number;
  total_uploads: number;
  ocr_processed: number;
  ai_validation_completed: number;
  claims_pending_review: number;
  human_based_claims_approved: number;
  total_providers: number;
  total_patients: number;
  upload_trends: TrendSeries;
  compliance_trends: TrendSeries;
}

/** Global KPI date filter — a preset day-count, or 'custom' for an explicit from/to window. */
const RANGE_OPTIONS = [
  { label: 'Today', value: 0 },
  { label: 'Last 7 Days', value: 7 },
  { label: 'Last 15 Days', value: 15 },
  { label: 'Last 30 Days', value: 30 },
  { label: 'Last 60 Days', value: 60 },
  { label: 'Last 90 Days', value: 90 },
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ChartsModule, FormsModule, NgbDatepickerModule, DecimalPipe, EmptyStateComponent, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
/**
 * Landing page for the admin panel: shows headline KPIs (uploads, OCR, claims, etc.)
 * plus upload/compliance trend charts, filterable by a preset or custom date range and by year.
 */
export class DashboardComponent implements OnInit {
  constructor(
    public api: ApiService,
    public auth: AuthService,
  ) {}

  readonly rangeOptions = RANGE_OPTIONS;

  /** Year options loaded from /meta/enums (typeId 11) */
  yearOptions: { label: string; value: number }[] = [];

  // ── Filters ──────────────────────────────────────────────────────
  selectedRange: number | 'custom' = 30;
  customFrom: NgbDateStruct | null = null;
  customTo: NgbDateStruct | null = null;
  selectedYear = new Date().getFullYear();

  readonly loading = signal(false);
  readonly metrics = signal<DashboardMetrics | null>(null);

  readonly uploadCategories = signal<string[]>([]);
  readonly uploadTrendsData = signal<(number | null)[]>([]);
  readonly complianceCategories = signal<string[]>([]);
  readonly complianceScoreData = signal<(number | null)[]>([]);

  readonly hasUploadTrendsData = computed(() => !isTrendEmpty(this.uploadTrendsData()));
  readonly hasComplianceTrendsData = computed(() => !isTrendEmpty(this.complianceScoreData()));

  /** Loads the year filter options first (sequentially) so `selectedYear` is valid before the initial metrics fetch. */
  async ngOnInit(): Promise<void> {
    await this.loadYearOptions();
    await this.loadMetrics();
  }

  // ── Dropdown options ───────────────────────────────────────────────

  /** POST /meta/enums { typeIds: [11] } — year options for the graph filter */
  async loadYearOptions(): Promise<void> {
    const res = await this.api.request('POST', API_ROUTES.GET_MASTER_LIST, { typeIds: [11] }, {
      showToaster: false,
    });
    if (res?.status && Array.isArray(res.data)) {
      const yearType = res.data.find((d: any) => d.typeId === 11);
      if (yearType && Array.isArray(yearType.options)) {
        this.yearOptions = yearType.options.map((o: any) => ({
          label: String(o.label ?? o.value ?? ''),
          value: Number(o.value ?? o.label),
        }));
      }
    }
    if (this.yearOptions.length && !this.yearOptions.some((y) => y.value === this.selectedYear)) {
      this.selectedYear = this.yearOptions[0].value;
    }
  }

  // ── Filter handling ──────────────────────────────────────────────

  async onRangeChange(): Promise<void> {
    if (this.selectedRange === 'custom') return; // wait for the explicit Apply below
    this.customFrom = null;
    this.customTo = null;
    await this.loadMetrics();
  }

  /** Applies the custom from/to range picked in the UI, guarding against an incomplete or inverted (from > to) selection. */
  async applyCustomRange(): Promise<void> {
    if (!this.customFrom || !this.customTo) return;
    // String comparison works here because toDateStr formats as zero-padded YYYY-MM-DD.
    if (this.toDateStr(this.customFrom) > this.toDateStr(this.customTo)) {
      return;
    }
    await this.loadMetrics();
  }

  async onYearChange(): Promise<void> {
    await this.loadMetrics();
  }

  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }

  /**
   * Builds the request body for the metrics endpoint. When a custom range is active,
   * `range` is omitted and the from/to dates are expanded to full-day ISO bounds
   * (start of day / end of day) in the viewer's timezone so the backend gets an inclusive window.
   */
  private buildPayload(): Record<string, any> {
    const isCustom = this.selectedRange === 'custom';
    return {
      range: isCustom ? null : this.selectedRange,
      custom_from: isCustom && this.customFrom ? toISOStartOfDay(this.toDateStr(this.customFrom)) : null,
      custom_to: isCustom && this.customTo ? toISOEndOfDay(this.toDateStr(this.customTo)) : null,
      year: this.selectedYear,
      timezone: getViewerTimezone(),
    };
  }

  // ── Load ─────────────────────────────────────────────────────────

  /**
   * Fetches the dashboard KPIs and trend chart data for the currently selected filters
   * and pushes the results into the component's signals.
   */
  async loadMetrics(): Promise<void> {
    if (this.selectedRange === 'custom' && (!this.customFrom || !this.customTo)) return;

    // POST /dashboard/metrics — returns aggregated KPI counts plus upload/compliance trend series for the given range/year.
    const res = await this.api.request<DashboardMetrics>(
      'POST',
      API_ROUTES.GET_DASHBOARD_METRICS,
      this.buildPayload(),
      { showToaster: false },
    );
    if (res?.status) {
      const data = (res.data as DashboardMetrics) ?? null;
      this.metrics.set(data);
      this.uploadCategories.set(data?.upload_trends?.labels ?? []);
      this.uploadTrendsData.set(data?.upload_trends?.values ?? []);
      this.complianceCategories.set(data?.compliance_trends?.labels ?? []);
      this.complianceScoreData.set(data?.compliance_trends?.values ?? []);
    }
  }
}
