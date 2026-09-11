import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import {
  NgbModal,
  NgbTooltipModule,
  NgbDatepickerModule,
  NgbDateStruct,
} from '@ng-bootstrap/ng-bootstrap';
import { toISOStartOfDay, toISOEndOfDay } from '../../../core/utils/date.util';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { FilterAndSortingService } from '../../../core/services/common-filter-sort.service';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../../core/constants/permissions';
import { CryptoService } from '../../../core/services/crypto.service';
import { ToastService } from '../../../core/services/toast.service';
import { CustomDropDownListFilterComponent } from '../../../core/services/dropdownfilter.component';
import { DeleteConfirmationComponent } from '../../../shared/components/delete-confirmation/delete-confirmation.component';
import { StatusConfirmationComponent } from '../../../shared/components/status-confirmation/status-confirmation.component';
import { UsPhonePipe } from '../../../shared/pipes/us-phone.pipe';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';
import { RolesListComponent } from '../roles-list/roles-list.component';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [
    BadgeClassPipe,
    GridModule,
    NgbTooltipModule,
    NgbDatepickerModule,
    FormsModule,
    RouterLink,
    DatePipe,
    UsPhonePipe,
    CustomDropDownListFilterComponent,
    TrimWhitespaceDirective,
    RolesListComponent,
  ],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss',
})
/**
 * Team Management page: hosts the Users and Roles tabs. Renders the paginated
 * Users grid (search, date/column filters, KPI cards) with row actions for
 * edit/delete/status-toggle/resend-invitation, and gates each tab and action
 * behind the corresponding module permissions.
 */
export class UsersListComponent implements OnInit {
  constructor(
    public api: ApiService,
    public filterSort: FilterAndSortingService,
    public auth: AuthService,
    public perms: PermissionService,
    public crypto: CryptoService,
    public modal: NgbModal,
    public router: Router,
    public route: ActivatedRoute,
    public toast: ToastService,
  ) {}

  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  /** Exposed so the top-bar Role filter can name its lookup endpoint. */
  readonly API_ROUTES = API_ROUTES;

  readonly loading = signal(false);
  readonly activeTab = signal<'users' | 'roles'>('users');
  readonly usersData = signal<GridDataResult>({ data: [], total: 0 });

  readonly pageSizes = [10, 25, 50];

  /** KPI counters from GET /organization/users/kpis */
  readonly kpiData = signal<{
    total_users: number;
    active_users: number;
    pending_invitations: number;
  } | null>(null);

