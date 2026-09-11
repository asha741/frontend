import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { ToastService } from '../../../core/services/toast.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../../core/constants/permissions';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';

interface ClaimRecordAudit {
  payment_status: string;
  updated_by_name: string;
  updated_at: string;
}

interface ClaimRecordDetailData {
  id: string;
  claim_id: string;
  consumer_name: string;
  provider_name: string;
  service_id: string;
  service_date: string;
  service_type: string;
  cpt_code: string;
  modifier?: string | null;
  program: string;
  location: string;
  recipient: string;
  duration?: number | null;
  base_units?: number | null;
  base_rate?: number | null;
  billing_rate?: number | null;
  batch_date?: string | null;
  transfer_date?: string | null;
  last_insurance_paid?: number | null;
  approval_user?: string | null;
  approval_date?: string | null;
  status: string;
  provider_payment_status: string;
  audit_trail: ClaimRecordAudit[];
}

/**
 * Claim Detail — read-only claim information plus the one editable field,
 * Provider Payment Status. "Claim information is read-only except Provider
 * Payment Status" / "Historical claim information cannot be edited" (per the
 * user story), so nothing else here is ever a form control.
 *
 * POST /organization/claims/claim-records/detail  { record_id } → ClaimRecordDetailResponse
 * PUT  /organization/claims/claim-records/payment-status { record_id, provider_payment_status } → ClaimRecordDetailResponse
 */
@Component({
  selector: 'app-claim-record-detail',
  standalone: true,
  imports: [BadgeClassPipe, DatePipe, FormsModule],
  templateUrl: './claim-record-detail.html',
  styleUrl: './claim-record-detail.scss',
})
export class ClaimRecordDetail implements OnInit {
  constructor(
    public api: ApiService,
    public route: ActivatedRoute,
    public router: Router,
    public toast: ToastService,
    public crypto: CryptoService,
    public perms: PermissionService,
  ) {}

  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly record = signal<ClaimRecordDetailData | null>(null);
  readonly isSubmitted = signal(false);
  readonly saving = signal(false);

  readonly paymentStatusOptions = ['Pending', 'Paid', 'Denied'];
  selectedPaymentStatus = 'Pending';

  private recordId: string | null = null;
  private batchIdParam: string | null = null;

  async ngOnInit(): Promise<void> {
    this.batchIdParam = this.route.snapshot.paramMap.get('id');
    const encRecordId = this.route.snapshot.paramMap.get('recordId');
    if (!encRecordId) return;

    try {
      this.recordId = await this.crypto.decryptId(encRecordId);
    } catch {
      this.recordId = encRecordId;
    }

    await this.loadRecord();
  }

  /** Fetches the full detail record and syncs the editable Provider Payment Status field to its current value. */
  async loadRecord(): Promise<void> {
    if (!this.recordId) return;

    // Claim record detail endpoint: read-only claim fields plus the editable provider payment status and audit trail.
    const res = await this.api.request(
      'POST',
      API_ROUTES.GET_CLAIM_RECORD_DETAIL,
      { record_id: this.recordId },
      { showToaster: false },
    );

    if (res?.status && res.data) {
      const data = res.data as ClaimRecordDetailData;
      this.record.set(data);
      this.selectedPaymentStatus = data.provider_payment_status || 'Pending';
    }
  }

  /** Saves the (only editable) Provider Payment Status field, then reloads the record to pick up the refreshed audit trail. */
  async saveStatus(): Promise<void> {
    this.isSubmitted.set(true);
    if (!this.selectedPaymentStatus || !this.recordId) return;

    this.saving.set(true);
    try {
      // Payment-status update endpoint: the only field on a claim record that can be edited post-import.
      const res = await this.api.request('PUT', API_ROUTES.UPDATE_CLAIM_PAYMENT_STATUS, {
        record_id: this.recordId,
        provider_payment_status: this.selectedPaymentStatus,
      });
      if (res?.status) {
        // this.toast.success('Provider payment status updated.');
        this.isSubmitted.set(false);
        await this.loadRecord();
      }
    } finally {
      this.saving.set(false);
    }
  }

  /** Returns to the batch detail page's Claim Data tab. */
  cancel(): void {
    this.router.navigate(['/claim-data-list', this.batchIdParam], { queryParams: { tab: 'claim-data' } });
  }
}
