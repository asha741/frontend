import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { BhsMatrixComponent } from './bhs-matrix/bhs-matrix.component';
import { CptCredentialsComponent } from './cpt-credentials/cpt-credentials.component';
import { PermissionService } from '../../core/services/permission.service';
import { MenuType } from '../../core/constants/permissions';

/**
 * Masters landing page: hosts the BHS Matrix and CPT-to-Credential mapping
 * tabs, choosing the initial tab from the `tab` query param filtered through
 * the user's menu permissions.
 */
@Component({
  selector: 'app-masters',
  standalone: true,
  imports: [BhsMatrixComponent, CptCredentialsComponent],
  templateUrl: './masters.component.html',
  styleUrl: './masters.component.scss',
})
export class MastersComponent implements OnInit {
  constructor(public route: ActivatedRoute, public perms: PermissionService) {}

  readonly MenuType = MenuType;

  readonly activeTab = signal<'bhs' | 'cpt'>('bhs');

  /**
   * Picks the initial active tab: honors the `tab` query param only if the
   * user is permitted to access that menu; otherwise falls back to whichever
   * of BHS/CPT the user does have access to, defaulting to BHS.
   */
  ngOnInit(): void {
    const canBhs = this.perms.canAccessMenu(MenuType.Bhs);
    const canCpt = this.perms.canAccessMenu(MenuType.Cpt);

    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'cpt' && canCpt) this.activeTab.set('cpt');
    else if (tab === 'bhs' && canBhs) this.activeTab.set('bhs');
    // No accessible tab requested (or none permitted) — land on whichever the user holds.
    else if (!canBhs && canCpt) this.activeTab.set('cpt');
    else this.activeTab.set('bhs');
  }

  /** Switches the visible tab (no permission check — callers only expose permitted tabs). */
  switchTab(tab: 'bhs' | 'cpt'): void {
    this.activeTab.set(tab);
  }
}
