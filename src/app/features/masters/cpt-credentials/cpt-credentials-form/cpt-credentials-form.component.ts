import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../../../../core/services/api.service';
import { API_ROUTES } from '../../../../core/constants/api-routes';
import { FocusFirstInputDirective } from '../../../../core/services/focusFirstInput.directive';
import { CryptoService } from '../../../../core/services/crypto.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TrimWhitespaceDirective } from '../../../../shared/directives/trim-whitespace.directive';

// CPT codes are exactly 5 alphanumeric characters.
const CPT_CODE_PATTERN = /^[a-zA-Z0-9]{5}$/;

/**
 * Add / Edit CPT to Credential Mapping.
 *
 * Create: POST /organization/masters/cpt-credentials/create { license, cpt_codes }
 * Detail: POST /organization/masters/cpt-credentials/detail { id }
 * Update: POST /organization/masters/cpt-credentials/update { license, cpt_codes, id }
 */
@Component({
  selector: 'app-cpt-credentials-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, TrimWhitespaceDirective, FocusFirstInputDirective],
  templateUrl: './cpt-credentials-form.component.html',
  styleUrl: './cpt-credentials-form.component.scss',
})
export class CptCredentialsFormComponent implements OnInit {
  licenseOptions: { label: string; value: string }[] = [];

  readonly isEdit = signal(false);
  readonly isSubmitted = signal(false);
  readonly submitting = signal(false);
  readonly cptCodes = signal<string[]>([]);
  readonly cptCodeError = signal('');
  readonly form: FormGroup;

  cptCodeInput = '';
  private recordId: string | null = null;

  constructor(
    public fb: FormBuilder,
    public api: ApiService,
    public router: Router,
    public route: ActivatedRoute,
    public crypto: CryptoService,
    public toast: ToastService,
  ) {
    this.form = this.fb.group({
      license: ['', Validators.required],
      service_description: ['', [Validators.minLength(2), Validators.maxLength(250)]],
    });
  }

  get f() {
    return this.form.controls;
  }

  /**
   * Loads the license dropdown options, then, if the route carries an `id`
   * param, switches into edit mode, decrypts the id (falling back to the raw
   * value if it isn't encrypted), and loads the record's detail.
   */
  async ngOnInit(): Promise<void> {
    await this.loadOptions();

    const encId = this.route.snapshot.paramMap.get('id');
    if (!encId) return;

    this.isEdit.set(true);

    let decodedId = encId;
    try {
      decodedId = await this.crypto.decryptId(encId);
    } catch {
      // Likely a plain UUID in the URL — proceed with the raw value.
    }
    this.recordId = decodedId;

    await this.loadDetail(decodedId);
  }

  /**
   * Fetches a single CPT-to-Credential mapping by id and patches the form
   * and CPT code list with it. Navigates back to the list if the record
   * can't be found/loaded.
   * @param id decrypted/raw record id (not the encrypted route param)
   */
  async loadDetail(id: string): Promise<void> {
    // Fetch the CPT-to-Credential mapping to edit; toaster suppressed since
    // a failed lookup is handled below by redirecting instead.
    const res = await this.api.request('POST', API_ROUTES.GET_CPT_MASTERS_DETAIL, { id }, {
      showToaster: false,
    });

    if (res?.status && res.data) {
      const d = res.data;
      this.form.patchValue({ 
        license: d.license ?? '',
        service_description: d.service_description ?? ''
      });
      this.cptCodes.set(Array.isArray(d.cpt_codes) ? d.cpt_codes : []);
    } else {
      this.router.navigate(['/masters']);
    }
  }

  /**
   * Loads the dropdown options for the "License" select. `typeIds: [7]` is
   * the master-data type id for License; the response bundles options for
   * multiple lookup types, so the License entry is picked out by that id.
   */
  async loadOptions(): Promise<void> {
    // Shared master-list lookup endpoint, filtered to license-type options.
    const res = await this.api.request('POST', API_ROUTES.GET_MASTER_LIST, { typeIds: [7] }, {
      showToaster: false,
    });
    if (res?.status && Array.isArray(res.data)) {
      const licenseType = res.data.find((d: any) => d.typeId === 7);
      if (licenseType && Array.isArray(licenseType.options)) {
        this.licenseOptions = licenseType.options.map((opt: any) => ({
          label: opt.label,
          value: opt.value
        }));
      }
    }
  }

  /** Alpha numeric-only, capped at 5 characters — sanitizes as the user types and clears errors. */
  onCptCodeInputChange(): void {
    const numericVal = this.cptCodeInput.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5);
    if (this.cptCodeInput !== numericVal) {
      this.cptCodeInput = numericVal;
    }
    if (this.cptCodeError()) {
      this.cptCodeError.set('');
    }
  }

  /**
   * Validates the pending CPT code input (required, exactly 5 alphanumeric
   * characters, not already added — case-insensitively) and, if valid, adds
   * it to `cptCodes` and clears the input.
   */
  addCptCode(): void {
    const code = this.cptCodeInput.trim();
    if (!code) {
      this.cptCodeError.set('Please enter a CPT code.');
      return;
    }

    if (!CPT_CODE_PATTERN.test(code)) {
      this.cptCodeError.set('CPT Code must be exactly 5 alphanumeric characters.');
      return;
    }

    if (this.cptCodes().some((c) => c.toLowerCase() === code.toLowerCase())) {
      this.cptCodeError.set('CPT Code already exists for selected License.');
      return;
    }

    this.cptCodes.update((list) => [...list, code]);
    this.cptCodeInput = '';
    this.cptCodeError.set('');
  }

  /** Removes a previously added CPT code chip from the pending list. */
  removeCptCode(code: string): void {
    this.cptCodes.update((list) => list.filter((c) => c !== code));
  }

  /**
   * Validates the form and creates or updates the CPT-to-Credential mapping
   * depending on `isEdit`. Requires at least one CPT code in addition to the
   * form being valid; no-ops while already submitting.
   */
  async onSave(): Promise<void> {
    this.isSubmitted.set(true);
    if (this.form.invalid || this.cptCodes().length === 0 || this.submitting()) return;

    this.submitting.set(true);
    const payload: any = {
      license: this.form.value.license,
      cpt_codes: this.cptCodes(),
      service_description: this.form.value.service_description?.trim() || '',
    };
    if (this.isEdit()) payload.id = this.recordId;

    const endpoint = this.isEdit() ? API_ROUTES.UPDATE_CPT_MASTERS : API_ROUTES.CREATE_CPT_MASTERS;
    const method = this.isEdit() ? 'PUT' : 'POST';

    // Create or update the CPT-to-Credential mapping depending on edit mode.
    const res = await this.api.request(method, endpoint, payload );
    this.submitting.set(false);

    if (!res) return;

    if (res.status) {
      this.router.navigate(['/masters'], { queryParams: { tab: 'cpt' } });
      return;
    }

  }
}
