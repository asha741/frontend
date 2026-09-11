import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { ChartsModule } from '@progress/kendo-angular-charts';
import { NgbDatepickerModule, NgbDateStruct, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { ToastService } from '../../../core/services/toast.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { FilterAndSortingService } from '../../../core/services/common-filter-sort.service';
import { toISOStartOfDay, toISOEndOfDay } from '../../../core/utils/date.util';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';
import { CustomDropDownListFilterComponent } from '../../../core/services/dropdownfilter.component';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuType } from '../../../core/constants/permissions';

interface ProviderSummary {
  provider_name: string;
  provider_id: string;
  license: string;
}

interface ClaimsKpis {
  total_claims: number;
  total_passed: number;
  total_failed: number;
}

interface ClaimsTrendPoint {
  month: string;
  year: number;
  claims: number;
  passed: number;
  failed: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Fills in every month of the year (Jan–Dec) so the trend chart always plots a full multi-line series, zeroing months the API didn't return. */
function buildYearlyTrend(points: ClaimsTrendPoint[]): ClaimsTrendPoint[] {
  const year = points[0]?.year ?? new Date().getFullYear();
  const byMonth = new Map(points.map((p) => [p.month, p]));
  return MONTHS.map(
    (month) => byMonth.get(month) ?? { month, year, claims: 0, passed: 0, failed: 0 },
  );
}

/**
 * Provider Patient Claims — validated claims linked to a single provider.
 *
 * POST /organization/providers/claims
 *   { provider_id, page, limit, search, ai_status, review_status,
 *     upload_date_from, upload_date_to, sort_by, order }
 * → { provider, kpis, trend, claims, pagination }
 */
@Component({
  selector: 'app-provider-patients',
  standalone: true,
  imports: [
    BadgeClassPipe,
    GridModule,
    ChartsModule,
    FormsModule,
    DatePipe,
    NgbDatepickerModule,
    NgbTooltipModule,
    TrimWhitespaceDirective,
    CustomDropDownListFilterComponent,
  ],
  templateUrl: './provider-patients.component.html',
  styleUrl: './provider-patients.component.scss',
})
export class ProviderPatientsComponent implements OnInit {
  constructor(
    public api: ApiService,
    public route: ActivatedRoute,
    public router: Router,
    public toast: ToastService,
    public crypto: CryptoService,
    public filterSort: FilterAndSortingService,
    public perms: PermissionService,
  ) {}

  readonly MenuType = MenuType;

  providerId: string | null = null;
  encryptedProviderId: string | null = null;

  readonly loading = signal(false);
  readonly provider = signal<ProviderSummary | null>(null);
  readonly kpis = signal<ClaimsKpis>({ total_claims: 0, total_passed: 0, total_failed: 0 });
  readonly trend = signal<ClaimsTrendPoint[]>([]);
  readonly claimsData = signal<GridDataResult>({ data: [], total: 0 });
  readonly pageSizes = [10, 25, 50];

  // True once the year has any non-zero claim/pass/fail count, so the chart
  // can show an empty state instead of a flat-zero line series.
  readonly hasChartData = computed(() => this.trend().some((t) => t.claims > 0 || t.passed > 0 || t.failed > 0));

  readonly chartCategories = computed(() => this.trend().map((t) => t.month));
  readonly claimsSeries = computed(() => this.hasChartData() ? this.trend().map((t) => t.claims) : []);
  readonly passedSeries = computed(() => this.hasChartData() ? this.trend().map((t) => t.passed) : []);
  readonly failedSeries = computed(() => this.hasChartData() ? this.trend().map((t) => t.failed) : []);

  aiStatusOptions: { label: string; value: string }[] = [];
  reviewStatusOptions: { label: string; value: string }[] = [];

  state: State = {
    skip: 0,
    take: 10,
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  search = '';
  fromDate: NgbDateStruct | null = null;
  toDate: NgbDateStruct | null = null;

  /**
   * Resolves the provider id from the route, loads the AI-status/review-status
   * filter option lists, then loads the initial page of claims for that provider.
   */
  async ngOnInit(): Promise<void> {
    const encId = this.route.snapshot.paramMap.get('id');
    if (encId) {
      this.encryptedProviderId = encId;
      // Handle either encrypted ids or plain ids (e.g. a stale/unencrypted link).
      try {
        this.providerId = await this.crypto.decryptId(encId);
      } catch (e) {
        console.warn('ID decryption failed (likely a plain id in URL). Proceeding with raw id.');
        this.providerId = encId;
      }
    }

    // Master list lookup — typeId 3 is review status, typeId 4 is AI status (filter dropdown options).
    const enumsResp = await this.api.request('POST', API_ROUTES.GET_MASTER_LIST, { typeIds: [3, 4] }, {
      showToaster: false,
    });
    if (enumsResp?.status && Array.isArray(enumsResp.data)) {
      const data = enumsResp.data;

      const reviewStatusType = data.find((d: any) => d.typeId === 3);
      if (reviewStatusType && Array.isArray(reviewStatusType.options)) {
        this.reviewStatusOptions = [...reviewStatusType.options];
      }

      const aiStatusType = data.find((d: any) => d.typeId === 4);
      if (aiStatusType && Array.isArray(aiStatusType.options)) {
        this.aiStatusOptions = [...aiStatusType.options];
      }
    }

    await this.loadClaims();
  }

  /**
   * Loads a page of claims for the current provider (grid state + search +
   * upload-date range), and updates the provider summary, KPI tiles and
   * yearly trend chart alongside the grid data.
   */
  async loadClaims(): Promise<void> {
    if (!this.providerId) return;

    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        provider_id: this.providerId,
        search: this.search?.trim(),
        upload_date_from: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        upload_date_to: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      },
    });


    // Fetches claims + provider summary + KPIs + trend for this provider (see class doc above).
    const res = await this.api.request('POST', API_ROUTES.GET_PROVIDER_CLAIMS, body, {
      showToaster: false,
    });

    if (res?.status) {
      const d = res.data ?? {};
      this.provider.set(d.provider ?? null);
      this.kpis.set(d.kpis ?? { total_claims: 0, total_passed: 0, total_failed: 0 });

      // Normalize the API's trend points into a full Jan–Dec series for the chart.
      this.trend.set(buildYearlyTrend(d.trend ?? []));
      
      const claims = d.claims ?? [];
      const total = d.pagination?.total_records ?? claims.length;
      this.claimsData.set({ data: claims, total });
    }
  }

  /** Kendo grid page/sort/filter change handler — refetches claims for the new state. */
  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.loadClaims();
  }

  /** Applies the search box + upload-date range filter, resetting to the first page. */
  async onSearch(): Promise<void> {
    if (this.fromDate && this.toDate && this.toDateStr(this.fromDate) > this.toDateStr(this.toDate)) {
      this.toast.warning('"From" date cannot be after "To" date.');
      return;
    }
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.loadClaims();
  }

  /** Resets search text, date filters and grid filters, then reloads the first page. */
  async clearSearch(): Promise<void> {
    this.search = '';
    this.fromDate = null;
    this.toDate = null;
    this.state = { ...this.state, skip: 0, filter: { logic: 'and', filters: [] } };
    await this.loadClaims();
  }

  /** Navigates to the claim-detail route, encrypting the claim id first so it isn't exposed raw in the URL. */
  async viewDetails(dataItem: { id: string }): Promise<void> {
    if (!this.encryptedProviderId || !dataItem?.id) return;
    const encClaimId = await this.crypto.encryptId(dataItem.id);
    this.router.navigate(['/provider-management/patients', this.encryptedProviderId, 'claim', encClaimId]);
  }

  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }
}
