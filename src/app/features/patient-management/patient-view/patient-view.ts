import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../../core/constants/permissions';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';
import { UsPhonePipe } from '../../../shared/pipes/us-phone.pipe';

interface PatientDetail {
  id: string;
  patient_id: string;
  external_id?: string;
  first_name: string;
  middle_initial?: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  age?: number;
  email?: string;
  contact_number?: string;
  home_phone?: string;
  state?: string;
  city?: string;
  pin_code?: string;
  address_1?: string;
  address_2?: string;
  diagnosis?: string[];
  status: string;
  created_at?: string;
}

/**
 * Patient View — read-only patient snapshot reached from the Patient
 * Management grid's "View Patient" action. Mirrors the fields on
 * `PatientForm` but display-only, laid out as a Basic Information section
 * followed by an Address & Diagnosis section; its "Edit Patient" button opens
 * just the editable form, not the tabbed Patient Profile — Documents and
 * Claims aren't relevant from a read-only view.
 */
@Component({
  selector: 'app-patient-view',
  standalone: true,
  imports: [BadgeClassPipe, DatePipe, UsPhonePipe],
  templateUrl: './patient-view.html',
  styleUrl: './patient-view.scss',
})
export class PatientView implements OnInit {
  constructor(
    public api: ApiService,
    public route: ActivatedRoute,
    public router: Router,
    public crypto: CryptoService,
    public perms: PermissionService,
  ) {}

  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly patient = signal<PatientDetail | null>(null);

  private patientId: string | null = null;
  private encId: string | null = null;

  async ngOnInit(): Promise<void> {
    const encId = this.route.snapshot.paramMap.get('id');
    if (!encId) return;
    this.encId = encId;

    try {
      this.patientId = await this.crypto.decryptId(encId);
    } catch {
      // Handle either encrypted ids or plain ids (e.g. a stale/unencrypted link).
      this.patientId = encId;
    }

    await this.loadPatient();
  }

  /** Fetches the full patient record by id — same lookup used by `PatientForm`'s edit mode. */
  async loadPatient(): Promise<void> {
    if (!this.patientId) return;

    const res = await this.api.request('POST', API_ROUTES.GET_PATIENT_BY_ID, { id: this.patientId }, {
      showToaster: false,
    });

    if (!res?.status || !res.data) {
      this.router.navigate(['/patient-management']);
      return;
    }

    this.patient.set(res.data as PatientDetail);
  }

  /** Full name, tolerant of an absent middle initial. */
  fullName(): string {
    const p = this.patient();
    if (!p) return '-';
    return [p.first_name, p.middle_initial, p.last_name].filter((part) => !!part?.trim()).join(' ') || '-';
  }

  /** First-name + last-name initials for the hero card's avatar circle. */
  initials(): string {
    const p = this.patient();
    if (!p) return '';
    return `${p.first_name?.[0] ?? ''}${p.last_name?.[0] ?? ''}`.toUpperCase();
  }

  /** "32 years old · Male" style summary line under the patient's name. */
  heroSubtitle(): string {
    const p = this.patient();
    if (!p) return '';
    const age = p.age != null ? `${p.age} years old` : '';
    return [age, p.gender].filter((part) => !!part?.trim()).join(' · ');
  }

  diagnosisList(): string[] {
    return (this.patient()?.diagnosis ?? []).filter((d) => !!d?.trim());
  }

  /** "Edit Patient" — opens just the editable form (no Documents/Claims tabs). */
  editPatient(): void {
    if (!this.encId) return;
    this.router.navigate(['/patient-management/edit-patient', this.encId]);
  }
}
