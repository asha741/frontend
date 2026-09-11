import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbDateStruct, NgbDatepickerModule } from '@ng-bootstrap/ng-bootstrap';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';

import { ApiService } from '../../core/services/api.service';
import { API_ROUTES } from '../../core/constants/api-routes';
import { ToastService } from '../../core/services/toast.service';
import { LoaderService } from '../../core/services/loader.service';
import { ConfigService } from '../../core/config/config.service';
import { CryptoService } from '../../core/services/crypto.service';
import { PermissionService } from '../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../core/constants/permissions';
import { toISOStartOfDay, toISOEndOfDay, getViewerTimezone } from '../../core/utils/date.util';
import { BadgeClassPipe } from '../../shared/pipes/badge-class.pipe';

/**
 * These are sent verbatim — they're the literal keys of the backend's
 * `MONTH_MAPPING` / `WEEK_MAPPING`, so the label, the bound value and the wire
 * value are all one string. Any edit here must match the backend's constants.
 */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKS = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];

/** Reporting years — current year plus the two following, per the user story. */
function reportYears(): number[] {
  const current = new Date().getFullYear();
  return [current, current + 1, current + 2];
}

/** The export formats offered on each report's export button. */
type ExportFormat = 'excel' | 'pdf';

/** Filename extension + MIME type to save each export format under. */
const EXPORT_FORMAT: Record<ExportFormat, { ext: string; mime: string }> = {
  excel: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  pdf: { ext: 'pdf', mime: 'application/pdf' },
};

/** One entry in the organization summary's "top failing rules" breakdown. */
interface TopFailingRule {
  rule_name: string;
  failure_count: number;
}

/** Shape of the organization-summary report payload returned by the backend. */
interface OrganizationSummary {
  total_claims: number;
  passed: number;
  failed: number;
  pass_rate: number;
  top_failing_rules: TopFailingRule[];
}

/**
 * Reports & Analytics — organization-wide compliance reporting.
 *
 * Three report sections share one set of global filters:
 *   POST /organization/reports-analytics/organization-summary
 *   POST /organization/reports-analytics/employee-performance   (paged)
 *   POST /organization/reports-analytics/rule-failure-analysis  (paged)
 *
 * Each has a sibling `/export` endpoint taking the same filters plus
 * `export_format` ('excel' | 'pdf').
 *
 * Filters are mutually exclusive by design: the Year → Month → Week hierarchy
 * and the custom From/To range clear each other, so only one reporting period
 * is ever in play. Every filter change refreshes all three reports and resets
 * both tables to page 1.
 */
@Component({
  selector: 'app-reports-analytics',
  standalone: true,
  imports: [BadgeClassPipe, FormsModule, NgbDatepickerModule, GridModule],
  templateUrl: './reports-analytics.html',
  styleUrl: './reports-analytics.scss',
})
export class ReportsAnalytics implements OnInit {
  constructor(
    public api: ApiService,
    public toast: ToastService,
    public loader: LoaderService,
    public config: ConfigService,
    public crypto: CryptoService,
    public perms: PermissionService,
  ) {}

  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly months = MONTHS;
  readonly weeks = WEEKS;
  readonly years = reportYears();
  readonly pageSizes = [10, 25, 50];

  // ── Global filters ───────────────────────────────────────────────
  year = String(new Date().getFullYear());
  month = '';
  week = '';
  fromDate: NgbDateStruct | null = null;
  toDate: NgbDateStruct | null = null;

  // ── Report data ──────────────────────────────────────────────────
  readonly summary = signal<OrganizationSummary | null>(null);
  readonly employeeData = signal<GridDataResult>({ data: [], total: 0 });
  readonly ruleData = signal<GridDataResult>({ data: [], total: 0 });

  readonly topFailingRules = computed(() => this.summary()?.top_failing_rules ?? []);

  employeeState: State = { skip: 0, take: 10 };
  ruleState: State = { skip: 0, take: 10 };

  /** Guards every export button against a second click mid-download. */
  readonly exporting = signal(false);

  async ngOnInit(): Promise<void> {
    await this.loadAll();
  }

  // ── Filter handling ──────────────────────────────────────────────

