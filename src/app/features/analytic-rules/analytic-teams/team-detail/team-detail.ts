import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiService } from '../../../../core/services/api.service';
import { API_ROUTES } from '../../../../core/constants/api-routes';
import { CryptoService } from '../../../../core/services/crypto.service';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';

/** One `{ id, name }` entry, as `supervisors[]` and `providers[]` return it. */
interface TeamMember {
  id: string;
  name: string;
}

/** The detail payload: team name, its supervisors, and its providers. */
interface TeamSupervisorDetail {
  team_name: string;
  supervisors: TeamMember[];
  providers: TeamMember[];
}

/**
 * Team Detail — read-only view of one analytic team.
 *
 * POST /organization/powerbi/analytic-rules/teams/detail  { id }
 *
 * Read-only by design: the API exposes no team update endpoint, and the
 * backend issues no `analytic_team:update` permission to gate one with.
 * The `:id` route param arrives AES-GCM encrypted.
 */
@Component({
  selector: 'app-team-detail',
  standalone: true,
  imports: [RouterLink, LoaderComponent],
  templateUrl: './team-detail.html',
  styleUrl: './team-detail.scss',
})
export class TeamDetail implements OnInit {
  constructor(
    public api: ApiService,
    public crypto: CryptoService,
    public route: ActivatedRoute,
  ) {}

  readonly loading = signal(false);
  readonly team = signal<TeamSupervisorDetail | null>(null);

  async ngOnInit(): Promise<void> {
    const encId = this.route.snapshot.paramMap.get('id');
    if (!encId) return;

    const id = await this.crypto.decryptId(encId);
    if (!id) return;

    this.loading.set(true);
    const res = await this.api.request('POST', API_ROUTES.GET_ANALYTIC_TEAM_DETAIL, { id }, {
      showToaster: false,
    });
    if (res?.status && res.data) {
      this.team.set({
        team_name: res.data.team_name ?? '',
        supervisors: Array.isArray(res.data.supervisors) ? res.data.supervisors : [],
        providers: Array.isArray(res.data.providers) ? res.data.providers : [],
      });
    }
    this.loading.set(false);
  }
}
