import { Component, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, Pagination, PaginatedData } from '../../core/services/api.service';
import { API_ROUTES } from '../../core/constants/api-routes';
import { TrimWhitespaceDirective } from '../../shared/directives/trim-whitespace.directive';

/** Shape of an organization record as returned by the API. Indexer allows extra/unknown fields from the backend. */
interface Organization {
  id: string;
  name: string;
  type: string;
  email: string;
  phone: string;
  status?: string;
  [key: string]: any;
}

/**
 * Feature component for listing, searching, creating, editing and deleting organizations.
 * Handles its own paging/search state and loads status enum options for the org form.
 */
@Component({
  selector: 'app-organizations',
  standalone: true,
  imports: [ReactiveFormsModule, TrimWhitespaceDirective],
  templateUrl: './organizations.component.html',
  styleUrl: './organizations.component.scss',
})
export class OrganizationsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly organizations = signal<Organization[]>([]);
  readonly pagination = signal<Pagination | null>(null);

  private currentPage = 1;
  private searchTerm = '';

  readonly form = this.fb.group({
    name: ['', Validators.required],
    type: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
  });

  /** Organization Status options loaded from /meta/enums */
  orgStatusOptions: { label: string; value: string }[] = [];

  /**
   * Lifecycle hook: loads the organization status enum options (typeId 5) used to
   * populate the status dropdown, then kicks off the initial organizations list load.
   */
  async ngOnInit(): Promise<void> {
    // POST to the shared master-list/enums endpoint, requesting only the "org status" enum (typeId 5).
    // Toaster is suppressed since this is a background lookup, not a user-initiated action.
    const enumsResp = await this.api.request('POST', API_ROUTES.GET_MASTER_LIST, { typeIds: [5] }, {
      showToaster: false,
    });
    if (enumsResp?.status && Array.isArray(enumsResp.data)) {
      const data = enumsResp.data;
      // The endpoint can return multiple enum groups; pick out the one matching typeId 5 (org status).
      const orgStatusType = data.find((d: any) => d.typeId === 5);
      if (orgStatusType && Array.isArray(orgStatusType.options)) {
        this.orgStatusOptions = [...orgStatusType.options];
      }
    }

    this.loadOrgs();
  }

  /** Fetches the current page of organizations (filtered by searchTerm) and updates list/pagination signals. */
  async loadOrgs(): Promise<void> {
    this.loading.set(true);
    // Endpoint returns a paginated list of organizations matching the current page/search criteria.
    // showLoader is disabled here because `loading` signal already drives the UI's loading state.
    const resp = await this.api.request('POST', API_ROUTES.GET_ORGANIZATIONS, {
      page: this.currentPage,
      pageSize: 10,
      search: this.searchTerm,
    }, { showLoader: false, showToaster: false });
    if (resp?.status) {
      const payload = resp.data as PaginatedData<Organization> | undefined;
      this.organizations.set(payload?.data ?? []);
      this.pagination.set(payload?.pagination ?? null);
    }
    this.loading.set(false);
  }

  /** Handles the search input's change/input event: resets to page 1 and reloads results for the new term. */
  onSearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.currentPage = 1;
    this.loadOrgs();
  }

  /** Changes the active page and reloads the organizations list. */
  onPageChange(page: number): void { this.currentPage = page; this.loadOrgs(); }

  /** Returns true when the given form field has failed validation and the user has already interacted with it. */
  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  /** Opens the form pre-filled with an existing organization's data for editing. */
  editOrg(org: Organization): void {
    this.editingId.set(org.id);
    this.form.patchValue({ name: org.name, type: org.type, email: org.email, phone: org.phone });
    this.showForm.set(true);
  }

  /** Closes the form and clears editing state / form values, returning to the initial "add" state. */
  cancelForm(): void { this.showForm.set(false); this.editingId.set(null); this.form.reset(); }

  /**
   * Validates and submits the organization form, creating a new organization or updating
   * the one currently being edited depending on whether `editingId` is set.
   */
  async onSubmit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const editingId = this.editingId();
    // Branch between update and create endpoints based on whether we're editing an existing org.
    const resp = editingId
      ? await this.api.request('POST', API_ROUTES.UPDATE_ORGANIZATION, { id: editingId, ...this.form.value }, { showLoader: false })
      : await this.api.request('POST', API_ROUTES.ADD_ORGANIZATION, this.form.value, { showLoader: false });
    this.saving.set(false);
    if (resp?.status) {
      this.cancelForm();
      this.loadOrgs();
    }
  }

  /** Prompts for confirmation, then deletes the organization with the given id and refreshes the list. */
  async deleteOrg(id: string): Promise<void> {
    if (!confirm('Delete this organization?')) return;
    // Deletes the organization identified by `requestId` on the backend.
    const resp = await this.api.request('POST', API_ROUTES.DELETE_ORGANIZATION, { requestId: id });
    if (resp?.status) { this.loadOrgs(); }
  }
}