  /** Year cleared ⇒ month and week are meaningless, so they clear too. */
  async onYearChange(): Promise<void> {
    if (!this.year) {
      this.month = '';
      this.week = '';
    }
    this.clearCustomRange();
    await this.reload();
  }

  /** Month cleared ⇒ week is meaningless, so it clears too. */
  async onMonthChange(): Promise<void> {
    if (!this.month) this.week = '';
    this.clearCustomRange();
    await this.reload();
  }

  async onWeekChange(): Promise<void> {
    this.clearCustomRange();
    await this.reload();
  }

  /**
   * Applies the custom date range — button-driven, unlike the dropdowns.
   *
   * A range isn't meaningful until both ends are picked, so firing on each pick
   * would run a query against a half-specified range (and there'd be no moment
   * at which to validate the order). Same reason the super-admin audit log
   * filter applies its dates through an explicit Search.
   *
   * Applying a range takes over from the Year/Month/Week hierarchy, which clears.
   */
  async applyDateRange(): Promise<void> {
    if (this.fromDate && this.toDate && this.toDateStr(this.fromDate) > this.toDateStr(this.toDate)) {
      this.toast.warning('"From" date cannot be after "To" date.');
      return;
    }
    if (this.fromDate || this.toDate) {
      this.year = '';
      this.month = '';
      this.week = '';
    }
    await this.reload();
  }

  /** Restores all filters to their defaults (current year, no range) and reloads. */
  async resetFilters(): Promise<void> {
    this.year = String(new Date().getFullYear());
    this.month = '';
    this.week = '';
    this.fromDate = null;
    this.toDate = null;
    await this.reload();
  }

  private clearCustomRange(): void {
    this.fromDate = null;
    this.toDate = null;
  }

  /** Refreshes every report and sends both tables back to page 1. */
  private async reload(): Promise<void> {
    this.employeeState = { ...this.employeeState, skip: 0 };
    this.ruleState = { ...this.ruleState, skip: 0 };
    await this.loadAll();
  }

  private async loadAll(): Promise<void> {
    await Promise.all([this.loadSummary(), this.loadEmployeePerformance(), this.loadRuleFailures()]);
  }

