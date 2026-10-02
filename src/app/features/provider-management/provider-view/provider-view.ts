import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../../core/constants/permissions';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';
import { UsPhonePipe } from '../../../shared/pipes/us-phone.pipe';

interface ProviderDetail {
  id: string;
  provider_id: string;
  external_id?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  designation?: string;
  license?: string[];
  email?: string;
  contact_number?: string;
  patients_attended?: number;
  performance_score?: number;
  status: string;
  created_at?: string;
}

/**
 * Provider View — read-only provider snapshot reached from the Provider
 * Management grid's "View Provider" action. Mirrors the fields on
 * `ProviderForm` but display-only; its "Edit Provider" button is the only
 * way into the editable `ProviderForm` page.
 */
@Component({
  selector: 'app-provider-view',
  standalone: true,
  imports: [BadgeClassPipe, DatePipe, UsPhonePipe],
  templateUrl: './provider-view.html',
  styleUrl: './provider-view.scss',
})
export class ProviderView implements OnInit {
  constructor(
    public api: ApiService,
    public route: ActivatedRoute,
    public router: Router,
    public crypto: CryptoService,
    public perms: PermissionService,
  ) {}

  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly provider = signal<ProviderDetail | null>(null);

  private providerId: string | null = null;
  private encId: string | null = null;

  async ngOnInit(): Promise<void> {
    const encId = this.route.snapshot.paramMap.get('id');
    if (!encId) return;
    this.encId = encId;

    try {
      this.providerId = await this.crypto.decryptId(encId);
    } catch {
      // Handle either encrypted ids or plain ids (e.g. a stale/unencrypted link).
      this.providerId = encId;
    }

    await this.loadProvider();
  }

  /** Fetches the full provider record by id — same lookup used by `ProviderForm`'s edit mode. */
  async loadProvider(): Promise<void> {
    if (!this.providerId) return;

    const res = await this.api.request('POST', API_ROUTES.GET_PROVIDER_BY_ID, { id: this.providerId }, {
      showToaster: false,
    });

    if (!res?.status || !res.data) {
      this.router.navigate(['/provider-management']);
      return;
    }

    this.provider.set(res.data as ProviderDetail);
  }

  /** Full name, tolerant of an absent middle name. */
  fullName(): string {
    const p = this.provider();
    if (!p) return '-';
    return [p.first_name, p.middle_name, p.last_name].filter((part) => !!part?.trim()).join(' ') || '-';
  }

  /** First-name + last-name initials for the hero card's avatar circle. */
  initials(): string {
    const p = this.provider();
    if (!p) return '';
    return `${p.first_name?.[0] ?? ''}${p.last_name?.[0] ?? ''}`.toUpperCase();
  }

  licenseList(): string[] {
    return (this.provider()?.license ?? []).filter((l) => !!l?.trim());
  }

  /** "Edit Provider" — opens the editable `ProviderForm` page. */
  editProvider(): void {
    if (!this.encId) return;
    this.router.navigate(['/provider-management/edit-provider', this.encId]);
  }
}
