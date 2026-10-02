import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AnalyticTeams } from './analytic-teams/analytic-teams';
import { AnalyticWorkload } from './analytic-workload/analytic-workload';
import { PermissionService } from '../../core/services/permission.service';
import { MenuType } from '../../core/constants/permissions';

/** The two tabs this page hosts. */
export type AnalyticRulesTab = 'teams' | 'thresholds';

/**
 * Threshold Configuration landing page: hosts the Teams & Supervisors and Thresholds
 * tabs, choosing the initial tab from the `tab` query param filtered through
 * the user's menu permissions — the two tabs are separate menus
 * (Analytic Team / Analytic Workload), so a user may hold only one.
 */
@Component({
  selector: 'app-analytic-rules',
  standalone: true,
  imports: [AnalyticTeams, AnalyticWorkload],
  templateUrl: './analytic-rules.html',
  styleUrl: './analytic-rules.scss',
})
export class AnalyticRules implements OnInit {
  constructor(public route: ActivatedRoute, public perms: PermissionService) {}

  readonly MenuType = MenuType;

  readonly activeTab = signal<AnalyticRulesTab>('teams');

  /**
   * Picks the initial active tab: honours the `tab` query param only if the
   * user may access that menu; otherwise falls back to whichever of the two
   * the user does hold, defaulting to Teams.
   */
  ngOnInit(): void {
    const canTeams = this.perms.canAccessMenu(MenuType.AnalyticTeam);
    const canWorkload = this.perms.canAccessMenu(MenuType.AnalyticWorkload);

    const tab = this.route.snapshot.queryParamMap.get('tab');
    if ((tab === 'thresholds' || tab === 'workload') && canWorkload) this.activeTab.set('thresholds');
    else if (tab === 'teams' && canTeams) this.activeTab.set('teams');
    // No accessible tab requested (or none permitted) — land on whichever the user holds.
    else if (!canTeams && canWorkload) this.activeTab.set('thresholds');
    else this.activeTab.set('teams');
  }

  /** Switches the visible tab (no permission check — callers only expose permitted tabs). */
  switchTab(tab: AnalyticRulesTab): void {
    this.activeTab.set(tab);
  }
}
