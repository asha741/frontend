import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FocusFirstInputDirective } from '../../../core/services/focusFirstInput.directive';
import { ApiService } from '../../../core/services/api.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { matchFieldValidator, passwordPolicyValidator } from '../../../core/utils/validators.util';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, TrimWhitespaceDirective, FocusFirstInputDirective],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
/**
 * Landing page for an emailed "reset password" link. Verifies the reset
 * token/org_id pair from the URL on load, then lets the user set a new
 * password before redirecting to login.
 */
export class ResetPasswordComponent implements OnInit {
  isSubmitted = signal(false);
  readonly showNew = signal(false);
  readonly showConfirm = signal(false);

  /**
   * True until the reset token has been checked. The form stays hidden while
   * this is set, so a dead link never renders a form that can't be submitted.
   */
  readonly verifying = signal(true);

  readonly form: FormGroup;

  /** Captured once at verify time and reused on submit. */
  private token = '';
  private orgId = '';

  constructor(
    public fb: FormBuilder,
    public api: ApiService,
    public route: ActivatedRoute,
    public router: Router,
    private crypto: CryptoService,
  ) {
    // Build the form in the constructor body — a field initializer would read
    // `this.fb` before the injected params are assigned.
    this.form = this.fb.group({
      newPassword: ['', [passwordPolicyValidator()]],
      confirmPassword: ['', [Validators.required, matchFieldValidator('newPassword')]],
    });

    // matchFieldValidator only re-runs when confirmPassword itself changes, so
    // editing newPassword after confirmPassword was already filled leaves the
    // mismatch undetected until the backend rejects it. Re-validate confirmPassword
    // whenever newPassword changes so the client-side error stays accurate.
    this.form.controls['newPassword'].valueChanges.subscribe(() => {
      this.form.controls['confirmPassword'].updateValueAndValidity({ emitEvent: false });
    });
  }

  async ngOnInit(): Promise<void> {
    await this.verifyToken();
  }

  /**
   * Reset links are emailed, so they get followed late, twice, or after the
   * password was already changed. Check the token up front and bounce a dead
   * link to login rather than letting the user fill in the form and only then
   * discover it expired. The toaster carries the backend's reason.
   */
  private async verifyToken(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    const encryptedOrgId = this.route.snapshot.queryParamMap.get('org_id') ?? '';
    if (!token || !encryptedOrgId) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // The org_id in the URL is already encrypted — decrypt it to recover the
    // plain value before sending. ApiService will re-encrypt the whole body.
    // A tampered or truncated link throws here, which is itself a dead link.
    let org_id: string;
    try {
      org_id = await this.crypto.decryptId(encryptedOrgId);
    } catch {
      this.router.navigate(['/auth/login']);
      return;
    }

    const resp = await this.api.request(
      'POST',
      API_ROUTES.VERIFY_RESET_TOKEN,
      { token, org_id },
      { useToken: false, showToaster: false }
    );
    if (!resp?.status) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.token = token;
    this.orgId = org_id;
    this.verifying.set(false);
  }

  get f() {
    return this.form.controls;
  }

  /**
   * Submits the new password using the token/org_id captured during
   * verification, then redirects to login on success.
   */
  async onSubmit(): Promise<void> {
    this.isSubmitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const token = this.token;
    const org_id = this.orgId;
    const { newPassword, confirmPassword } = this.form.value;
    // The backend contract is snake_case (ResetPasswordRequest). This endpoint
    // is unauthenticated (the token in the body is the credential), so no bearer.
    const resp = await this.api.request(
      'POST',
      API_ROUTES.RESET_PASSWORD,
      { token, new_password: newPassword, confirm_password: confirmPassword, org_id },
      { useToken: false }
    );
    if (resp?.status) {
      this.router.navigate(['/auth/login']);
    }
  }
}
