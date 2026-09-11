import { Component, OnInit, computed, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { API_ROUTES } from '../../core/constants/api-routes';
import { FocusFirstInputDirective } from '../../core/services/focusFirstInput.directive';
import { ToastService } from '../../core/services/toast.service';
import { PermissionService } from '../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../core/constants/permissions';
import { TrimWhitespaceDirective } from '../../shared/directives/trim-whitespace.directive';

/**
 * Organization-level Settings — currently a single Consecutive Days Threshold
 * used by Claim Data Analytics' Consecutive Day Analysis screen.
 * GET/PUT /organization/settings/consecutive-days-threshold
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, TrimWhitespaceDirective, FocusFirstInputDirective],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly saving = signal(false);
  readonly isSubmitted = signal(false);

  readonly form: FormGroup;

  constructor(
    public api: ApiService,
    public fb: FormBuilder,
    public toast: ToastService,
    public perms: PermissionService,
  ) {
    this.form = this.fb.group({
      consecutiveDaysThreshold: [
        null,
        [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1), Validators.max(31)],
      ],
    });
  }

  /** `Settings: Update` gates editing/saving; `Settings: Read` (via PermissionGuard) already gates the route itself. */
  readonly canUpdate = computed(() =>
    this.perms.can(PERMISSION_MODULE.Settings, PERMISSION_ACTION.Update),
  );

  get f() {
    return this.form.controls;
  }

  /**
   * Blocks non-digit keystrokes at the source (letters, symbols, 'e'/'+'/'-'
   * which a native number input would otherwise accept). Navigation/edit keys
   * and Ctrl/Cmd combos (copy/paste/select-all) are left untouched.
   */
  onThresholdKeydown(event: KeyboardEvent): void {
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (event.ctrlKey || event.metaKey || allowedKeys.includes(event.key)) return;
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  /** Strips non-digit characters from pasted text instead of blocking the paste outright. */
  onThresholdPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const digitsOnly = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 2);
    this.form.get('consecutiveDaysThreshold')?.setValue(digitsOnly ? Number(digitsOnly) : null);
  }

  /** Lifecycle hook: loads the current threshold value as soon as the component mounts. */
  async ngOnInit(): Promise<void> {
    await this.loadThreshold();
  }

  /** Fetches the org's current consecutive-days threshold and populates the form with it. */
  async loadThreshold(): Promise<void> {
    // GET the persisted threshold; suppress the toaster since this is a silent background load, not a user action.
    const res = await this.api.request('GET', API_ROUTES.GET_CONSECUTIVE_DAYS_THRESHOLD, null, {
      showToaster: false,
    });
    if (res?.status) {
      this.form.patchValue({
        consecutiveDaysThreshold: res.data?.consecutive_day_threshold ?? null,
      });
    }
  }

  /**
   * Validates and persists the threshold value entered by the user.
   * No-ops if the user lacks update permission or the form fails validation.
   */
  async saveSettings(): Promise<void> {
    if (!this.canUpdate()) return;

    this.isSubmitted.set(true);
    if (this.form.invalid) return;

    // PUT the new threshold to the org settings endpoint; toaster shown to confirm success/failure to the user.
    const res = await this.api.request('PUT', API_ROUTES.UPDATE_CONSECUTIVE_DAYS_THRESHOLD, {
      consecutive_day_threshold: Number(this.form.value.consecutiveDaysThreshold),
    }, { showToaster: true });

    if (res?.status) {
      // Re-fetch to reflect the server's authoritative saved value (e.g. after any server-side normalization).
      await this.loadThreshold();
    }
  }
}
