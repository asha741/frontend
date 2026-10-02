import { Component, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { KENDO_MULTISELECT } from '@progress/kendo-angular-dropdowns';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { FocusFirstInputDirective } from '../../../core/services/focusFirstInput.directive';
import { ToastService } from '../../../core/services/toast.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { noWhitespaceValidator } from '../../../core/utils/validators.util';
import { PhoneMaskDirective } from '../../../shared/directives/phone-mask.directive';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';

/**
 * Add/Edit Provider form. Builds a single reactive form used for both creating
 * a new provider (POST) and editing an existing one (PATCH), switching mode
 * based on whether an `:id` route param is present.
 */
@Component({
  selector: 'app-provider-form',
  standalone: true,
  imports: [ReactiveFormsModule, PhoneMaskDirective, TrimWhitespaceDirective, RouterLink, FocusFirstInputDirective, ...KENDO_MULTISELECT],
  templateUrl: './provider-form.html',
  styleUrl: './provider-form.scss',
})
export class ProviderForm implements OnInit {
  readonly isEdit = signal(false);
  readonly isSubmitted = signal(false);
  readonly submitting = signal(false);
  licenseOptions: { label: string; value: string }[] = [];

  /** The record's DB id (from the route param) — distinct from the `provider_id` form field. */
  private recordId: string | null = null;

  readonly form: FormGroup;

  constructor(
    public fb: FormBuilder,
    public api: ApiService,
    public router: Router,
    public route: ActivatedRoute,
    public toast: ToastService,
    public crypto: CryptoService,
  ) {
    // Basic "local@domain.tld" shape check; server still validates/uniques the email.
    const emailRegex: RegExp = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    this.form = this.fb.group({
      provider_id: [
        '',
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(16),
          noWhitespaceValidator(),
        ],
      ],
      external_id: ['', [Validators.minLength(1), Validators.maxLength(16), noWhitespaceValidator()]],
      first_name: [
        '',
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(50),
          noWhitespaceValidator(),
        ],
      ],
      middle_name: ['', [Validators.minLength(1), Validators.maxLength(50), noWhitespaceValidator()]],
      last_name: [
        '',
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(50),
          noWhitespaceValidator(),
        ],
      ],
      email: ['', [Validators.maxLength(100), noWhitespaceValidator()]],
      contact_number: ['', [Validators.maxLength(30), noWhitespaceValidator()]],
      designation: ['', [Validators.maxLength(100), noWhitespaceValidator()]],
      license: [[] as string[]],
      status: [true],
    });
  }

  get f() {
    return this.form.controls;
  }

  /**
   * Loads the license dropdown options, then — if the route carries an `:id`
   * param — switches the form into edit mode and loads the existing provider.
   */
  async ngOnInit(): Promise<void> {
    await this.loadOptions();

    const encId = this.route.snapshot.paramMap.get('id');
    if (!encId) return;

    this.isEdit.set(true);

    // Handle either encrypted ids or plain ids (e.g. a stale/unencrypted link).
    let id = encId;
    try {
      id = await this.crypto.decryptId(encId);
    } catch (e) {
      console.warn('ID decryption failed (likely a plain id in URL). Proceeding with raw id.');
    }
    this.recordId = id;
    await this.loadProvider(id);
  }

  /**
   * Fetches a single provider by id and patches its data into the form
   * (edit mode). Redirects back to the list if the id isn't found.
   * @param id decrypted provider record id
   */
  async loadProvider(id: string): Promise<void> {
    // Fetch the provider record to prefill the edit form.
    const res = await this.api.request(
      'POST',
      API_ROUTES.GET_PROVIDER_BY_ID,
      { id },
      {
        showToaster: false,
      },
    );

    if (!res?.status || !res.data) {
      this.router.navigate(['/provider-management']);
      return;
    }

    const provider = res.data;
    // Tolerate both snake_case and camelCase field names from the API.
    this.form.patchValue({
      provider_id: provider.provider_id ?? provider.providerId ?? '',
      external_id: provider.external_id ?? provider.externalId ?? '',
      first_name: provider.first_name ?? provider.firstName ?? '',
      middle_name: provider.middle_name ?? provider.middleName ?? '',
      last_name: provider.last_name ?? provider.lastName ?? '',
      email: provider.email ?? '',
      contact_number: provider.contact_number ?? provider.contactNumber ?? '',
      designation: provider.designation ?? '',
      license: Array.isArray(provider.license) ? provider.license : provider.license ? [provider.license] : [],
      status: (provider.status ?? 'Active').toLowerCase() === 'active',
    });
  }

  /** Loads the "license" master-list options (typeId 7) for the license multiselect. */
  async loadOptions(): Promise<void> {
    // Master list lookup — typeId 7 corresponds to license types.
    const res = await this.api.request(
      'POST',
      API_ROUTES.GET_MASTER_LIST,
      { typeIds: [7] },
      {
        showToaster: false,
      },
    );
    if (!res?.status || !Array.isArray(res.data)) return;

    // The endpoint may return either the flat option list directly, or a
    // per-type wrapper ([{ typeId, options }]) when multiple typeIds are requested.
    const rawOptions =
      res.data[0]?.typeId !== undefined
        ? (res.data.find((d: any) => d.typeId === 7)?.options ?? [])
        : res.data;

    this.licenseOptions = (rawOptions as any[]).map((opt: any) => ({
      label: opt.label,
      value: opt.value,
    }));
  }

  /**
   * Validates and submits the form: creates a new provider (POST) or updates
   * the existing one (PATCH), based on `isEdit()`. On success, navigates back
   * to the provider list; on a duplicate-email failure, surfaces the error
   * inline on the email field instead of only toasting.
   */
  async onSave(): Promise<void> {
    this.isSubmitted.set(true);
    this.form.updateValueAndValidity();
    if (this.form.invalid || this.submitting()) return;

    const raw = this.form.getRawValue();
    const normalizedPhone = raw.contact_number ? raw.contact_number.replace(/\D/g, '') : '';
    if (raw.contact_number && normalizedPhone.length !== 10) {
      this.f['contact_number'].setErrors({ phone: true });
      return;
    }

    // Annotated: without it the ternary types as `string[] | never[]`, and the
    // `.some()` below can't resolve a callback signature against that union
    // (TS7006 — `value` implicitly any).
    const normalizedLicense: string[] = Array.isArray(raw.license)
      ? raw.license
          .map((value: string) => String(value).trim())
          .filter((value: string) => value.length > 0)
      : [];

    const allowedLicenses = this.licenseOptions.map((option) => option.value.trim().toLowerCase());
    const invalidLicense = normalizedLicense.some((value) => !allowedLicenses.includes(String(value).trim().toLowerCase()));
    if (normalizedLicense.length > 0 && invalidLicense) {
      this.f['license'].setErrors({ invalidLicense: true });
      return;
    }

    this.submitting.set(true);
    const payload: any = {
      provider_id: raw.provider_id,
      external_id: raw.external_id || '',
      first_name: raw.first_name,
      middle_name: raw.middle_name || '',
      last_name: raw.last_name,
      email: raw.email || '',
      contact_number: normalizedPhone || '',
      designation: raw.designation || '',
      license: normalizedLicense.length > 0 ? normalizedLicense : 'No credential needed (N/A)',
      status: raw.status ? 'Active' : 'Inactive',
    };

    if (this.isEdit()) {
      payload.id = this.recordId;
    }

    const endpoint = this.isEdit() ? API_ROUTES.UPDATE_PROVIDER : API_ROUTES.ADD_PROVIDER;
    const method = this.isEdit() ? 'PATCH' : 'POST';

    // Create/update the provider record.
    const res = await this.api.request(method, endpoint, payload, { showToaster: true });
    this.submitting.set(false);

    if (!res) return;

    if (res.status) {
    
      this.router.navigate(['/provider-management']);
      return;
    }

    // Save failed — show a duplicate email on the field, otherwise toast.
    if (this.isDuplicateEmailError(res.message)) {
      this.f['email'].setErrors({ emailExists: true });
    } else {
    }
  }

  /** Detects the backend's "email already exists" failure from its message. */
  private isDuplicateEmailError(message: string | undefined): boolean {
    const m = (message ?? '').toLowerCase();
    return m.includes('email') && /exist|already|taken|registered|in use/.test(m);
  }
}
