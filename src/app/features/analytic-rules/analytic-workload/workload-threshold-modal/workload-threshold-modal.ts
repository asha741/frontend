import { Component, Input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../../core/services/api.service';
import { API_ROUTES } from '../../../../core/constants/api-routes';

/**
 * Edits the one mutable field of a workload rule — its threshold value.
 *
 * PATCH /organization/powerbi/analytic-rules/workload/  { id, threshold_value }
 *
 * Closes with `'saved'` so the listing knows to refresh; a cancel dismisses.
 */
@Component({
  selector: 'app-workload-threshold-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './workload-threshold-modal.html',
  styleUrl: './workload-threshold-modal.scss',
})
export class WorkloadThresholdModal implements OnInit {
  /** The rule row being edited — supplied by the caller before the modal opens. */
  @Input() rule: any = null;

  readonly isSubmitted = signal(false);
  readonly saving = signal(false);
  readonly form: FormGroup;

  constructor(
    public activeModal: NgbActiveModal,
    public api: ApiService,
    public fb: FormBuilder,
  ) {
    // Built here, not as a field initializer: with useDefineForClassFields
    // a field would read `this.fb` before the constructor assigns it.
    this.form = this.fb.group({
      threshold_value: [null as number | null, [Validators.required, Validators.min(0)]],
    });
  }

  ngOnInit(): void {
    this.form.patchValue({ threshold_value: this.rule?.threshold_value ?? null });
  }

  get f() {
    return this.form.controls;
  }

  async onSubmit(): Promise<void> {
    this.isSubmitted.set(true);
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    try {
      const res = await this.api.request('PATCH', API_ROUTES.UPDATE_ANALYTIC_WORKLOAD_RULE, {
        id: this.rule?.id,
        threshold_value: Number(this.form.value.threshold_value),
      });
      // ApiService's global toaster surfaces the success / error message.
      if (res?.status) this.activeModal.close('saved');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.activeModal.dismiss('canceled');
  }
}
