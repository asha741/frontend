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
import { toISOStartOfDay, toISOEndOfDay } from '../../core/utils/date.util';

/** Option for the Extraction Status / Clone Notes Status grid column filters. */
interface StatusOption {
  label: string;
  value: string;
}

/** `typeId` of the Extraction Status enum — shared with Travel Time. */
const EXTRACTION_STATUS_TYPE_ID = 15;

/** `typeId` of the Clone Notes Status enum. */
const CLONE_NOTES_STATUS_TYPE_ID = 14;

/**
 * Clone Notes — Batch Listing.
 *
 * POST /organization/clone-notes/batches
 *   { search, uploaded_date_from, uploaded_date_to, extraction_status, clone_notes_status, page, limit }
 * → { items: CloneNotesBatchResponse[], pagination }
 */
@Component({
  selector: 'app-clone-notes',
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
  templateUrl: './clone-notes.html',
  styleUrl: './clone-notes.scss',
})
export class CloneNotes implements OnInit {
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
  cloneNotesStatusOptions: StatusOption[] = [];

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
   * Loads the Extraction Status and Clone Notes Status dropdown options from
   * the shared "master list" enum endpoint — one call returns both.
   */
  async loadStatusOptions(): Promise<void> {
    const enumsResp = await this.api.request(
      'POST',
      API_ROUTES.GET_MASTER_LIST,
      { typeIds: [EXTRACTION_STATUS_TYPE_ID, CLONE_NOTES_STATUS_TYPE_ID] },
      { showToaster: false },
    );
    if (enumsResp?.status && Array.isArray(enumsResp.data)) {
      const data = enumsResp.data;

      const extractionStatusType = data.find((d: any) => d.typeId === EXTRACTION_STATUS_TYPE_ID);
      if (extractionStatusType && Array.isArray(extractionStatusType.options)) {
        this.extractionStatusOptions = [...extractionStatusType.options];
      }

      const cloneNotesStatusType = data.find((d: any) => d.typeId === CLONE_NOTES_STATUS_TYPE_ID);
      if (cloneNotesStatusType && Array.isArray(cloneNotesStatusType.options)) {
        this.cloneNotesStatusOptions = [...cloneNotesStatusType.options];
      }
    }
  }

  /** `NgbDateStruct` → `YYYY-MM-DD`. */
  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }

  /**
   * Fetches one page of Clone Notes batches for the current grid state.
   * Extraction Status / Clone Notes Status come from the grid's own column
   * filters (Kendo `state.filter`) — `buildRequestBody` flattens their `eq`
   * filters straight onto `extraction_status` / `clone_notes_status`.
   */
  async getBatchList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        search: this.search?.trim(),
        uploaded_date_from: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        uploaded_date_to: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      },
      includeSort: false,
    });

    const res = await this.api.request('POST', API_ROUTES.GET_CLONE_NOTES_BATCHES, body, {
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
   * A batch still extracting (or awaiting clone-notes validation) opens the
   * Upload/Extract page, where the user can watch progress. Once clone-notes
   * validation has finished (or extraction failed), the read-only Batch Detail
   * page is shown instead.
   */
  async viewBatch(row: any): Promise<void> {
    const encId = await this.crypto.encryptId(String(row?.id));
    const extraction = (row?.extraction_status ?? '').toLowerCase();
    const cloneNotes = (row?.clone_notes_status ?? '').toLowerCase();
    if (extraction !== 'completed' && extraction !== 'failed') {
      this.router.navigate(['/clone-notes', encId]);
    } else if (extraction === 'completed' && cloneNotes !== 'completed') {
      this.router.navigate(['/clone-notes', encId]);
    } else {
      this.router.navigate(['/clone-notes', encId, 'detail']);
    }
  }
}
