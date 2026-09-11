import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { Router, RouterLink } from '@angular/router';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../core/services/api.service';
import { CryptoService } from '../../core/services/crypto.service';
import { PermissionService } from '../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../core/constants/permissions';
import { API_ROUTES } from '../../core/constants/api-routes';
import { FilterAndSortingService } from '../../core/services/common-filter-sort.service';
import { TrimWhitespaceDirective } from '../../shared/directives/trim-whitespace.directive';
import { BadgeClassPipe } from '../../shared/pipes/badge-class.pipe';

/**
 * Uploaded bulk-processing batches.
 *
 * POST /organization/bulk-upload/batches/list
 *   { search, page, limit, sort_by, order }
 * → { items: BulkUploadBatchResponse[], pagination }
 */
@Component({
  selector: 'app-bulk-upload',
  standalone: true,
  imports: [BadgeClassPipe, GridModule, NgbTooltipModule, FormsModule, DatePipe, RouterLink, TrimWhitespaceDirective],
  templateUrl: './bulk-upload.html',
  styleUrl: './bulk-upload.scss',
})
export class BulkUpload implements OnInit {
  constructor(
    public api: ApiService,
    public filterSort: FilterAndSortingService,
    public router: Router,
    public crypto: CryptoService,
    public perms: PermissionService,
  ) {}

  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly batchesData = signal<GridDataResult>({ data: [], total: 0 });
  readonly pageSizes = [10, 25, 50];

  state: State = {
    skip: 0,
    take: 10,
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  search = '';

  async ngOnInit(): Promise<void> {
    await this.getBatchList();
  }

  /** Fetches one page of bulk-upload batches for the current grid state and search term, and updates the grid. */
  async getBatchList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        search: this.search?.trim(),
      },
    });

    // Server-side paged/sorted/filtered list of batches.
    const res = await this.api.request('POST', API_ROUTES.GET_BULK_UPLOAD_BATCHES, body, {
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
    this.state = { ...this.state, skip: 0, filter: { logic: 'and', filters: [] } };
    await this.getBatchList();
  }

  /**
   * A batch that is still extracting — or has finished but not yet been sent
   * for claim validation — opens the Bulk Upload page, where the user can watch
   * progress and Submit. Once it has been submitted, the read-only Batch Detail
   * page is shown instead.
   */
  async viewBatch(row: any): Promise<void> {
    // The id in the URL is what the status endpoint takes as `batch_id`.
    const encId = await this.crypto.encryptId(String(row?.id));
    const s = (row?.status ?? '').toLowerCase();
    if (s === 'processing' || s === 'pending verification') {
      this.router.navigate(['/bulk-upload', encId]);
    } else {
      this.router.navigate(['/bulk-upload', encId, 'detail']);
    }
  }
}
