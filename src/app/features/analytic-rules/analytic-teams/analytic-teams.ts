import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { Router, RouterLink } from '@angular/router';
import { NgbDatepickerModule, NgbDateStruct, NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../../core/constants/permissions';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { FilterAndSortingService } from '../../../core/services/common-filter-sort.service';
import { toISOStartOfDay, toISOEndOfDay } from '../../../core/utils/date.util';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';
import { DeleteConfirmationComponent } from '../../../shared/components/delete-confirmation/delete-confirmation.component';

/**
 * Threshold Configuration → Team & Supervisor tab.
 *
 * POST /organization/powerbi/analytic-rules/teams/list
 *   { page, limit, search, sort_by, sort_order, from_date, to_date }
 *   -> { items: TeamSupervisorListResponse[], pagination }
 *
 * The API has no update endpoint (and the backend issues no
 * `analytic_team:update` permission), so a team is created, viewed, or
 * deleted — never edited.
 */
@Component({
  selector: 'app-analytic-teams',
  standalone: true,
  imports: [
    GridModule,
    NgbTooltipModule,
    NgbDatepickerModule,
    FormsModule,
    DatePipe,
    RouterLink,
    TrimWhitespaceDirective,
  ],
  templateUrl: './analytic-teams.html',
  styleUrl: './analytic-teams.scss',
})
export class AnalyticTeams implements OnInit {
  constructor(
    public api: ApiService,
    public router: Router,
    public crypto: CryptoService,
    public perms: PermissionService,
    public filterSort: FilterAndSortingService,
    public modal: NgbModal,
  ) {}

  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly teamsData = signal<GridDataResult>({ data: [], total: 0 });
  readonly pageSizes = [10, 25, 50];

  state: State = { skip: 0, take: 10, sort: [], filter: { logic: 'and', filters: [] } };

  search = '';
  fromDate: NgbDateStruct | null = null;
  toDate: NgbDateStruct | null = null;

  async ngOnInit(): Promise<void> {
    await this.getTeamList();
  }

  /** NgbDateStruct -> 'YYYY-MM-DD'. */
  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }

  /** Fetches one page of teams for the current grid state. */
  async getTeamList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        search: this.search?.trim(),
        from_date: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        to_date: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      },
      includeSort: false,
    });

    const res = await this.api.request('POST', API_ROUTES.GET_ANALYTIC_TEAMS, body, {
      showToaster: false,
    });

    if (res?.status) {
      const items = res.data?.items ?? [];
      this.teamsData.set({ data: items, total: res.data?.pagination?.total_records ?? items.length });
    }
  }

  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.getTeamList();
  }

  async onSearch(): Promise<void> {
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.getTeamList();
  }

  async clearSearch(): Promise<void> {
    this.search = '';
    this.fromDate = null;
    this.toDate = null;
    this.state = { ...this.state, skip: 0, filter: { logic: 'and', filters: [] } };
    await this.getTeamList();
  }

  /**
   * Supervisors of a team as one comma-separated string. Accepts either a
   * `supervisors` array (of names or `{ name }` objects) or the single
   * `supervisor_name` string the API returns today.
   */
  supervisorNames(row: any): string {
    const list = Array.isArray(row?.supervisors) ? row.supervisors : [row?.supervisor_name];
    return list
      .map((s: any) => String(s?.supervisor_name ?? s?.name ?? s ?? '').trim())
      .filter(Boolean)
      .join(', ');
  }

  /** Opens the read-only detail page. The `:id` route param is AES-GCM encrypted. */
  async viewTeam(row: any): Promise<void> {
    const encId = await this.crypto.encryptId(String(row?.id));
    this.router.navigate(['/analytic-rules/teams', encId]);
  }

  /** Confirms via modal, then deletes the team and refreshes the grid. */
  deleteTeam(row: any): void {
    const ref = this.modal.open(DeleteConfirmationComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });
    ref.componentInstance.message = 'Are you sure you want to delete this team?';
    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') return;
        const res = await this.api.request('DELETE', API_ROUTES.DELETE_ANALYTIC_TEAM, { id: row?.id });
        if (res?.status) await this.getTeamList();
      },
      () => {},
    );
  }
}
