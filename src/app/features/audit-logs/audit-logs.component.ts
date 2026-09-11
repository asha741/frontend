import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import {
  NgbDatepickerModule,
  NgbDateStruct,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../core/services/api.service';
import { API_ROUTES } from '../../core/constants/api-routes';
import { FilterAndSortingService } from '../../core/services/common-filter-sort.service';
import { PermissionService } from '../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../core/constants/permissions';
import { CryptoService } from '../../core/services/crypto.service';
import { ToastService } from '../../core/services/toast.service';
import { LoaderService } from '../../core/services/loader.service';
import { ConfigService } from '../../core/config/config.service';
import { TrimWhitespaceDirective } from '../../shared/directives/trim-whitespace.directive';
import { SearchAutocompleteComponent } from '../../shared/components/search-autocomplete/search-autocomplete.component';
import { CustomDropDownListFilterComponent } from '../../core/services/dropdownfilter.component';
import { toISOStartOfDay, toISOEndOfDay, getViewerTimezone } from '../../core/utils/date.util';
import { BadgeClassPipe } from '../../shared/pipes/badge-class.pipe';

/** Normalized row shape rendered by the grid (backend returns a generic dict). */
interface AuditLog {
  id: string;
  /** Position in the tamper-evident hash chain — what a broken link is reported by. */
  sequence: number | null;
  timestamp: string;
  actor: string;
  action: string;
  module: string;
  ipAddress: string;
  details: string;
}

/** Export formats the backend's `format` param accepts. */
type ExportFormat = 'csv' | 'xlsx';

/** Filename extension + MIME type to save each export format under. */
const EXPORT_FILE: Record<ExportFormat, { ext: string; mime: string }> = {
  csv: { ext: 'csv', mime: 'text/csv' },
  xlsx: {
    ext: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
};

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [
    BadgeClassPipe,
    GridModule,
    NgbTooltipModule,
    NgbDatepickerModule,
    FormsModule,
    DatePipe,
    TrimWhitespaceDirective,
    SearchAutocompleteComponent,
    CustomDropDownListFilterComponent,
  ],
  templateUrl: './audit-logs.component.html',
  styleUrl: './audit-logs.component.scss',
})
/**
 * Feature page that lists, filters, exports and verifies the tamper-evident
 * audit log chain. Wires the Kendo grid (paging/sorting/column filters) and
 * top-bar controls (keyword search, actor type-ahead, date range) to the
 * superadmin audit-logs API, and surfaces a CSV/XLSX export and a chain
 * integrity check.
 */
export class AuditLogsComponent implements OnInit {
  constructor(
    public api: ApiService,
    public filterSort: FilterAndSortingService,
    public perms: PermissionService,
    public crypto: CryptoService,
    public toast: ToastService,
    public loader: LoaderService,
    public config: ConfigService,
  ) {}

  /** Exposed so the top-bar filters can name their lookup endpoint. */
  readonly API_ROUTES = API_ROUTES;

  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  readonly loading = signal(false);
  readonly logsData = signal<GridDataResult>({ data: [], total: 0 });

  /** Result of the last chain-integrity check (shown inline next to the button). */
  readonly integrity = signal<{
    valid: boolean;
    message: string;
    brokenAtSequence: number | null;
    chainLength: number | null;
    legacyEntryCount: number | null;
  } | null>(null);

  /**
   * The tooltip for the integrity badge: the outcome plus the numbers the
   * backend reported, so a failure can be traced without opening devtools.
   */
  readonly integrityDetail = computed(() => {
    const chk = this.integrity();
    if (!chk) return '';

    const parts = [chk.message];
    if (chk.brokenAtSequence != null) parts.push(`Broken at sequence ${chk.brokenAtSequence}.`);
    if (chk.chainLength != null) parts.push(`Chain length: ${chk.chainLength}.`);
    if (chk.legacyEntryCount) parts.push(`Legacy (unsigned) entries: ${chk.legacyEntryCount}.`);
    return parts.join(' ');
  });

  /** Guards the Export button against a second click mid-download. */
  readonly exporting = signal(false);

  readonly pageSizes = [10, 25, 50];

