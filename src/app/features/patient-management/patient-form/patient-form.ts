import { Component, Input, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { FocusFirstInputDirective } from '../../../core/services/focusFirstInput.directive';
import { CryptoService } from '../../../core/services/crypto.service';
import { noWhitespaceValidator } from '../../../core/utils/validators.util';
import { PhoneMaskDirective } from '../../../shared/directives/phone-mask.directive';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';


@Component({
  selector: 'app-patient-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PhoneMaskDirective, TrimWhitespaceDirective, NgbDatepickerModule, FocusFirstInputDirective],
  templateUrl: './patient-form.html',
  styleUrl: './patient-form.scss',
})
/**
 * Add/Edit Patient form. Used standalone (its own `id` route param, decrypted
 * client-side) and embedded inside the Patient Profile tabs (via `patientId`
 * @Input, already resolved by the parent) — see `patientId` below.
 */
export class PatientForm implements OnInit {
  /** Pre-resolved (decrypted) patient id — passed in when embedded inside the Patient Profile tabs,
   * whose route param is `patientId`, not the `id` param this component reads on its own route. */
  @Input() patientId: string | null = null;

  readonly isEdit = signal(false);
  readonly isSubmitted = signal(false);
  readonly submitting = signal(false);

  genderOptions: { label: string; value: string }[] = [];

  /** Today's date, capped so Date of Birth can't be set in the future. */
  readonly today: NgbDateStruct;

  /** Earliest selectable Date of Birth, so the picker's year dropdown isn't limited
   * to ng-bootstrap's default 10-year-back floor. */
  readonly minDob: NgbDateStruct = { year: 1900, month: 1, day: 1 };

  /** The record's DB id (from the route param) — distinct from the `patient_id` form field. */
  private recordId: string | null = null;

  readonly form: FormGroup;

  constructor(
    public fb: FormBuilder,
    public api: ApiService,
    public router: Router,
    public route: ActivatedRoute,
    public crypto: CryptoService,
  ) {
    const now = new Date();
    this.today = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };

    const emailRegex: RegExp = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    this.form = this.fb.group({
      patient_id: ['', [Validators.required, Validators.maxLength(16), noWhitespaceValidator()]],
      external_id: ['', [Validators.maxLength(16)]],
      first_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), noWhitespaceValidator()]],
      middle_initial: ['', [Validators.minLength(1), Validators.maxLength(1)]],
      last_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), noWhitespaceValidator()]],
      gender: ['', [Validators.required]],
      date_of_birth: [null as NgbDateStruct | null, [Validators.required]],
      email: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(emailRegex)]],
      contact_number: ['', [Validators.required, Validators.pattern(/^\(\d{3}\) \d{3}-\d{4}$/)]],
      home_phone: ['', [Validators.pattern(/^\(\d{3}\) \d{3}-\d{4}$/)]],
      state: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), noWhitespaceValidator()]],
      city: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), noWhitespaceValidator()]],
      pin_code: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(10), Validators.pattern(/^\d+$/)]],
      address_1: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(250), noWhitespaceValidator()]],
      address_2: ['', [Validators.maxLength(250)]],
      diagnosis_problem_1: ['', [Validators.maxLength(250)]],
      diagnosis_problem_2: ['', [Validators.maxLength(250)]],
      diagnosis_problem_3: ['', [Validators.maxLength(250)]],
      diagnosis_problem_4: ['', [Validators.maxLength(250)]],
      diagnosis_problem_5: ['', [Validators.maxLength(250)]],
      status: [true],
    });
  }

  get f() {
    return this.form.controls;
  }

  /** Loads dropdown options, then resolves which patient (if any) to load for edit mode. */
  async ngOnInit(): Promise<void> {
    await this.loadOptions();

    // Embedded inside the Patient Profile tabs — the id is already resolved by the parent.
    if (this.patientId) {
      this.isEdit.set(true);
      this.recordId = this.patientId;
      await this.loadPatient(this.patientId);
      return;
    }

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
    await this.loadPatient(id);
  }

  /** Fetches a patient's full record by id and patches the form with its values. */
  async loadPatient(id: string): Promise<void> {
    // POST /organization/patients/:id (via API_ROUTES) — returns the full patient record.
    const res = await this.api.request('POST', API_ROUTES.GET_PATIENT_BY_ID, { id }, {
      showToaster: false,
    });

    if (!res?.status || !res.data) {
      this.router.navigate(['/patient-management']);
      return;
    }

    const patient: any = res.data;
    const diagnosis: string[] = Array.isArray(patient.diagnosis) ? patient.diagnosis : [];
    this.form.patchValue({
      patient_id: patient.patient_id ?? patient.patientId ?? '',
      external_id: patient.external_id ?? patient.externalId ?? '',
      first_name: patient.first_name ?? patient.firstName ?? '',
      middle_initial: patient.middle_initial ?? patient.middleInitial ?? '',
      last_name: patient.last_name ?? patient.lastName ?? '',
      gender: patient.gender ?? '',
      date_of_birth: this.toNgbDate(patient.date_of_birth ?? patient.dateOfBirth ?? ''),
      email: patient.email ?? '',
      contact_number: patient.contact_number ?? patient.contactNumber ?? '',
      home_phone: patient.home_phone ?? patient.homePhone ?? '',
      state: patient.state ?? '',
      city: patient.city ?? '',
      pin_code: patient.pin_code ?? patient.pinCode ?? '',
      address_1: patient.address_1 ?? patient.address1 ?? '',
      address_2: patient.address_2 ?? patient.address2 ?? '',
      diagnosis_problem_1: diagnosis[0] ?? '',
      diagnosis_problem_2: diagnosis[1] ?? '',
      diagnosis_problem_3: diagnosis[2] ?? '',
      diagnosis_problem_4: diagnosis[3] ?? '',
      diagnosis_problem_5: diagnosis[4] ?? '',
      status: (patient.status ?? 'Active').toLowerCase() === 'active',
    });
  }

  /** Loads the gender dropdown options from the shared master-list lookup endpoint (typeId 12). */
  async loadOptions(): Promise<void> {
    // POST master-list lookup — typeId 12 is the "Gender" option set.
    const res = await this.api.request(
      'POST',
      API_ROUTES.GET_MASTER_LIST,
      { typeIds: [12] },
      {
        showToaster: false,
      },
    );
    if (!res?.status || !Array.isArray(res.data)) return;

    // The endpoint may return either the flat option list directly, or a
    // per-type wrapper ([{ typeId, options }]) when multiple typeIds are requested.
    const rawOptions =
      res.data[0]?.typeId !== undefined
        ? (res.data.find((d: any) => d.typeId === 12)?.options ?? [])
        : res.data;

    this.genderOptions = (rawOptions as any[]).map((opt: any) => ({
      label: opt.label,
      value: opt.value,
    }));
  }

  /** Validates and submits the form, creating or updating the patient depending on `isEdit`. */
  async onSave(): Promise<void> {
    this.isSubmitted.set(true);
    if (this.form.invalid || this.submitting()) return;

    this.submitting.set(true);
    const raw = this.form.getRawValue();
    const payload: any = {
      patient_id: raw.patient_id,
      external_id: raw.external_id,
      first_name: raw.first_name,
      middle_initial: raw.middle_initial,
      last_name: raw.last_name,
      gender: raw.gender,
      date_of_birth: raw.date_of_birth ? this.toDateStr(raw.date_of_birth) : '',
      email: raw.email,
      // Strip mask formatting → send the raw 10 digits.
      contact_number: raw.contact_number?.replace(/\D/g, ''),
      home_phone: raw.home_phone?.replace(/\D/g, '') || '',
      state: raw.state,
      city: raw.city,
      pin_code: raw.pin_code,
      address_1: raw.address_1,
      address_2: raw.address_2,
      diagnosis: [
        raw.diagnosis_problem_1 || '',
        raw.diagnosis_problem_2 || '',
        raw.diagnosis_problem_3 || '',
        raw.diagnosis_problem_4 || '',
        raw.diagnosis_problem_5 || '',
      ],
      status: raw.status ? 'Active' : 'Inactive',
    };

    if (this.isEdit()) {
      payload.id = this.recordId;
    }

    const endpoint = this.isEdit() ? API_ROUTES.UPDATE_PATIENT : API_ROUTES.ADD_PATIENT;
    const method = this.isEdit() ? 'PATCH' : 'POST';

    // PATCH updates the existing patient record; POST creates a new one.
    const res = await this.api.request(method, endpoint, payload, { showToaster: true });
    this.submitting.set(false);

    if (!res) return;

    if (res.status) {
      this.router.navigate(['/patient-management']);
      return;
    }

    // Save failed — show a duplicate email on the field; ApiService already toasted the message.
    if (this.isDuplicateEmailError(res.message)) {
      this.f['email'].setErrors({ emailExists: true });
    }
  }

  /** Detects the backend's "email already exists" failure from its message. */
  private isDuplicateEmailError(message: string | undefined): boolean {
    const m = (message ?? '').toLowerCase();
    return m.includes('email') && /exist|already|taken|registered|in use/.test(m);
  }

  /** Blocks non-digit keystrokes so the Pin Code field only ever accepts integers. */
  blockNonDigit(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!/^\d$/.test(event.key) && event.key.length === 1) {
      event.preventDefault();
    }
  }

  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${mm}-${dd}-${d.year}`;
  }

  /** Parses a 'MM-DD-YYYY', 'YYYY-MM-DD' (ISO), or 'MM/DD/YYYY' date string into an `NgbDateStruct`; null if invalid/empty. */
  private toNgbDate(dateStr: string): NgbDateStruct | null {
    if (!dateStr) return null;

    if (dateStr.includes('/')) {
      const [month, day, year] = dateStr.split('/').map(Number);
      if (!year || !month || !day) return null;
      return { year, month, day };
    }

    const parts = dateStr.slice(0, 10).split('-').map(Number);
    if (parts.length !== 3 || parts.some((p) => !p)) return null;

    // 'YYYY-MM-DD' has its 4-digit year first; 'MM-DD-YYYY' has it last.
    const [year, month, day] = String(parts[0]).length === 4 ? parts : [parts[2], parts[0], parts[1]];
    return { year, month, day };
  }
}
