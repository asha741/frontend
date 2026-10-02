import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { GroupDescriptor, State, process } from '@progress/kendo-data-query';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../../core/constants/permissions';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { FilterAndSortingService } from '../../../core/services/common-filter-sort.service';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';
import { WorkloadThresholdModal } from './workload-threshold-modal/workload-threshold-modal';

/**
 * Threshold Configuration → Thresholds tab.
 *
 * POST /organization/powerbi/analytic-rules/workload/list
 *   { page, limit, search, sort_by, sort_order }
 *   -> WorkloadRuleResponse[] — grouped client-side by dashboard_category > sub_category
 *
 * Rules themselves are seeded by the backend (its create endpoint is marked
 * internal-use), so this page lists them and edits one field: the threshold
 * value, via PATCH .../workload/.
 */
@Component({
  selector: 'app-analytic-workload',
  standalone: true,
  imports: [GridModule, NgbTooltipModule, FormsModule, DatePipe, TrimWhitespaceDirective],
  templateUrl: './analytic-workload.html',
  styleUrl: './analytic-workload.scss',
})
export class AnalyticWorkload implements OnInit {
  constructor(
    public api: ApiService,
    public perms: PermissionService,
    public filterSort: FilterAndSortingService,
    public modal: NgbModal,
  ) {}

  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly rulesData = signal<GridDataResult>({ data: [], total: 0 });

  /** Rules are grouped by dashboard, then by the section within it. */
  readonly group: GroupDescriptor[] = [{ field: 'dashboard_category' }, { field: 'sub_category' }];

  // The full rule set is small, so it is fetched in one page and grouped client-side.
  state: State = { skip: 0, take: 1000, sort: [], filter: { logic: 'and', filters: [] } };

  search = '';

  async ngOnInit(): Promise<void> {
    await this.getRuleList();
  }

  /** Fetches one page of workload rules for the current grid state. */
  async getRuleList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: { search: this.search?.trim() },
      includeSort: false,
    });

    const res = await this.api.request('POST', API_ROUTES.GET_ANALYTIC_WORKLOAD_RULES, body, {
      showToaster: false,
    });

    if (res?.status) {
      const items: any[] = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      const grouped = process(items, { group: this.group });
      this.rulesData.set({ data: grouped.data, total: grouped.total });
    }
  }

  async onSearch(): Promise<void> {
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.getRuleList();
  }

  async clearSearch(): Promise<void> {
    this.search = '';
    this.state = { ...this.state, skip: 0 };
    await this.getRuleList();
  }

  /**
   * Opens the threshold editor for one rule. Only `threshold_value` is
   * editable — the rule name and its suffix are fixed by the backend, and are
   * shown in the modal for context only.
   */
  editThreshold(row: any): void {
    const ref = this.modal.open(WorkloadThresholdModal, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });
    const instance = ref.componentInstance as WorkloadThresholdModal;
    instance.rule = row;
    ref.result.then(
      async (result) => {
        if (result === 'saved') await this.getRuleList();
      },
      () => {},
    );
  }
}
