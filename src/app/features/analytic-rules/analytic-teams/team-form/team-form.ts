import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { KENDO_MULTISELECT } from '@progress/kendo-angular-dropdowns';

import { ApiService } from '../../../../core/services/api.service';
import { API_ROUTES } from '../../../../core/constants/api-routes';
import { FocusFirstInputDirective } from '../../../../core/services/focusFirstInput.directive';
import { noWhitespaceValidator } from '../../../../core/utils/validators.util';
import { TrimWhitespaceDirective } from '../../../../shared/directives/trim-whitespace.directive';

/** A `{ label, value }` option, as the supervisor and provider lookups return. */
interface LookupOption {
  label: string;
  value: string;
}

/** Sentinel value for the "add a new team" entry in the team list. */
const NEW_TEAM = '__new_team__';

/** Sentinel value for the "add a new supervisor" entry in the supervisor list. */
const NEW_SUPERVISOR = '__new__';

/**
 * Add Team — Threshold Configuration → Team & Supervisor.
 *
 * POST /organization/powerbi/analytic-rules/teams/create
 *   { team_id? | team_name?, supervisor_id? | new_supervisor_name?, provider_ids[] }
 *
 * The team and the supervisor are each either picked from the existing list
 * (`team_id` / `supervisor_id`) or typed in as a new name (`team_name` /
 * `new_supervisor_name`) — the API accepts one or the other, so the form sends
 * exactly one of each. There is no update endpoint, so this
 * page only ever creates.
 */
@Component({
  selector: 'app-team-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TrimWhitespaceDirective,
    FocusFirstInputDirective,
    ...KENDO_MULTISELECT,
  ],
  templateUrl: './team-form.html',
  styleUrl: './team-form.scss',
})
export class TeamForm implements OnInit {
  constructor(
    public api: ApiService,
    public fb: FormBuilder,
    public router: Router,
  ) {
    // Built here, not as a field initializer: with useDefineForClassFields
    // a field would read `this.fb` before the constructor assigns it.
    this.form = this.fb.group({
      team_option: ['', [Validators.required]],
      team_name: [''],
      supervisor_id: ['', [Validators.required]],
      new_supervisor_name: [''],
      provider_ids: [[] as string[], [Validators.required]],
    });
  }

  readonly NEW_SUPERVISOR = NEW_SUPERVISOR;
  readonly NEW_TEAM = NEW_TEAM;
  teamOptions: LookupOption[] = [];
  readonly isNewTeam = signal(false);

  readonly isSubmitted = signal(false);
  readonly saving = signal(false);
  readonly form: FormGroup;

  supervisorOptions: LookupOption[] = [];
  providerOptions: LookupOption[] = [];

  /** True while "Add new supervisor" is selected — reveals the free-text name field. */
  readonly isNewSupervisor = signal(false);

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadTeams(), this.loadSupervisors(), this.loadProviders()]);
  }

  /** Existing teams for the dropdown. */
  async loadTeams(): Promise<void> {
    const res = await this.api.request('GET', API_ROUTES.GET_ANALYTIC_TEAM_OPTIONS, undefined, {
      showToaster: false,
    });
    if (res?.status && Array.isArray(res.data)) {
      this.teamOptions = res.data.map((o: any) => ({ label: o.label, value: String(o.value) }));
    }
  }

  get f() {
    return this.form.controls;
  }

  /** Existing supervisors for the dropdown. */
  async loadSupervisors(): Promise<void> {
    const res = await this.api.request('GET', API_ROUTES.GET_ANALYTIC_SUPERVISORS, undefined, {
      showToaster: false,
    });
    if (res?.status && Array.isArray(res.data)) {
      this.supervisorOptions = res.data.map((o: any) => ({ label: o.label, value: String(o.value) }));
    }
  }

  /** Active providers for the team's member multi-select. */
  async loadProviders(): Promise<void> {
    const res = await this.api.request('POST', API_ROUTES.GET_PROVIDER_LOOKUP, { search: '' }, {
      showToaster: false,
    });
    if (res?.status && Array.isArray(res.data)) {
      this.providerOptions = res.data.map((o: any) => ({ label: o.label, value: String(o.value) }));
    }
  }

  /** Toggles between picking a team and naming a new one; `required` moves onto the visible field. */
  onTeamChange(): void {
    const isNew = this.f['team_option'].value === NEW_TEAM;
    this.isNewTeam.set(isNew);

    const nameControl = this.f['team_name'];
    if (isNew) {
      nameControl.setValidators([Validators.required, noWhitespaceValidator(), Validators.maxLength(100)]);
    } else {
      nameControl.setValidators(null);
      nameControl.setValue('');
    }
    nameControl.updateValueAndValidity();
  }

  /**
   * Toggles between picking an existing supervisor and naming a new one,
   * moving the `required` validator onto whichever field is actually shown.
   */
  onSupervisorChange(): void {
    const isNew = this.f['supervisor_id'].value === NEW_SUPERVISOR;
    this.isNewSupervisor.set(isNew);

    const nameControl = this.f['new_supervisor_name'];
    if (isNew) {
      nameControl.setValidators([Validators.required, noWhitespaceValidator(), Validators.maxLength(100)]);
    } else {
      nameControl.setValidators(null);
      nameControl.setValue('');
    }
    nameControl.updateValueAndValidity();
  }

  async onSubmit(): Promise<void> {
    this.isSubmitted.set(true);
    if (this.form.invalid || this.saving()) return;

    const { team_option, team_name, supervisor_id, new_supervisor_name, provider_ids } = this.form.value;
    // Exactly one of the two supervisor fields goes to the API — sending both
    // leaves the backend to guess which one the user meant.
    const payload = {
      // Same either/or as the supervisor: an existing team goes by id, a new one by name.
      ...(team_option === NEW_TEAM
        ? { team_name: String(team_name).trim() }
        : { team_id: team_option }),
      provider_ids,
      ...(supervisor_id === NEW_SUPERVISOR
        ? { new_supervisor_name: String(new_supervisor_name).trim() }
        : { supervisor_id }),
    };

    this.saving.set(true);
    try {
      // ApiService's global toaster surfaces the success / error message.
      const res = await this.api.request('POST', API_ROUTES.ADD_ANALYTIC_TEAM, payload);
      if (res?.status) this.router.navigate(['/analytic-rules'], { queryParams: { tab: 'teams' } });
    } finally {
      this.saving.set(false);
    }
  }
}
