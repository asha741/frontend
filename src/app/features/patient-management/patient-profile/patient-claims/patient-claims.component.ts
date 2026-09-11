import { Component, Input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { NgbDatepickerModule, NgbDateStruct, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../../core/services/api.service';
import { API_ROUTES } from '../../../../core/constants/api-routes';
import { CryptoService } from '../../../../core/services/crypto.service';
import { FilterAndSortingService } from '../../../../core/services/common-filter-sort.service';
import { toISOStartOfDay, toISOEndOfDay } from '../../../../core/utils/date.util';
import { TrimWhitespaceDirective } from '../../../../shared/directives/trim-whitespace.directive';
import { BadgeClassPipe } from '../../../../shared/pipes/badge-class.pipe';
import { PermissionService } from '../../../../core/services/permission.service';
import { MenuType } from '../../../../core/constants/permissions';

interface ClaimsKpis {
  total_claims: number;
  total_treatment_plans: number;
  total_progress_notes: number;
  total_dla_20: number;
  failed_claims: number;
  valid_claims: number;
}

const EMPTY_KPIS: ClaimsKpis = {
  total_claims: 0,
  total_treatment_plans: 0,
  total_progress_notes: 0,
  total_dla_20: 0,
  failed_claims: 0,
  valid_claims: 0,
};

/**
 * Patient Claims tab.
 *
 * POST /organization/patients/claims
 *   { id, page, limit, search, ai_status, review_status, upload_date_from,
 *     upload_date_to, sort_by, order }
 * → { kpis, claims, pagination }
 */
@Component({
  selector: 'app-patient-claims',
  standalone: true,
  imports: [
    BadgeClassPipe,
    GridModule,
    FormsModule,
    DatePipe,
    NgbDatepickerModule,
    NgbTooltipModule,
    TrimWhitespaceDirective,
  ],
  templateUrl: './patient-claims.component.html',
  styleUrl: './patient-claims.component.scss',
})
export class PatientClaimsComponent implements OnInit {
  @Input({ required: true }) patientId!: string;

  constructor(
    public api: ApiService,
    public router: Router,
    public crypto: CryptoService,
    public filterSort: FilterAndSortingService,
    public perms: PermissionService,
  ) {}

  readonly MenuType = MenuType;

  readonly kpis = signal<ClaimsKpis>(EMPTY_KPIS);
  readonly claimsData = signal<GridDataResult>({ data: [], total: 0 });
  readonly pageSizes = [10, 25, 50];

  state: State = {
    skip: 0,
    take: 10,
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  search = '';
  fromDate: NgbDateStruct | null = null;
  toDate: NgbDateStruct | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadClaims();
  }

  /** Fetches this patient's claims KPIs and the current page of the claims grid. */
  async loadClaims(): Promise<void> {
    if (!this.patientId) return;

    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        id: this.patientId,
        search: this.search?.trim(),
        upload_date_from: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        upload_date_to: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      },
    });

    // POST /organization/patients/claims — returns KPIs plus paginated claims (see class doc above).
    const res = await this.api.request('POST', API_ROUTES.GET_PATIENT_CLAIMS, body, {
      showToaster: false,
    });

    if (res?.status) {
      const d = res.data ?? {};
      this.kpis.set(d.kpis ?? EMPTY_KPIS);
      const claims = d.claims ?? [];
      const total = d.pagination?.total_records ?? claims.length;
      this.claimsData.set({ data: claims, total });
    }
  }

  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.loadClaims();
  }

  async onSearch(): Promise<void> {
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.loadClaims();
  }

  async clearSearch(): Promise<void> {
    this.search = '';
    this.fromDate = null;
    this.toDate = null;
    this.state = { ...this.state, skip: 0, filter: { logic: 'and', filters: [] } };
    await this.loadClaims();
  }

  /**
   * Opens the existing read-only Claim Detail page, scoped to this patient so
   * it loads via `GET_PATIENT_CLAIM_DETAIL` (`POST /organization/patients/claims/detail`
   * — `{ id: patient_id, claim_id }`).
   */
  async viewClaim(dataItem: { id: string }): Promise<void> {
    if (!dataItem?.id || !this.patientId) return;
    const [encPatientId, encClaimId] = await Promise.all([
      this.crypto.encryptId(this.patientId),
      this.crypto.encryptId(dataItem.id),
    ]);
    this.router.navigate(['/patient-management/profile', encPatientId, 'claim', encClaimId]);
  }

  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }
}
