import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { FocusFirstInputDirective } from '../../../core/services/focusFirstInput.directive';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TrimWhitespaceDirective, FocusFirstInputDirective],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
/**
 * "Forgot password" form. Collects an email address and asks the backend to
 * send a password-reset link, without revealing whether that email exists.
 */
export class ForgotPasswordComponent {
  isSubmitted = signal(false);

  readonly form: FormGroup;

  constructor(
    public fb: FormBuilder,
    public api: ApiService,
    public router: Router,
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  get f() {
    return this.form.controls;
  }

  /**
   * Requests a password-reset email for the entered address, then resets the
   * form and returns to login on success.
   */
  async onSubmit(): Promise<void> {
    this.isSubmitted.set(true);
    if (this.form.invalid) return;
    // Triggers the backend to email a reset link; unauthenticated since the
    // user has no session yet.
    const resp = await this.api.request(
      'POST',
      API_ROUTES.FORGOT_PASSWORD,
      { email: this.form.getRawValue().email },
      { useToken: false },
    );
    if (resp?.status) {
      this.form.reset();
      this.isSubmitted.set(false);
      this.router.navigate(['/auth/login']);
    }
  }
}
