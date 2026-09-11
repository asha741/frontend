import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';
import { PatientForm } from '../patient-form/patient-form';
import { PatientDocumentsComponent } from './patient-documents/patient-documents.component';
import { PatientClaimsComponent } from './patient-claims/patient-claims.component';

interface PatientSummary {
  patient_id: string;
  first_name: string;
  last_name: string;
}

type PatientProfileTab = 'edit' | 'documents' | 'claims';

/**
 * Patient Profile — tabbed page reached from the Patient Management grid's
 * "Patient Profile" action. Hosts the existing Edit Patient form plus the new
 * Patient Documents and Patient Claims tabs, all scoped to the same patient.
 */
@Component({
  selector: 'app-patient-profile',
  standalone: true,
  imports: [ PatientForm, PatientDocumentsComponent, PatientClaimsComponent],
  templateUrl: './patient-profile.html',
  styleUrl: './patient-profile.scss',
})
export class PatientProfile implements OnInit {
  constructor(
    public route: ActivatedRoute,
    public api: ApiService,
    public crypto: CryptoService,
  ) {}

  readonly activeTab = signal<PatientProfileTab>('edit');
  readonly patient = signal<PatientSummary | null>(null);

  patientId: string | null = null;

  /** Decrypts the `patientId` route param (falling back to the raw value if it isn't encrypted), then loads the patient summary shown in the header. */
  async ngOnInit(): Promise<void> {
    const encId = this.route.snapshot.paramMap.get('patientId');
    if (!encId) return;

    try {
      this.patientId = await this.crypto.decryptId(encId);
    } catch (e) {
      // Handle either encrypted ids or plain ids (e.g. a stale/unencrypted link).
      console.warn('ID decryption failed (likely a plain id in URL). Proceeding with raw id.');
      this.patientId = encId;
    }

    await this.loadPatientSummary();
  }

  /** Fetches the patient's name/id summary used in the profile header. */
  async loadPatientSummary(): Promise<void> {
    if (!this.patientId) return;
    // POST /organization/patients/:id — same lookup used by PatientForm's edit mode.
    const res = await this.api.request('POST', API_ROUTES.GET_PATIENT_BY_ID, { id: this.patientId }, {
      showToaster: false,
    });
    if (res?.status && res.data) {
      this.patient.set(res.data);
    }
  }

  switchTab(tab: PatientProfileTab): void {
    this.activeTab.set(tab);
  }
}