  // ── Kendo grid state — mirrors the users-list pattern ──────────────
  // No default sort: the first load sends no sort_by/order, leaving the
  // backend's own default (timestamp desc) to apply.
  state: State = {
    skip: 0,
    take: 10,
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  // Global keyword search → sent as the `search` query param
  search = '';

  // Top-row date pickers → timestamp_from / timestamp_to
  fromDate: NgbDateStruct | null = null;
  toDate: NgbDateStruct | null = null;

  // Top-bar actor filter → the backend's `user`. Nothing is preloaded: it
  // type-ahead-searches POST /superadmin/audit-logs/filters, which takes
  // `{ module_search, action_search, user_search }` and answers with
  // `{ modules, actions, users }` — one param/list pair per field.
  actorFilter = '';

  // Action / Module are filtered from the grid's own column filter dropdowns
  // (not the top bar) — options are the full lists, preloaded once below.
  actionOptions: { label: string; value: string }[] = [];
  moduleOptions: { label: string; value: string }[] = [];

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadFilterOptions(), this.getAuditList()]);
  }

  /**
   * Preloads the full action/module lists for the grid's column filter
   * dropdowns. Unlike the actor field's type-ahead search, these dropdowns
   * need every value up front, so the endpoint is called with an empty body —
   * no `*_search` term — which answers with the complete `actions`/`modules`
   * lists instead of a filtered subset.
   */
  private async loadFilterOptions(): Promise<void> {
    const res = await this.api.request('POST', API_ROUTES.GET_AUDIT_LOG_FILTERS, {}, {
      showToaster: false,
      showLoader: false,
    });
    if (!res?.status) return;
    this.actionOptions = this.toFilterOptions(res.data?.actions);
    this.moduleOptions = this.toFilterOptions(res.data?.modules);
  }

  /** Normalizes a lookup list (strings or `{ label/value }`-ish rows) onto `{ label, value }`. */
  private toFilterOptions(list: any[] | undefined): { label: string; value: string }[] {
    return (list ?? []).map((o) => {
      if (o !== null && typeof o === 'object') {
        const value = String(o.value ?? o.id ?? o.key ?? '');
        const label = String(o.label ?? o.name ?? o.text ?? value);
        return { label, value };
      }
      return { label: String(o), value: String(o) };
    });
  }

  // ── Data loading ───────────────────────────────────────────────────

  /**
   * Loads the audit log page. The grid state (page / sort / column filters) and
   * the top-bar controls (search box + date pickers) are translated into the
   * backend's flat body params by the single reusable
   * `FilterAndSortingService.buildRequestBody()` helper, then sent as a POST.
   *
   * POST /api/v1/superadmin/audit-logs/list
   *   { page, limit, module, action, user, search,
   *     timestamp_from, timestamp_to, sort_by, order }
   */
  async getAuditList(): Promise<void> {
    this.loading.set(true);
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        search: this.search?.trim(),
        // End-of-day upper bound so the "To" date is fully inclusive
        timestamp_from: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        timestamp_to: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
        // Actor comes from the top bar; action/module come from the grid's
        // own column filters, already folded into `body` via `state.filter`.
        user: this.actorFilter,
      },
    });
    const res = await this.api.request('POST', API_ROUTES.GET_AUDIT_LOGS, body, {
      showToaster: false,
    });
    if (res?.status) {
      const d = res.data;
      const items = (d?.items ?? []).map((row: any, i: number) => this.normalize(row, i));
      this.logsData.set({ data: items, total: d?.pagination?.total_records ?? 0 });
    }
    this.loading.set(false);
  }

  /** Map a backend audit record (generic dict) onto the grid's row shape. */
  private normalize(row: any, i: number): AuditLog {
    return {
      id: String(row.id ?? row.audit_id ?? row._id ?? i),
      // Legacy (pre-chain) entries carry no sequence — render those as '—'
      // rather than coercing a missing value to 0, which would read as a
      // real position in the chain.
      sequence: row.sequence ?? null,
      timestamp: row.created_at ?? row.timestamp ?? row.timestamp_utc ?? row.date ?? '',
      actor:
        row.actor_name ??
        (row.actor && typeof row.actor === 'object'
          ? row.actor.name ?? [row.actor.first_name, row.actor.last_name].filter(Boolean).join(' ') ?? row.actor.email
          : row.actor) ??
        row.user ??
        row.user_name ??
        row.performed_by ??
        [row.first_name, row.last_name].filter(Boolean).join(' '),
      action: row.action ?? '',
      module: row.module ?? row.entity ?? row.entity_type ?? '',
      ipAddress: row.ip_address ?? row.ip ?? row.ipAddress ?? '',
      details: row.details ?? row.description ?? row.message ?? row.detail ?? '',
    };
  }

  // ── Grid paging / sorting / column filtering ──────────────────────

  /** Kendo grid callback fired on page/sort/column-filter changes; re-fetches with the new state. */
  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.getAuditList();
  }

  // ── Top-bar search / reset ─────────────────────────────────────────

  /** Applies the top-bar search/date filters, resetting to page 1 first (validates date range before running). */
  async onSearch(): Promise<void> {
    // Compare as 'YYYY-MM-DD' strings so this is a plain lexical (== calendar-date) comparison.
    if (this.fromDate && this.toDate && this.toDateStr(this.fromDate) > this.toDateStr(this.toDate)) {
      this.toast.warning('"From" date cannot be after "To" date.');
      return;
    }
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.getAuditList();
  }

  async clearSearch(): Promise<void> {
    this.search = '';
    this.actorFilter = '';
    this.fromDate = null;
    this.toDate = null;
    this.state = { ...this.state, skip: 0, filter: { logic: 'and', filters: [] } };
    await this.getAuditList();
  }

  /** NgbDateStruct → 'YYYY-MM-DD' (the format the date.util helpers expect). */
  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }

  // ── Export (CSV) ───────────────────────────────────────────────────

  /**
   * Exports the currently-filtered logs in `format` (CSV or Excel), honouring
   * every active filter, the search box, the date range and the sort.
   *
   * POST /api/v1/organization/audit/export
   *   { page, limit, module, action, user, search, ip_address,
   *     timestamp_from, timestamp_to, sort_by, order, format }
   *
   * Same body shape as the list call — only fields the user actually set
   * (search/actor/date range/column filters) are included, everything else
   * is omitted — plus `format`.
   *
   * The endpoint streams a file rather than the JSON envelope ApiService
   * expects, so it's fetched directly instead of through `api.request`. The
   * body is still AES-GCM encrypted and wrapped as `{ data: <cipher> }`, and
   * the bearer token still attached, exactly as ApiService would — only the
   * response handling differs (blob download instead of envelope parsing).
   */
  async exportLogs(format: ExportFormat = 'csv'): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.loader.show();
    try {
      const payload = this.filterSort.buildRequestBody(this.state, {
        extra: {
          search: this.search?.trim(),
          timestamp_from: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
          timestamp_to: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
          // Same top-bar actor filter the grid is showing; action/module are
          // folded in from `state.filter` (the grid's column filters).
          user: this.actorFilter,
          // IANA zone (e.g. 'Asia/Kolkata') so the export can render timestamps
          // in the viewer's local time instead of raw UTC, matching the grid.
          timezone: getViewerTimezone(),
          format,
        },
      });
      console.log('Audit log export payload:', payload);

      const url = this.config.apiUrl + API_ROUTES.EXPORT_AUDIT_LOGS;
      const token = (await this.crypto.tryDecryptPayload<string>(localStorage.getItem('accessToken'))) ?? '';
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ data: await this.crypto.encryptPayload(payload) }),
      });
      if (!resp.ok) {
        this.toast.error('Failed to export audit logs.');
        return;
      }

      const { ext, mime } = EXPORT_FILE[format];
      // Re-type the blob: a stream can arrive as application/octet-stream, which
      // Excel won't associate with .xlsx on some systems.
      const blob = new Blob([await resp.blob()], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `audit-logs.${ext}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }, 100);
    } catch {
      this.toast.error('Failed to export audit logs.');
    } finally {
      this.loader.hide();
      this.exporting.set(false);
    }
  }

  // ── Chain-integrity verification ───────────────────────────────────

  async verifyIntegrity(): Promise<void> {
    // showToaster stays default (true): on an HTTP-level failure (e.g. a 409
    // chain-integrity violation) the global ApiService toaster already shows
    // the backend's detail message, so we don't toast again here — we only
    // need to capture it into the `integrity` signal for the inline UI.
    const res = await this.api.request('GET', API_ROUTES.VERIFY_AUDIT_LOGS, null);
    if (!res?.status) {
      const msg = res?.message || 'Unable to verify audit log integrity.';
      this.integrity.set({
        valid: false,
        message: msg,
        brokenAtSequence: null,
        chainLength: null,
        legacyEntryCount: null,
      });
      return;
    }

    const d = res.data ?? {};

    // Fail closed. This is a tamper check, so anything short of an explicit
    // `valid: true` — a missing field, null, a renamed key — is NOT a pass.
    const valid = d.valid === true;

    // The envelope reports that the CHECK ran, not that it passed: a broken
    // chain still comes back 200 with "…verified successfully". So the envelope
    // message is only trustworthy on the success path — a failure explains
    // itself with `reason`, which names the sequence and what went wrong.
    const message = valid
      ? res.message || 'Audit log chain integrity verified.'
      : d.reason || 'Audit log chain integrity check failed.';

    this.integrity.set({
      valid,
      message,
      brokenAtSequence: d.broken_at_sequence ?? null,
      chainLength: d.chain_length ?? null,
      legacyEntryCount: d.legacy_entry_count ?? null,
    });
  }

  // ── View helpers ───────────────────────────────────────────────────

}
 