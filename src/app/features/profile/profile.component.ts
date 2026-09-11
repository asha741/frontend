import { Component, OnInit, computed, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { API_ROUTES } from '../../core/constants/api-routes';
import { FocusFirstInputDirective } from '../../core/services/focusFirstInput.directive';
import { ConfigService } from '../../core/config/config.service';
import { FileUploadService } from '../../core/services/fileUpload.service';
import { ToastService } from '../../core/services/toast.service';
import { differentFieldValidator, matchFieldValidator, passwordPolicyValidator } from '../../core/utils/validators.util';
import { PhoneFormatPipe } from '../../shared/pipes/phone-format.pipe';
import { PhoneMaskDirective } from '../../shared/directives/phone-mask.directive';
import { TrimWhitespaceDirective } from '../../shared/directives/trim-whitespace.directive';

/** `GET /organization/dashboard/profile` payload — the sole source for this page. */
interface DashboardProfile {
  org_name: string;
  org_logo_key: string;
  org_logo_url: string;
  first_name: string;
  last_name: string;
  email: string;
  contact_number: string;
  profile_picture_key: string;
  profile_picture_url: string;
  role_name: string;
}

/**
 * Agency profile page — personal details, avatar, organization details and
 * password. Everything except the password change is read from and written
 * to a single endpoint: `GET`/`PATCH /organization/dashboard/profile`.
 *
 * The org admin additionally sees an "Organization Details" section (name +
 * logo), gated on `auth.isOrgAdmin()` (from `is_org_admin` on
 * `/organization/auth/profile`) — those two fields are only included in the
 * PATCH body when the current user is an org admin.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, PhoneMaskDirective, TrimWhitespaceDirective, FocusFirstInputDirective],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  providers: [PhoneFormatPipe],
})
export class ProfileComponent implements OnInit {
  readonly loading = signal(false);
  readonly savingPassword = signal(false);
  readonly activePanel = signal<'details' | 'password'>('details');

  readonly isProfileSubmitted = signal(false);
  readonly isPasswordSubmitted = signal(false);

  // Show/hide toggles for each change-password field (eye icon).
  readonly showCurrentPassword = signal(false);
  readonly showNewPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  readonly isOrgAdmin = computed(() => this.auth.isOrgAdmin());
  readonly profile = signal<DashboardProfile | null>(null);
  readonly uploadingOrgLogo = signal(false);
  readonly savingOrgProfile = signal(false);
  readonly isOrgSubmitted = signal(false);

  // Org logo is picked immediately (validated + previewed) but only actually
  // uploaded when the form is submitted — see updateProfile().
  readonly orgLogoFile = signal<File | null>(null);
  readonly orgLogoPreviewUrl = signal<string | null>(null);

  readonly profileForm: FormGroup;
  readonly passwordForm: FormGroup;

  constructor(
    public auth: AuthService,
    public api: ApiService,
    public fb: FormBuilder,
    public router: Router,
    public config: ConfigService,
    public fileUpload: FileUploadService,
    public toast: ToastService,
    public phoneFormatPipe: PhoneFormatPipe,
  ) {
    this.profileForm = this.fb.group({
      // Required validator is added dynamically once we know `isOrgAdmin` —
      // non-org-admins never see this field and must not be blocked by it.
      orgName: ['', [Validators.minLength(2), Validators.maxLength(100)]],
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      contactNumber: ['', [Validators.required, Validators.pattern(/^\(\d{3}\) \d{3}-\d{4}$/)]],
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [passwordPolicyValidator(), differentFieldValidator('currentPassword')]],
      confirmPassword: ['', [Validators.required, matchFieldValidator('newPassword')]],
    });

    // Re-check the confirm-password match whenever the new password changes
    // (matchFieldValidator otherwise only runs when confirm itself changes).
    this.passwordForm.get('newPassword')?.valueChanges.subscribe(() => {
      this.passwordForm.get('confirmPassword')?.updateValueAndValidity({ emitEvent: false });
    });

    // Re-check "new differs from current" whenever the current password changes.
    this.passwordForm.get('currentPassword')?.valueChanges.subscribe(() => {
      this.passwordForm.get('newPassword')?.updateValueAndValidity({ emitEvent: false });
    });
  }

  get pf() {
    return this.profileForm.controls;
  }

  get pwf() {
    return this.passwordForm.controls;
  }

  async ngOnInit(): Promise<void> {
    if (this.isOrgAdmin()) {
      this.pf['orgName'].addValidators(Validators.required);
      this.pf['orgName'].updateValueAndValidity({ emitEvent: false });
    }
    await this.loadProfile();
  }

  /** Loads the profile (personal + organization details) from the single dashboard-profile endpoint. */
  async loadProfile(): Promise<void> {
    const res = await this.api.request<DashboardProfile>(
      'GET',
      API_ROUTES.GET_ORGANIZATION_PROFILE,
      null,
      { showToaster: false },
    );
    if (res?.status) {
      const data = (res.data as DashboardProfile) ?? null;
      this.profile.set(data);
      this.profileForm.patchValue({
        orgName: data?.org_name ?? '',
        firstName: data?.first_name ?? '',
        lastName: data?.last_name ?? '',
        email: data?.email ?? '',
        contactNumber: this.phoneFormatPipe.transform(data?.contact_number ?? ''),
      });
    }
  }

  /**
   * Builds the PATCH body from the current form values plus whatever
   * key/logo values aren't changing — `org_name`/`org_logo_key` are only
   * included when the current user is an org admin.
   */
  private buildPatchPayload(overrides: Partial<Record<'profile_picture_key' | 'org_logo_key', string>> = {}): any {
    const formVal = this.profileForm.getRawValue();
    const current = this.profile();
    const payload: any = {
      first_name: formVal.firstName,
      last_name: formVal.lastName,
      contact_number: (formVal.contactNumber ?? '').replace(/\D/g, ''),
      profile_picture_key: current?.profile_picture_key ?? '',
    };
    if (this.isOrgAdmin()) {
      payload.org_name = formVal.orgName;
      payload.org_logo_key = current?.org_logo_key ?? '';
    }
    return { ...payload, ...overrides };
  }

  /**
   * Validates and uploads a newly selected profile picture immediately
   * (unlike the org logo, there is no "pending" step), then PATCHes the
   * new blob key to the user record and refreshes both this page's and
   * the shared/header profile state.
   */
  async onProfileImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const allowedExtensions = ['jpg', 'jpeg', 'png'];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!allowedExtensions.includes(ext)) {
      this.toast.error('Unsupported image format. Please upload an image with one of the following extensions: jpg, jpeg, png.');
      input.value = '';
      return;
    }

    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      this.toast.error('Image size exceeds the 2 MB limit. Please upload a smaller image.');
      input.value = '';
      return;
    }

    const container = this.config.profileImageContainer;
    const blobName = await this.fileUpload.uploadFile(file, container);
    input.value = '';
    if (!blobName) return;

    const previousKey = this.profile()?.profile_picture_key ?? '';
    // Persist the new blob name as the user's profile picture key.
    const res = await this.api.request('PUT', API_ROUTES.UPDATE_PROFILE_PICTURE, {
      user_id: this.auth.currentUser()?.id ?? '',
      blob_name: blobName,
    });

    if (res?.status) {
      if (previousKey) {
        await this.fileUpload.deleteFile(previousKey, container);
      }
      await this.loadProfile();
      // Reload the shared profile: header avatar updates from here.
      await this.auth.loadProfile();
    } else {
      // The record still points at the old blob — don't orphan the new upload.
      await this.fileUpload.deleteFile(blobName, container);
    }
  }

  /**
   * Organization logo — validated and previewed locally on selection; the
   * actual upload + PATCH only happens when the form is submitted via
   * updateProfile(), so picking a file never calls the API on its own.
   */
  onOrgLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const allowedExtensions = ['jpg', 'jpeg', 'png'];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!allowedExtensions.includes(ext)) {
      this.toast.error('Unsupported image format. Please upload an image with one of the following extensions: jpg, jpeg, png.');
      input.value = '';
      return;
    }

    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      this.toast.error('Image size exceeds the 2 MB limit. Please upload a smaller image.');
      input.value = '';
      return;
    }

    this.clearPendingOrgLogo();
    this.orgLogoFile.set(file);
    this.orgLogoPreviewUrl.set(URL.createObjectURL(file));
    input.value = '';
  }

  private clearPendingOrgLogo(): void {
    const url = this.orgLogoPreviewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.orgLogoFile.set(null);
    this.orgLogoPreviewUrl.set(null);
  }

  /**
   * Submits the profile form: uploads any pending org logo first, then
   * PATCHes personal (and, for org admins, organization) details in a
   * single request. Cleans up orphaned blobs if the upload or PATCH fails.
   */
  async updateProfile(): Promise<void> {
    this.isProfileSubmitted.set(true);
    this.isOrgSubmitted.set(true);
    if (this.profileForm.invalid) return;

    this.savingOrgProfile.set(true);

    // Upload the pending org logo (if one was picked) only now, on submit.
    const pendingLogo = this.orgLogoFile();
    const container = this.config.profileImageContainer;
    let uploadedBlobName: string | null = null;
    if (pendingLogo) {
      this.uploadingOrgLogo.set(true);
      uploadedBlobName = await this.fileUpload.uploadFile(pendingLogo, container);
      this.uploadingOrgLogo.set(false);
      if (!uploadedBlobName) {
        this.savingOrgProfile.set(false);
        return;
      }
    }

    const previousLogoKey = this.profile()?.org_logo_key ?? '';
    // Persist personal + (if org admin) organization details in one request.
    const resp = await this.api.request(
      'PATCH',
      API_ROUTES.UPDATE_ORGANIZATION_PROFILE,
      this.buildPatchPayload(uploadedBlobName ? { org_logo_key: uploadedBlobName } : {}),
      { showToaster: true },
    );
    this.savingOrgProfile.set(false);

    if (resp?.status) {
      if (uploadedBlobName && previousLogoKey) {
        await this.fileUpload.deleteFile(previousLogoKey, container);
      }
      // Fetch the fresh profile (new org_logo_url) BEFORE dropping the local
      // preview — clearing the preview first would briefly fall back to the
      // stale org_logo_url still in `profile()`, flashing the old logo.
      await this.loadProfile();
      // Reload the shared profile: header name/avatar update from here.
      await this.auth.loadProfile();
      this.clearPendingOrgLogo();
      return;
    }

    // The PATCH failed — don't orphan a freshly uploaded blob nobody references.
    if (uploadedBlobName) {
      await this.fileUpload.deleteFile(uploadedBlobName, container);
    }
  }

  cancelProfile(): void {
    this.router.navigate(['/dashboard']);
  }

  cancelPassword(): void {
    this.passwordForm.reset();
    this.isPasswordSubmitted.set(false);
    this.router.navigate(['/dashboard']);
  }

  /**
   * Submits the change-password form. On success the server invalidates
   * the current session, so the user is logged out and must sign back in
   * with the new password.
   */
  async changePassword(): Promise<void> {
    this.isPasswordSubmitted.set(true);
    if (this.passwordForm.invalid) return;

    const raw = this.passwordForm.getRawValue();
    const payload = {
      current_password: raw.currentPassword,
      new_password: raw.newPassword,
      confirm_password: raw.confirmPassword,
    };

    this.savingPassword.set(true);
    // Verifies the current password server-side and updates it.
    const resp = await this.api.request('POST', API_ROUTES.CHANGE_PASSWORD, payload);
    this.savingPassword.set(false);

    if (resp?.status) {
      this.passwordForm.reset();
      this.isPasswordSubmitted.set(false);
      // Password changed — force re-login with the new credentials.
      await this.auth.logout();
    }
  }
}
