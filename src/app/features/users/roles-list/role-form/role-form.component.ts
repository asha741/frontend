import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { API_ROUTES } from '../../../../core/constants/api-routes';
import { FocusFirstInputDirective } from '../../../../core/services/focusFirstInput.directive';
import { CryptoService } from '../../../../core/services/crypto.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TrimWhitespaceDirective } from '../../../../shared/directives/trim-whitespace.directive';
import { noWhitespaceValidator } from '../../../../core/utils/validators.util';

/** A single permission returned by GET /organization/roles/permissions.
 *  `name` holds the backend code in "<module>:<action>" form, e.g. "roles:read".
 */
interface PermissionItem {
  id: string;
  name: string;
  /** Human-readable action label, e.g. "Read" */
  actionLabel: string;
  module: string;
  menuType: number;
  selected: boolean;
}

/** All permissions for one module — maps to one table row. */
interface PermissionGroup {
  module: string;
  moduleLabel: string;
  menuType: number;
  permissions: PermissionItem[];
}

@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, TrimWhitespaceDirective, FocusFirstInputDirective],
  templateUrl: './role-form.component.html',
  styleUrl: './role-form.component.scss',
})
/**
 * Create/Edit form for an organization Role. Loads the master permission
 * list, lets the admin tick permissions per module, and submits either a
 * create or update request depending on whether an id is present in the route.
 */
export class RoleFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly crypto = inject(CryptoService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly isSubmitted = signal(false);
  readonly isEdit = signal(false);

  readonly permissionGroups = signal<PermissionGroup[]>([]);

  private roleId: string | null = null;

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), noWhitespaceValidator()]],
    description: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(250), noWhitespaceValidator()]],
    status: [true],
  });

  get f() {
    return this.form.controls;
  }

  async ngOnInit(): Promise<void> {
    const encId = this.route.snapshot.paramMap.get('id');
    if (encId) {
      this.isEdit.set(true);
      let decodedId = encId;
      try {
        decodedId = await this.crypto.decryptId(encId);
      } catch {
        // Likely a plain (unencrypted) id in the URL — proceed with the raw value.
      }
      this.roleId = decodedId;
    }

    await this.loadPermissions();

    if (this.isEdit() && this.roleId) {
      await this.loadRole(this.roleId);
    }
  }

  /** GET /organization/roles/permissions — the master list, grouped by module. */
  async loadPermissions(): Promise<void> {
    const res = await this.api.request('GET', API_ROUTES.GET_PERMISSIONS, null, { showToaster: false });
    if (!res?.status || !Array.isArray(res.data)) return;

    const groupsByModule = new Map<string, PermissionGroup>();

    // `isHidden` permissions (e.g. User → Unlock) are internal-only and never offered here.
    (res.data as any[]).filter((item) => !item.isHidden).forEach((item) => {
      if (!groupsByModule.has(item.module)) {
        groupsByModule.set(item.module, {
          module: item.module,
          moduleLabel: this.toTitleCase(item.module),
          menuType: item.menuType,
          permissions: [],
        });
      }

      // `code` is the unique identifier the backend expects (e.g. "user:read");
      // `name` is the display label (e.g. "Read").
      const code = item.code || `${item.module}:${item.name}`.toLowerCase();

      groupsByModule.get(item.module)!.permissions.push({
        id: item.id,
        name: code,
        actionLabel: item.name,
        module: item.module,
        menuType: item.menuType,
        selected: false,
      });
    });

    this.permissionGroups.set(Array.from(groupsByModule.values()));
  }

  /** POST /organization/roles/detail — prefills the form + ticks the granted permissions. */
  async loadRole(id: string): Promise<void> {
    this.loading.set(true);
    const res = await this.api.request('POST', API_ROUTES.GET_ROLE_BY_ID, { role_id: id }, {
      showToaster: false,
    });
    this.loading.set(false);

    if (!res?.status || !res.data) return;

    this.form.patchValue({
      name: res.data.name ?? '',
      description: res.data.description ?? '',
      status: res.data.status === 'Active' || res.data.status === true,
    });

    // The API returns permissions as a flat string array: ["user:create", "user:read", …]
    const selectedSet = new Set<string>(
      (res.data.permissions ?? []).map((p: any) => (typeof p === 'string' ? p : (p.name ?? ''))),
    );

    this.permissionGroups.update((groups) =>
      groups.map((group) => ({
        ...group,
        permissions: group.permissions.map((perm) => ({
          ...perm,
          selected: selectedSet.has(perm.name),
        })),
      })),
    );
  }

  /**
   * Individual permission checkbox handler. The signal is the only source of
   * truth, so the new checked state is read off the native event.
   *
   * Rules:
   *  • Any non-read action checked → auto-check "read" for that module.
   *  • "read" unchecked           → uncheck every other permission in the module.
   */
  onPermissionChange(changedPerm: PermissionItem, group: PermissionGroup, event: Event): void {
    const newChecked = (event.target as HTMLInputElement).checked;
    const action = changedPerm.name?.split(':')[1]?.toLowerCase() ?? '';

    this.permissionGroups.update((groups) =>
      groups.map((g) => {
        if (g.module !== group.module) return g;

        let perms = g.permissions.map((p) => ({
          ...p,
          selected: p.id === changedPerm.id ? newChecked : p.selected,
        }));

        if (action !== 'read' && newChecked) {
          perms = perms.map((p) => {
            const pAction = p.name?.split(':')[1]?.toLowerCase() ?? '';
            return pAction === 'read' ? { ...p, selected: true } : p;
          });
        }

        if (action === 'read' && !newChecked) {
          perms = perms.map((p) => ({ ...p, selected: false }));
        }

        return { ...g, permissions: perms };
      }),
    );
  }

  hasAnyPermissionSelected(): boolean {
    return this.permissionGroups().some((g) => g.permissions.some((p) => p.selected));
  }

  /**
   * Validates the form and permission selection, then creates or updates the
   * role via the API (method/endpoint chosen based on `isEdit()`), and
   * navigates back to the Team Management roles tab on success.
   */
  async onSave(): Promise<void> {
    this.isSubmitted.set(true);
    if (this.form.invalid) return;

    if (!this.hasAnyPermissionSelected()) {
      this.toast.error('Please select at least one permission.');
      return;
    }


    const { name, description, status } = this.form.getRawValue();
    const payload: any = {
      name,
      description,
      status: status ? 'Active' : 'Inactive',
      permissions: this.buildSelectedPermissionNames(),
    };
    if (this.isEdit()) payload.role_id = this.roleId;

    const endpoint = this.isEdit() ? API_ROUTES.UPDATE_ROLE : API_ROUTES.ADD_ROLE;
    const method = this.isEdit() ? 'PUT' : 'POST';

    const resp = await this.api.request(method, endpoint, payload);
    if (resp?.status) {
      this.form.reset();
      this.router.navigate(['/team-management'], { queryParams: { tab: 'roles' } });
    }
  }

  /** Collects every checked permission code for API submission. */
  private buildSelectedPermissionNames(): string[] {
    return this.permissionGroups().flatMap((g) =>
      g.permissions.filter((p) => p.selected).map((p) => p.name),
    );
  }

  /** Convert snake_case / colon-separated strings to Title Case for display. */
  toTitleCase(value: string): string {
    return (value ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