  // ── Kendo grid state — mirrors reference pattern exactly ───────────
  state: State = {
    skip: 0,
    take: 10,
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  // Global search box (name / email) — sent as the `search` param
  search = '';

  // Top-row date picker bindings → created_date_from / created_date_to
  fromDate: NgbDateStruct | null = null;
  toDate: NgbDateStruct | null = null;

  /** Logged-in user's display admin id (`admin_id` on a grid row). */
  currentUserId = '';

  /** Logged-in user's internal id (`id` on a grid row). */
  currentUserDbId = '';

  /** Role options loaded from GET /organization/roles/dropdown — same source as the Add/Edit User form */
  roleOptions: { label: string; value: string }[] = [];

  /** Status options loaded from /meta/enums */
  statusOptions: { label: string; value: string }[] = [];

  /** Invitation status options loaded from /meta/enums */
  invitationOptions: { label: string; value: string }[] = [];

  /**
   * The Roles tab lives inside this page rather than on its own route, so it's
   * gated here instead of by `PermissionGuard`.
   */
  readonly canManageRoles = computed(() =>
    this.perms.canAny(
      PERMISSION_MODULE.Role,
      PERMISSION_ACTION.Read,
      PERMISSION_ACTION.Create,
      PERMISSION_ACTION.Update,
      PERMISSION_ACTION.Delete,
    ),
  );

  /** The Users tab needs `User: Read`; role-only users see just the Roles tab. */
  readonly canViewUsers = computed(() =>
    this.perms.can(PERMISSION_MODULE.User, PERMISSION_ACTION.Read),
  );

  async ngOnInit(): Promise<void> {
    // Resolved before the grid paints so the self-row checks are already correct
    // on the first render.
    const user = await this.auth.getUser();
    this.currentUserId = user?.userId ?? '';
    this.currentUserDbId = user?.id ?? '';

    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    // Role-only users (no User read) land straight on the Roles tab.
    if (requestedTab === 'roles' || !this.canViewUsers()) {
      this.switchTab('roles');
    }

    if (this.canViewUsers()) {
      await this.loadDropdownOptions();
      await this.loadKpis();
      await this.getUserList();
    }
  }

  // ── Kendo dropdown filter options ───────────────────────────────────

  async loadDropdownOptions(): Promise<void> {
    // POST-only endpoint (a GET answers 405); an empty `search` asks for the
    // full list, same body the lookup service sends with a term.
    const rolesResp = await this.api.request(
      'POST',
      API_ROUTES.GET_ROLES_DROPDOWN,
      { search: '' },
      {
        showToaster: false,
      },
    );
    if (rolesResp?.status) {
      const d = rolesResp.data;
      const roles = Array.isArray(d) ? d : (d?.items ?? d?.options ?? d?.data ?? []);
      this.roleOptions = roles.map((r: any) => {
        const name = r.name ?? r.role_name ?? r.label ?? '';
        return { label: name, value: name };
      });
    }

    // Load status & invitation options from /meta/enums
    const enumsResp = await this.api.request(
      'POST',
      API_ROUTES.GET_MASTER_LIST,
      { typeIds: [1, 2] },
      {
        showToaster: false,
      },
    );
    if (enumsResp?.status && Array.isArray(enumsResp.data)) {
      const data = enumsResp.data;

      // The account-status enum also includes Locked/Recovered/Deleted, but the
      // grid's toggle & filter only distinguish Active vs. Inactive.
      const userStatusType = data.find((d: any) => d.typeId === 1);
      if (userStatusType && Array.isArray(userStatusType.options)) {
        this.statusOptions = userStatusType.options.filter((o: any) =>
          ['active', 'inactive'].includes(String(o.value ?? o.label ?? '').toLowerCase()),
        );
      }

      const invStatusType = data.find((d: any) => d.typeId === 2);
      if (invStatusType && Array.isArray(invStatusType.options)) {
        this.invitationOptions = [...invStatusType.options];
      }
    }
  }

  // ── KPI cards ──────────────────────────────────────────────────────

  async loadKpis(): Promise<void> {
    const res = await this.api.request('GET', API_ROUTES.GET_USERS_KPIS, null, {
      showToaster: false,
    });
    if (res?.status) {
      this.kpiData.set(res.data ?? null);
    }
  }

  switchTab(tab: 'users' | 'roles'): void {
    // Also blocks the ?tab=roles deep link, which skips the (hidden) tab button.
    if (tab === 'roles' && !this.canManageRoles()) return;
    if (tab === 'users' && !this.canViewUsers()) return;
    this.activeTab.set(tab);
    // Re-fetch the users list whenever the Users tab becomes active so the
    // grid reflects any role changes made while on the Roles tab.
    if (tab === 'users') {
      this.loadDropdownOptions();
      this.loadKpis();
      this.getUserList();
    }
  }

  // ── Data loading ───────────────────────────────────────────────────

  /**
   * Loads the user list. The grid state (page / sort / column filters) and the
   * top-bar controls (search box + date pickers) are translated into the
   * backend's flat params object by the single reusable
   * `FilterAndSortingService.buildRequestBody()` helper, then sent as a POST body.
   *
   * POST /api/v1/organization/users/list  { page, limit, search, role, status, created_date_from, created_date_to… }
   */
  async getUserList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        search: this.search?.trim(),
        // End-of-day upper bound so the "To" date is fully inclusive
        created_date_from: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        created_date_to: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      },
      // Kendo boolean column filters emit true/false → backend status enum
      valueMap: {
        status: (v) => (v ? 'Active' : 'Inactive'),
        invitation_status: (v) => (v ? 'Accepted' : 'Pending'),
      },
    });
    const res = await this.api.request('POST', API_ROUTES.GET_USERS, body, {
      showToaster: false,
    });
    if (res?.status) {
      const d = res.data;
      this.usersData.set({
        data: d?.items ?? [],
        total: d?.pagination?.total_records ?? 0,
      });
    }
  }

  // ── Grid paging / sorting / column filtering ──────────────────────

  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.getUserList();
  }

  // ── Global search ─────────────────────────────────────────────────

  async onSearch(): Promise<void> {
    // Validate date range: from must not be after to
    if (
      this.fromDate &&
      this.toDate &&
      this.toDateStr(this.fromDate) > this.toDateStr(this.toDate)
    ) {
      this.toast.warning('"From" date cannot be after "To" date.');
      return;
    }
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.getUserList();
  }

  async clearSearch(): Promise<void> {
    this.search = '';
    this.fromDate = null;
    this.toDate = null;
    this.state = { ...this.state, skip: 0 };
    await this.getUserList();
  }

  // ── Row actions ────────────────────────────────────────────────────

  /** Navigates to the User form pre-loaded for editing; the id is encrypted for the URL. */
  async editUser(user: any): Promise<void> {
    const id = await this.crypto.encryptId(String(user.id));
    this.router.navigate(['/team-management/user-form', id]);
  }

  /** Confirms via modal, then deletes the user and refreshes the KPI cards and grid. */
  deleteUser(user: any): void {
    const ref = this.modal.open(DeleteConfirmationComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });
    ref.componentInstance.message = 'Are you sure you want to delete this user?';

    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') return;
        // DELETE /organization/users — removes the user by id.
        await this.api.request('DELETE', API_ROUTES.DELETE_USER, { user_id: user.id });
        await this.loadKpis();
        // Always reload to reflect true server state
        await this.getUserList();
      },
      () => {},
    );
  }

  /**
   * Status toggle.
   * API: PUT /organization/users  Body: { user_id, status: "Active" | "Inactive" }
   */
  onStatusChange(user: any, event: Event): void {
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

        const resp = await this.api.request('PUT', API_ROUTES.UPDATE_USER, {
          user_id: user.id,
          status: newStatus,
        });

        if (resp?.status) {
          await this.loadKpis();
          await this.getUserList();
        } else {
          checkbox.checked = !isChecked;
        }
      },
      () => {
        checkbox.checked = !isChecked;
      },
    );
  }

  /** Confirms via modal, then re-sends the pending invitation email for the user. */
  resendInvitation(user: any): void {
    const ref = this.modal.open(StatusConfirmationComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });
    ref.componentInstance.title = 'Resend Invitation';
    ref.componentInstance.message = `Are you sure you want to resend the invitation link to ${user.email || 'this user'}?`;
    ref.componentInstance.confirmButtonText = 'Resend';

    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') return;
        // POST /organization/users/resend-invitation — re-triggers the invite email.
        const resp = await this.api.request('POST', API_ROUTES.RESEND_INVITATION_LINK, {
          user_id: user.id,
        });
        if (resp?.status) await this.getUserList();
      },
      () => {},
    );
  }

  // ── View helpers ──────────────────────────────────────────────────

  isActive(row: any): boolean {
    return row?.status === 'Active';
  }

  /**
   * True when the row is the logged-in user. Matched on the admin id the row
   * shows (`user_id`) and, as a fallback, the internal record id — the list and
   * the profile don't always name the same field the same way.
   */
  isSelf(row: any): boolean {
    const rowAdminId = row?.user_id ?? row?.admin_id ?? '';
    return (
      (!!this.currentUserId && rowAdminId === this.currentUserId) ||
      (!!this.currentUserDbId && row?.id === this.currentUserDbId)
    );
  }

  /** Invitation label; the colour comes from the badgeClass pipe. */
  invitationLabel(row: any): string {
    const status = (row?.invitation_status ?? '').toLowerCase();
    if (status === 'accepted') return 'Accepted';
    if (status === 'expired') return 'Expired';
    return 'Pending';
  }

  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }

  /**
   * True when this row is the organization's last remaining admin. The backend
   * flags this (`isLastOrgAdmin`) so we don't allow anyone — including other
   * admins — to edit or delete the last admin and leave the org headless.
   */
  isLastOrgAdmin(row: any): boolean {
    return !!row?.isLastOrgAdmin;
  }
}
