import { Component, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FocusFirstInputDirective } from '../../../../core/services/focusFirstInput.directive';
import { ApiService } from '../../../../core/services/api.service';
import { API_ROUTES } from '../../../../core/constants/api-routes';
import { AuthService } from '../../../../core/services/auth.service';
import { DataService } from '../../../../core/services/data.service';
import { CryptoService } from '../../../../core/services/crypto.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoaderService } from '../../../../core/services/loader.service';
import { LookupService } from '../../../../core/services/lookup.service';
import { noWhitespaceValidator } from '../../../../core/utils/validators.util';
import { PhoneMaskDirective } from '../../../../shared/directives/phone-mask.directive';
import { TrimWhitespaceDirective } from '../../../../shared/directives/trim-whitespace.directive';
import { PhoneFormatPipe } from '../../../../shared/pipes/phone-format.pipe';
import { SearchAutocompleteComponent } from '../../../../shared/components/search-autocomplete/search-autocomplete.component';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PhoneMaskDirective,
    FocusFirstInputDirective,
    TrimWhitespaceDirective,
    SearchAutocompleteComponent,
  ],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.scss',
  providers: [PhoneFormatPipe],
})
/**
 * Create/Edit form for an organization User. Handles role autocomplete
 * (via the roles dropdown lookup), locks the Role field when a user is
 * editing themselves, and submits either a create or update request
 * depending on whether an id is present in the route.
 */
export class UserFormComponent implements OnInit {
  readonly isEdit = signal(false);
  readonly isSubmitted = signal(false);
  /** True when the record being edited is the logged-in user's own account. */
  readonly isSelfEdit = signal(false);
  readonly form: FormGroup;

  /** Exposed so the template can name the Role lookup endpoint. */
  readonly API_ROUTES = API_ROUTES;

  private userId: string | null = null;

