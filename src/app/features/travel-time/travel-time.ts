import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { Router, RouterLink } from '@angular/router';
import { NgbDatepickerModule, NgbDateStruct, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../core/services/api.service';
import { CryptoService } from '../../core/services/crypto.service';
import { PermissionService } from '../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../core/constants/permissions';
import { API_ROUTES } from '../../core/constants/api-routes';
import { FilterAndSortingService } from '../../core/services/common-filter-sort.service';
import { CustomDropDownListFilterComponent } from '../../core/services/dropdownfilter.component';
import { TrimWhitespaceDirective } from '../../shared/directives/trim-whitespace.directive';
import { BadgeClassPipe } from '../../shared/pipes/badge-class.pipe';

/** Option for the Extraction Status / Travel Time Status grid column filters. */
interface StatusOption {
  label: string;
  value: string;
}

/**
 * Travel Time — Batch Listing.
 *
 * POST /organization/travel-time/batches
 *   { search, uploaded_date_from, uploaded_date_to, extraction_status, travel_time_status, page, limit }
 * → { items: TravelTimeBatchResponse[], pagination }
 */
@Component({
  selector: 'app-travel-time',
  standalone: true,
  imports: [
    BadgeClassPipe,
    GridModule,
    NgbTooltipModule,
    NgbDatepickerModule,
    FormsModule,
    DatePipe,
    RouterLink,
    TrimWhitespaceDirective,
    CustomDropDownListFilterComponent,
  ],
  templateUrl: './travel-time.html',
  styleUrl: './travel-time.scss',
})
export class TravelTime implements OnInit {
  constructor(
    public api: ApiService,
    public router: Router,
    public crypto: CryptoService,
    public perms: PermissionService,
    public filterSort: FilterAndSortingService,
  ) {}

  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  extractionStatusOptions: StatusOption[] = [];
  travelTimeStatusOptions: StatusOption[] = [];

  readonly batchesData = signal<GridDataResult>({ data: [], total: 0 });
  readonly pageSizes = [10, 25, 50];

  state: State = { skip: 0, take: 10, sort: [], filter: { logic: 'and', filters: [] } };

  search = '';
  fromDate: NgbDateStruct | null = null;
  toDate: NgbDateStruct | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadStatusOptions();
    await this.getBatchList();
  }

  /**
   * Loads the Extraction Status (typeId 15) and Travel Time Status (typeId 13)
   * dropdown options from the shared "master list" enum endpoint.
   */
  async loadStatusOptions(): Promise<void> {
    const enumsResp = await this.api.request('POST', API_ROUTES.GET_MASTER_LIST, { typeIds: [15, 13] }, {
      showToaster: false,
    });
    if (enumsResp?.status && Array.isArray(enumsResp.data)) {
      const data = enumsResp.data;

      const extractionStatusType = data.find((d: any) => d.typeId === 15);
      if (extractionStatusType && Array.isArray(extractionStatusType.options)) {
        this.extractionStatusOptions = [...extractionStatusType.options];
      }

      const travelTimeStatusType = data.find((d: any) => d.typeId === 13);
      if (travelTimeStatusType && Array.isArray(travelTimeStatusType.options)) {
        this.travelTimeStatusOptions = [...travelTimeStatusType.options];
      }
    }
  }

  /** `NgbDateStruct` → `YYYY-MM-DD`, or '' when unset. */
  private formatDate(date: NgbDateStruct | null): string {
    if (!date) return '';
    const mm = String(date.month).padStart(2, '0');
    const dd = String(date.day).padStart(2, '0');
    return `${date.year}-${mm}-${dd}`;
  }

  /**
   * Fetches one page of Travel Time batches for the current grid state.
   * Extraction Status / Travel Time Status come from the grid's own column
   * filters (Kendo `state.filter`) — `buildRequestBody` flattens their `eq`
   * filters straight onto `extraction_status` / `travel_time_status`, same
   * as Audit Logs' Action/Module column filters.
   */
  async getBatchList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        search: this.search?.trim(),
        uploaded_date_from: this.formatDate(this.fromDate),
        uploaded_date_to: this.formatDate(this.toDate),
      },
      includeSort: false,
    });

    const res = await this.api.request('POST', API_ROUTES.GET_TRAVEL_TIME_BATCHES, body, {
      showToaster: false,
    });

    if (res?.status) {
      const d = res.data;
      const items = d?.items ?? [];
      const total = d?.pagination?.total_records ?? items.length;
      this.batchesData.set({ data: items, total });
    }
  }

  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.getBatchList();
  }

  async onSearch(): Promise<void> {
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.getBatchList();
  }

  async clearSearch(): Promise<void> {
    this.search = '';
    this.fromDate = null;
    this.toDate = null;
    this.state = { ...this.state, skip: 0, filter: { logic: 'and', filters: [] } };
    await this.getBatchList();
  }

  /** True when a status value should show the failure-reason info icon. */
  isFailedStatus(status: string): boolean {
    return (status ?? '').toLowerCase() === 'failed';
  }

  /**
   * A batch still extracting (or awaiting travel-time validation) opens the
   * Upload/Extract page, where the user can watch progress and Submit. Once
   * travel-time validation has finished (or extraction failed), the read-only
   * Batch Detail page is shown instead.
   */
  async viewBatch(row: any): Promise<void> {
    const encId = await this.crypto.encryptId(String(row?.id));
    const extraction = (row?.extraction_status ?? '').toLowerCase();
    const travelTime = (row?.travel_time_status ?? '').toLowerCase();
    if (extraction !== 'completed' && extraction !== 'failed') {
      this.router.navigate(['/travel-time', encId]);
    } else if (extraction === 'completed' && travelTime !== 'completed') {
      this.router.navigate(['/travel-time', encId]);
    } else {
      this.router.navigate(['/travel-time', encId, 'detail']);
    }
  }
}