  /** The filter block every report and export request carries. */
  private filterPayload(): Record<string, any> {
    return {
      year: this.year || null,
      month: this.month || null,
      week: this.week || null,
      // Full UTC ISO timestamps, with an end-of-day upper bound so the "To"
      // date is inclusive — same treatment as the super-admin audit log filter.
      from_date: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
      to_date: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      timezone: getViewerTimezone(),
    };
  }

  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }

  /** Converts Kendo grid's skip/take pagination state into a 1-based page number for the API. */
  private pageOf(state: State): number {
    const take = state.take || 10;
    return Math.floor((state.skip ?? 0) / take) + 1;
  }

  // ── Loads ────────────────────────────────────────────────────────

  /** Fetches the organization-wide compliance summary (totals, pass rate, top failing rules) for the current filters. */
  async loadSummary(): Promise<void> {
    // Errors are surfaced via the loader/toast pattern elsewhere, not this endpoint's own toaster.
    const res = await this.api.request('POST', API_ROUTES.GET_ORGANIZATION_SUMMARY, this.filterPayload(), {
      showToaster: false,
    });
    if (res?.status) {
      this.summary.set((res.data as OrganizationSummary) ?? null);
    }
  }

  /** Fetches one page of the employee-performance report, paged and filtered per the current grid/filter state. */
  async loadEmployeePerformance(): Promise<void> {
    const body = {
      ...this.filterPayload(),
      page: this.pageOf(this.employeeState),
      size: this.employeeState.take || 10,
    };
    const res = await this.api.request('POST', API_ROUTES.GET_EMPLOYEE_PERFORMANCE, body, { showToaster: false });
    if (res?.status) {
      const items = res.data?.items ?? [];
      this.employeeData.set({ data: items, total: res.data?.pagination?.total_records ?? items.length });
    }
  }

  /** Fetches one page of the rule-failure-analysis report, paged and filtered per the current grid/filter state. */
  async loadRuleFailures(): Promise<void> {
    const body = {
      ...this.filterPayload(),
      page: this.pageOf(this.ruleState),
      size: this.ruleState.take || 10,
    };
    const res = await this.api.request('POST', API_ROUTES.GET_RULE_FAILURE_ANALYSIS, body, { showToaster: false });
    if (res?.status) {
      const items = res.data?.items ?? [];
      this.ruleData.set({ data: items, total: res.data?.pagination?.total_records ?? items.length });
    }
  }

  /** Kendo grid callback for the employee-performance table: sync its paging state, then refetch that page. */
  async employeeStateChange(state: DataStateChangeEvent): Promise<void> {
    this.employeeState = state;
    await this.loadEmployeePerformance();
  }

  /** Kendo grid callback for the rule-failure table: sync its paging state, then refetch that page. */
  async ruleStateChange(state: DataStateChangeEvent): Promise<void> {
    this.ruleState = state;
    await this.loadRuleFailures();
  }

  // ── Exports ──────────────────────────────────────────────────────

  /** Exports the organization summary report under the current filters. */
  async exportSummary(format: ExportFormat): Promise<void> {
    await this.exportReport(API_ROUTES.EXPORT_ORGANIZATION_SUMMARY, 'organization-summary', format);
  }

  /** Exports the employee performance report under the current filters (all matching rows, not just the visible page). */
  async exportEmployeePerformance(format: ExportFormat): Promise<void> {
    await this.exportReport(API_ROUTES.EXPORT_EMPLOYEE_PERFORMANCE, 'employee-performance', format);
  }

  /** Exports the rule failure analysis report under the current filters (all matching rows, not just the visible page). */
  async exportRuleFailures(format: ExportFormat): Promise<void> {
    await this.exportReport(API_ROUTES.EXPORT_RULE_FAILURE_ANALYSIS, 'rule-failure-analysis', format);
  }

  /**
   * Exports one report under the currently applied filters.
   *
   * The endpoint streams the file rather than returning the JSON envelope
   * `ApiService` expects, so it's fetched directly — same pattern as the
   * provider / claim-data exports.
   */
  private async exportReport(endpoint: string, baseName: string, format: ExportFormat): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.loader.show();
    try {
      const payload = { ...this.filterPayload(), export_format: format };
      const file = await this.fetchExport(endpoint, payload, format);
      if (!file) {
        this.toast.error('Failed to export the report.');
        return;
      }
      if (typeof file === 'string') {
        // The backend answered with a download link instead of a file stream.
        window.open(file, '_blank');
        return;
      }
      this.triggerDownload(file, `${baseName}.${EXPORT_FORMAT[format].ext}`);
    } catch {
      this.toast.error('Failed to export the report.');
    } finally {
      this.loader.hide();
      this.exporting.set(false);
    }
  }

  /**
   * Returns the exported file as a `Blob`, or a URL string when the endpoint
   * responds with the standard JSON envelope carrying a download link instead
   * of the file itself. `null` means the request failed.
   */
  private async fetchExport(
    endpoint: string,
    payload: Record<string, any>,
    format: ExportFormat,
  ): Promise<Blob | string | null> {
    const url = this.config.apiUrl + endpoint;
    // Bypasses ApiService's own token handling since this call is a raw fetch,
    // not a request through the shared HTTP client — same auth as the app's other requests.
    const token = (await this.crypto.tryDecryptPayload<string>(localStorage.getItem('accessToken'))) ?? '';
    // Export endpoint: POST the (encrypted) filter payload, get back either the
    // exported file as a binary stream, or a JSON envelope carrying a download link.
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ data: await this.crypto.encryptPayload(payload) }),
    });
    if (!resp.ok) return null;

    if ((resp.headers.get('content-type') ?? '').includes('application/json')) {
      const body = await resp.json();
      // The JSON envelope itself may be encrypted; decrypt only when it's a string.
      const envelope = typeof body?.data === 'string' ? await this.crypto.tryDecryptPayload<any>(body.data) : body;
      const link = envelope?.data;
      return typeof link === 'string' && /^https?:\/\//i.test(link) ? link : null;
    }

    return new Blob([await resp.blob()], { type: EXPORT_FORMAT[format].mime });
  }

  /** Triggers a browser "Save As" for an in-memory blob via a throwaway anchor element. */
  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Helpers ──────────────────────────────────────────────────────
}