  constructor(
    public fb: FormBuilder,
    public api: ApiService,
    public router: Router,
    public route: ActivatedRoute,
    public auth: AuthService,
    public dataService: DataService,
    public crypto: CryptoService,
    public toast: ToastService,
    public loader: LoaderService,
    public lookup: LookupService,
    private phoneFormatPipe: PhoneFormatPipe,
  ) {
    const emailregex: RegExp = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    this.form = this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), noWhitespaceValidator()]],
      last_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), noWhitespaceValidator()]],
      email: ['', [Validators.required, Validators.pattern(emailregex)]],
      contactNumber: ['', [Validators.required, Validators.pattern(/^\(\d{3}\) \d{3}-\d{4}$/)]],
      role_name: ['', Validators.required],
      status: [true], // Kept for logic even if commented in UI
    });
  }

  get f() {
    return this.form.controls;
  }

  async ngOnInit(): Promise<void> {
    // The roles list is NOT preloaded — the Role field searches
    // /organization/roles/dropdown as the user types (see the template).
    const encId = this.route.snapshot.paramMap.get('id');
    if (encId) {
      this.isEdit.set(true);

      // Handle either encrypted IDs or plain UUIDs
      let decodedId = encId;
      try {
        decodedId = await this.crypto.decryptId(encId);
      } catch (e) {
        console.warn('ID decryption failed (likely a plain GUID in URL). Proceeding with raw ID.');
      }

      this.userId = decodedId;
      await this.loadUser(this.userId);

      // Nobody changes their own role — that control stays disabled (its
      // value still rides along via `getRawValue()` in `onSave()`). Status is
      // no longer editable in the UI at all; its last-known value is just
      // carried through to the backend as-is.
      const me = await this.auth.getUser();
      console.log('Current user:', me, 'Editing user ID:', decodedId);
      const isSelf = !!me && (decodedId === me.id || decodedId === me.userId);
      this.isSelfEdit.set(isSelf);
      if (isSelf) {
        this.f['role_name'].disable();
      }
    }
  }

  /** Fetches the user by id and patches the form (including a role-validity check). */
  async loadUser(id: string): Promise<void> {
    // `isRoleActive()` below calls the lookup endpoint with `showLoader: false`
    // (by design — autocomplete typing shouldn't flash the global spinner), so
    // without this explicit show/hide the overlay would drop the instant
    // GET_USER_BY_ID resolves, leaving the form fully visible — with the
    // `status` control still at its unpatched default — until the role check
    // finishes. That gap is what read as the toggle flipping from Active to
    // Inactive on its own. Keeping the global loader up for the whole method
    // closes that gap using the loader everything else already relies on.
    this.loader.show();
    try {
      const resp = await this.api.request(
        'POST',
        API_ROUTES.GET_USER_BY_ID,
        { user_id: id },
        {
          showToaster: false,
          showLoader: false,
        },
      );

      if (resp?.status && resp.data) {
        const user = resp.data;
        // Backend field names vary by source; fall back through the known aliases.
        const rawPhone = user.phone ?? user.contactNumber ?? user.contact_number ?? '';
        const userRole = user.role ?? user.roleId ?? user.role_name ?? '';

        // The lookup only returns active roles. If this user's assigned role has
        // since been disabled, patching it in anyway would show a name that can no
        // longer be re-picked while Validators.required never fires. Fall back to
        // '' so the field and the validator agree nothing is actually selected.
        const roleStillActive = userRole ? await this.isRoleActive(userRole) : false;

        this.form.patchValue({
          first_name: user.firstName ?? user.first_name ?? '',
          last_name: user.lastName ?? user.last_name ?? '',
          email: user.email ?? '',
          contactNumber: this.phoneFormatPipe.transform(rawPhone),
          role_name: roleStillActive ? userRole : '',
          status: user.status === 'Active',
        });
      }
    } finally {
      this.loader.hide();
    }
  }

  /** Exact-name check against the roles lookup (it returns active roles only). */
  private async isRoleActive(name: string): Promise<boolean> {
    const matches = await this.lookup.search(API_ROUTES.GET_ROLES_DROPDOWN, name);
    return matches.some((o) => o.label.toLowerCase() === name.toLowerCase());
  }

  /** Validates the form, then creates or updates the user via the API, surfacing duplicate-email errors on the field. */
  async onSave(): Promise<void> {
    this.isSubmitted.set(true);
    if (this.form.invalid) {
      return;
    }

    const endpoint = this.isEdit() ? API_ROUTES.UPDATE_USER : API_ROUTES.ADD_USER;

    const rawForm = this.form.getRawValue();

    // Construct the payload with exact requested keys
    const payload: any = this.isEdit()
      ? {
          user_id: this.userId,
          first_name: rawForm.first_name,
          last_name: rawForm.last_name,
          email: rawForm.email,
          contact_number: rawForm.contactNumber?.replace(/\D/g, ''),
          role_name: rawForm.role_name,
          // MFA is mandatory for all users — the form toggle was removed.
          mfa_enabled: true,
          status: rawForm.status ? 'Active' : 'Inactive',
        }
      : {
          first_name: rawForm.first_name,
          last_name: rawForm.last_name,
          email: rawForm.email,
          contact_number: rawForm.contactNumber?.replace(/\D/g, ''),
          role_name: rawForm.role_name,
          mfa_enabled: true,
          status: rawForm.status ? 'Active' : 'Inactive',
        };

    const method = this.isEdit() ? 'PUT' : 'POST';

    // The global toaster stays on, so the backend's own failure message
    // (e.g. duplicate email, "already associated with other organization")
    // is what the user sees — no hardcoded text duplicated here.
    const resp = await this.api.request(method, endpoint, payload, {
      showToaster: true,
    });

    if (!resp) return;

    if (resp.status) {
      this.router.navigate(['/team-management']);
      return;
    }

    // Duplicate email also gets flagged on the field itself, in addition to the toast.
    if (this.isDuplicateEmailError(resp.message)) {
      this.f['email'].setErrors({ emailExists: true });
    }
  }

  /** Detects the backend's "email already exists" failure from its message. */
  private isDuplicateEmailError(message: string | undefined): boolean {
    const m = (message ?? '').toLowerCase();
    return m.includes('email') && /exist|already|taken|registered|in use/.test(m);
  }
}
