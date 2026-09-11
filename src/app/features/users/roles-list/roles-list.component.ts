import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { NgbModal, NgbTooltipModule, NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { toISOStartOfDay, toISOEndOfDay } from '../../../core/utils/date.util';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { FilterAndSortingService } from '../../../core/services/common-filter-sort.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../../core/constants/permissions';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { DeleteConfirmationComponent } from '../../../shared/components/delete-confirmation/delete-confirmation.component';
import { StatusConfirmationComponent } from '../../../shared/components/status-confirmation/status-confirmation.component';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';

@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [
    BadgeClassPipe,
    GridModule,
    NgbTooltipModule,
    NgbDatepickerModule,
    FormsModule,
    RouterLink,
    DatePipe,
    TrimWhitespaceDirective,
  ],
  templateUrl: './roles-list.component.html',
  styleUrl: './roles-list.component.scss',
})
/**
 * Roles tab of Team Management: a paginated/filterable Kendo grid of
 * organization roles with create/edit/delete and active-status toggle actions.
 */
export class RolesListComponent implements OnInit {
  constructor(
    public api: ApiService,
    public filterSort: FilterAndSortingService,
    public crypto: CryptoService,
    public perms: PermissionService,
    public modal: NgbModal,
    public router: Router,
    public toast: ToastService,
    public auth: AuthService,
  ) {}

  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly loading = signal(false);
  readonly pageSizes = [10, 25, 50];

  // ── Roles grid state ──────────────────────────────────────────────
  readonly rolesData = signal<GridDataResult>({ data: [], total: 0 });

  state: State = {
    skip: 0,
    take: 10,
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  search = '';

  // Created Date filter → created_date_from / created_date_to
  fromDate: NgbDateStruct | null = null;
  toDate: NgbDateStruct | null = null;

  async ngOnInit(): Promise<void> {
    await this.getRoleList();
  }

  // ── Data loading ──────────────────────────────────────────────────

  /**
   * POST /api/v1/organization/roles/list  { page, limit, search, created_date_from, created_date_to, sort_by, order }
   */
  async getRoleList(): Promise<void> {
    this.loading.set(true);
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        search: this.search?.trim(),
        created_date_from: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        created_date_to: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      },
    });

    const resp = await this.api.request('POST', API_ROUTES.GET_ROLES, body, {
      showToaster: false,
    });

    if (resp?.status) {
      const d = resp.data;
      this.rolesData.set({
        data: d?.items ?? (Array.isArray(d) ? d : []),
        total: d?.pagination?.total_records ?? (Array.isArray(d) ? d.length : 0),
      });
    }
    this.loading.set(false);
  }

  // ── Roles: sort / page / filter / search ──────────────────────────
  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.getRoleList();
  }

  async onSearch(): Promise<void> {
    if (this.fromDate && this.toDate && this.toDateStr(this.fromDate) > this.toDateStr(this.toDate)) {
      this.toast.warning('"From" date cannot be after "To" date.');
      return;
    }
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.getRoleList();
  }

  async clearSearch(): Promise<void> {
    this.search = '';
    this.fromDate = null;
    this.toDate = null;
    this.state = { ...this.state, skip: 0 };
    await this.getRoleList();
  }

  // ── Roles: row actions ────────────────────────────────────────────
  /** Navigates to the empty Role form (create mode). */
  addRole(): void {
    this.router.navigate(['/team-management/role-form']);
  }

  /** Navigates to the Role form pre-loaded for editing; the id is encrypted for the URL. */
  async editRole(role: any): Promise<void> {
    const id = await this.crypto.encryptId(String(role.id));
    this.router.navigate(['/team-management/role-form', id]);
  }

  /** Confirms via modal, then deletes the role and refreshes the grid. */
  deleteRole(role: any): void {
    const ref = this.modal.open(DeleteConfirmationComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });
    ref.componentInstance.title = 'Delete Role';
    ref.componentInstance.message = `Are you sure you want to delete this role?`;

    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') return;
        // DELETE /organization/roles — removes the role by id.
        const resp = await this.api.request('DELETE', API_ROUTES.DELETE_ROLE, { role_id: role.id });
        if (resp?.status) await this.getRoleList();
      },
      () => {},
    );
  }

  /**
   * Status toggle.
   * API: PUT /organization/roles/status  Body: { role_id, status: "Active" | "Inactive" }
   */
  toggleRoleStatus(role: any, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const isChecked = checkbox.checked;
    const newStatus = isChecked ? 'Active' : 'Inactive';

    const ref = this.modal.open(StatusConfirmationComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });

    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') {
          checkbox.checked = !isChecked;
          return;
        }

        const resp = await this.api.request('PUT', API_ROUTES.UPDATE_ROLE_STATUS, {
          role_id: role.id,
          status: newStatus,
        });

        if (resp?.status) {
          await this.getRoleList();
        } else {
          checkbox.checked = !isChecked;
        }
      },
      () => {
        checkbox.checked = !isChecked;
      },
    );
  }

  // ── View helpers ──────────────────────────────────────────────────
  isActive(row: any): boolean {
    return row?.status === 'Active';
  }

  /** Role names longer than `limit` are cut short — the full name stays in the tooltip. */
  truncate(value: string | undefined, limit = 20): string {
    const text = value ?? '';
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
  }

  /** The default Organization Admin role can never be edited or deleted. */
  isSystemRole(role: any): boolean {
    if (role?.is_system_role === true) return true;
    const name = (role?.name ?? '').toLowerCase();
    return name.includes('organization admin') || name.includes('super admin');
  }

  /** Users can't inactivate the role currently assigned to them. */
  isOwnRole(role: any): boolean {
    const roleId = this.auth.currentUser()?.roleId;
    return !!roleId && String(role?.id) === String(roleId);
  }

  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }
}
