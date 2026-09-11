import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../../../../core/services/api.service';
import { API_ROUTES } from '../../../../core/constants/api-routes';
import { FocusFirstInputDirective } from '../../../../core/services/focusFirstInput.directive';
import { CryptoService } from '../../../../core/services/crypto.service';
import { ToastService } from '../../../../core/services/toast.service';
import { noWhitespaceValidator } from '../../../../core/utils/validators.util';
import { TrimWhitespaceDirective } from '../../../../shared/directives/trim-whitespace.directive';

/**
 * Add / Edit BHS Matrix form. `bhs_id` is never sent from the frontend — the
 * backend generates it on create, and it's shown read-only (not editable) on
 * an existing record.
 *
 * Create:  POST /organization/masters/create { ...fields }
 * Detail:  POST /organization/masters/detail { id }
 * Update:  POST /organization/masters/update { ...fields, id }
 */
@Component({
  selector: 'app-bhs-matrix-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TrimWhitespaceDirective, FocusFirstInputDirective],
  templateUrl: './bhs-matrix-form.component.html',
  styleUrl: './bhs-matrix-form.component.scss',
})
export class BhsMatrixFormComponent implements OnInit {
  readonly isEdit = signal(false);
  readonly isSubmitted = signal(false);
  readonly submitting = signal(false);
  readonly bhsId = signal<string>('');
  readonly form: FormGroup;

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
      service_category: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), noWhitespaceValidator()]],
      service_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), noWhitespaceValidator()]],
      proc_code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), noWhitespaceValidator()]],
      mod1: ['', [Validators.minLength(2), Validators.maxLength(50)]],
      mod2: ['', [Validators.minLength(2), Validators.maxLength(50)]],
      mod3: ['', [Validators.minLength(2), Validators.maxLength(50)]],
      mod4: ['', [Validators.minLength(2), Validators.maxLength(50)]],
      allowed_pos: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), noWhitespaceValidator()]],
      rate: [null, [Validators.required, Validators.max(99999999)]],
      rate_increment: ['', [Validators.minLength(2), Validators.maxLength(50)]],
      enhanced_rate: ['', [Validators.minLength(2), Validators.maxLength(50)]],
      auth_requirement: ['', [Validators.minLength(2), Validators.maxLength(50)]],
      unit_limits: ['', [Validators.minLength(2), Validators.maxLength(50)]],
      service_exclusions: ['', [Validators.minLength(2), Validators.maxLength(250)]],
      icd_10: ['', [Validators.minLength(2), Validators.maxLength(50)]],
    });
  }

  get f() {
    return this.form.controls;
  }

  /**
   * If the route carries an `id` param, switches the form into edit mode,
   * decrypts the id (falling back to the raw value if it isn't encrypted),
   * and loads the record's detail.
   */
  async ngOnInit(): Promise<void> {
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
   * Fetches a single BHS Matrix record by id and patches the form with it.
   * Navigates back to the list if the record can't be found/loaded.
   * @param id decrypted/raw record id (not the encrypted route param)
   */
  async loadDetail(id: string): Promise<void> {
    // Fetch the BHS Matrix record to edit; toaster suppressed since a failed
    // lookup is handled below by redirecting instead of showing an error.
    const res = await this.api.request('POST', API_ROUTES.GET_MASTERS_DETAIL, { id }, {
      showToaster: false,
    });

    if (res?.status && res.data) {
      const d = res.data;
      this.bhsId.set(d.bhs_id ?? '');
      this.form.patchValue({
        service_category: d.service_category ?? '',
        service_name: d.service_name ?? '',
        proc_code: d.proc_code ?? '',
        mod1: d.mod1 ?? '',
        mod2: d.mod2 ?? '',
        mod3: d.mod3 ?? '',
        mod4: d.mod4 ?? '',
        allowed_pos: d.allowed_pos ?? '',
        rate: d.rate ?? null,
        rate_increment: d.rate_increment ?? '',
        enhanced_rate: d.enhanced_rate ?? '',
        auth_requirement: d.auth_requirement ?? '',
        unit_limits: d.unit_limits ?? '',
        service_exclusions: d.service_exclusions ?? '',
        icd_10: d.icd_10 ?? '',
      });
    } else {
      this.router.navigate(['/masters']);
    }
  }

  /**
   * Validates the form and creates or updates the BHS Matrix record
   * depending on `isEdit`. No-ops while already submitting, while the form
   * is invalid, or (in edit mode) if the record id is missing.
   */
  async onSave(): Promise<void> {
    this.isSubmitted.set(true);
    if (this.form.invalid || this.submitting() || (this.isEdit() && !this.recordId)) return;

    this.submitting.set(true);
    // bhs_id is never sent — the backend generates it on create and it's
    // read-only on update.
    const payload: any = { ...this.form.getRawValue() };
    if (payload.rate === null || payload.rate === '' || payload.rate === undefined) {
      payload.rate = 0;
    }
    if (this.isEdit()) payload.id = this.recordId;

    const endpoint = this.isEdit() ? API_ROUTES.UPDATE_MASTERS : API_ROUTES.CREATE_MASTERS;
    const method = this.isEdit() ? 'PUT' : 'POST';
    // Create or update the BHS Matrix record depending on edit mode.
    const res = await this.api.request(method, endpoint, payload);
    this.submitting.set(false);

    if (res?.status) {
      this.router.navigate(['/masters']);
    }
  }
}
