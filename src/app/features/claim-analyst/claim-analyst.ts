import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { Router, RouterLink } from '@angular/router';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { CustomDropDownListFilterComponent } from '../../core/services/dropdownfilter.component';
import { ApiService } from '../../core/services/api.service';
import { API_ROUTES } from '../../core/constants/api-routes';
import { FilterAndSortingService } from '../../core/services/common-filter-sort.service';
import { CryptoService } from '../../core/services/crypto.service';
import { ToastService } from '../../core/services/toast.service';
import { LoaderService } from '../../core/services/loader.service';
import { SearchAutocompleteComponent } from '../../shared/components/search-autocomplete/search-autocomplete.component';
import { DeleteConfirmationComponent } from '../../shared/components/delete-confirmation/delete-confirmation.component';
import { TrimWhitespaceDirective } from '../../shared/directives/trim-whitespace.directive';
import { PermissionService } from '../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../core/constants/permissions';
import { BadgeClassPipe } from '../../shared/pipes/badge-class.pipe';
import {
  AI_STATUS_POLL_MS,
  aiProgressPercent,
  isAiInProgress as aiStatusInProgress,
} from '../../core/utils/ai-status.util';

/**
 * Same static backend base URL used by the Claim Analytic Upload sample-file
 * export (`analytic-upload.ts`) — the raw `fetch` below has to match it or it
 * hits the wrong backend.
 */
const API_BASE_URL = 'https://hkdevapi-apccfxfnfwgvcta5.eastus2-01.azurewebsites.net/api/v1';

@Component({
  selector: 'app-claim-analyst',
  standalone: true,
  imports: [
    BadgeClassPipe,
    GridModule,
    NgbTooltipModule,
    FormsModule,
    DatePipe,
    RouterLink,
    CustomDropDownListFilterComponent,
    TrimWhitespaceDirective,
    SearchAutocompleteComponent,
  ],
  templateUrl: './claim-analyst.html',
  styleUrl: './claim-analyst.scss',
})
/**
 * Claims list / grid page for the Claim Analyst feature. Loads review-status
 * and AI-status enum options, fetches the paginated claim list from the
 * backend (with search/provider/column filtering and sorting), and lets the
 * analyst navigate to a claim's detail view or delete a claim.
 */
export class ClaimAnalyst implements OnInit, OnDestroy {
  constructor(
    public router: Router,
    public api: ApiService,
    public filterSort: FilterAndSortingService,
    public crypto: CryptoService,
    public perms: PermissionService,
    public modal: NgbModal,
    public toast: ToastService,
    public loader: LoaderService,
  ) {}

  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  /** Exposed so the provider column filter can name its lookup endpoint. */
  readonly API_ROUTES = API_ROUTES;

  readonly claimsData = signal<GridDataResult>({ data: [], total: 0 });

  readonly pageSizes = [10, 25, 50];

  state: State = {
    skip: 0,
    take: 10,
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  search = '';

  /** Top-bar provider filter (id) — sent as `provider_id`. */
  providerId = '';

  reviewStatusOptions: { label: string; value: string }[] = [];

  aiStatusOptions: { label: string; value: string }[] = [];

  /** The pending status read, or null when no row on the page is processing. */
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  /** Set on destroy so an in-flight response is dropped instead of applied. */
  private destroyed = false;

  /**
   * Loads the review-status (typeId 3) and AI-status (typeId 4) dropdown
   * options, then loads the first page of claims.
   */
  async ngOnInit(): Promise<void> {
    // Shared "master list" enum endpoint — one call returns option lists for
    // multiple typeIds at once, so both dropdowns are fetched together.
    const enumsResp = await this.api.request('POST', API_ROUTES.GET_MASTER_LIST, { typeIds: [3, 4] }, {
      showToaster: false,
    });
    if (enumsResp?.status && Array.isArray(enumsResp.data)) {
      const data = enumsResp.data;
      
      const reviewStatusType = data.find((d: any) => d.typeId === 3);
      if (reviewStatusType && Array.isArray(reviewStatusType.options)) {
        this.reviewStatusOptions = [...reviewStatusType.options];
      }

      const aiStatusType = data.find((d: any) => d.typeId === 4);
      if (aiStatusType && Array.isArray(aiStatusType.options)) {
        this.aiStatusOptions = [...aiStatusType.options];
      }
    }

    // The provider lookup is NOT preloaded — the top-bar Provider field
    // searches it as the user types. Picking one only stores the id; the list
    // is re-fetched when Search is clicked.
    await this.getClaimList();
  }

  /**
   * Builds the grid request body (search/filter/sort/pagination) and fetches
   * the current page of claims, updating `claimsData` for the Kendo grid.
   */
  async getClaimList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        search: this.search?.trim(),
        // Provider now comes from the top bar, not a column filter.
        provider_id: this.providerId,
      },
      // The Provider column is still sortable, and the backend's `sort_by`
      // takes `provider_id` — not the column's own field name.
      fieldMap: {
        provider_name: 'provider_id',
      },
    });

    // Paginated/filtered/sorted claim list for the grid.
    const res = await this.api.request('POST', API_ROUTES.GET_CLAIMS, body, {
      showToaster: false,
    });
    if (this.destroyed) return;

    if (res?.status) {
      const d = res.data;
      this.claimsData.set({
        data: d?.items ?? [],
        total: d?.pagination?.total_records ?? 0,
      });
    }

    // The page just changed — re-decide whether it still needs watching, and
    // read the statuses straight away so a processing row shows a live
    // percentage now rather than at the end of the first interval.
    this.scheduleAiStatusRead(0);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopAiStatusWatch();
  }

  /** Kendo grid callback for paging/sorting/filtering changes. */
  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.getClaimList();
  }

  /** Runs the top-bar search, resetting back to the first page. */
  async onSearch(): Promise<void> {
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.getClaimList();
  }

  /** Clears the search text and provider filter, then reloads page 1. */
  async clearSearch(): Promise<void> {
    this.search = '';
    this.providerId = '';
    this.state = { ...this.state, skip: 0 };
    await this.getClaimList();
  }

  /** Navigates to the claim detail view, encrypting the id for the URL. */
  async viewClaim(claim: any): Promise<void> {
    const encId = await this.crypto.encryptId(String(claim.id));
    this.router.navigate(['/claim-analyst/view', encId]);
  }

  /** Ids of claims currently downloading their audit report — guards repeat clicks per row. */
  readonly downloadingReportIds = signal<Set<string>>(new Set());

  isDownloadingReport(claim: any): boolean {
    return this.downloadingReportIds().has(String(claim?.id ?? ''));
  }

  /**
   * Downloads the audit report for a single claim.
   *
   * POST /organization/claims/audit-report/export
   *   { claim_id, claim_ids, data }
   *
   * The backend always streams an XLSX workbook here regardless of the
   * `data` value sent, so the file is saved as `.xlsx` — saving it as `.pdf`
   * produces a file whose bytes don't match its extension and every PDF
   * viewer refuses to open.
   *
   * The endpoint streams a file rather than the JSON envelope `ApiService`
   * expects, so it's fetched directly — same pattern as the audit-logs and
   * analytic-upload sample-file exports: the body is still AES-GCM encrypted
   * and wrapped as `{ data: <cipher> }`, and the bearer token still attached.
   */
  async downloadAuditReport(claim: any): Promise<void> {
    // The backend's audit-report export takes the claim's UUID primary key
    // (`id`), not the human-readable `claim_id` code (e.g. "CLM-7WUW19Y2")
    // shown in the grid's Claim ID column.
    const id = String(claim?.id ?? '');
    if (!id || this.isDownloadingReport(claim)) return;

    const next = new Set(this.downloadingReportIds());
    next.add(id);
    this.downloadingReportIds.set(next);
    this.loader.show();
    try {
      const url = API_BASE_URL + API_ROUTES.EXPORT_CLAIM_AUDIT_REPORT;
      const token = (await this.crypto.tryDecryptPayload<string>(localStorage.getItem('accessToken'))) ?? '';
      const payload = { claim_id: id, claim_ids: [id], data: 'pdf' };
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ data: await this.crypto.encryptPayload(payload) }),
      });
      if (!resp.ok) {
        const message = await this.backendErrorMessage(resp);
        this.toast.error(message || 'Failed to download the audit report.');
        return;
      }

      const blob = new Blob([await resp.blob()], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      // The human-readable claim code (e.g. "CLM-7WUW19Y2"), not the UUID
      // sent in the request — that's what's meaningful in a file name.
      link.download = `claim-report-${claim?.claim_id || id}.xlsx`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }, 100);
    } catch {
      this.toast.error('Failed to download the audit report.');
    } finally {
      this.loader.hide();
      const cleared = new Set(this.downloadingReportIds());
      cleared.delete(id);
      this.downloadingReportIds.set(cleared);
    }
  }

  /**
   * Reads the backend's message off a failed raw `fetch`. The body is the
   * same AES-GCM `{ data: "<cipher>" }` envelope `ApiService` decrypts.
   */
  private async backendErrorMessage(resp: Response): Promise<string> {
    try {
      const body = await resp.json();
      const envelope = typeof body?.data === 'string'
        ? ((await this.crypto.tryDecryptPayload<any>(body.data)) ?? body)
        : body;

      const detail = Array.isArray(envelope?.error) ? envelope.error[0]?.detail : null;
      if (typeof detail === 'string' && detail) return detail;
      if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
        return detail.message;
      }
      return typeof envelope?.message === 'string' ? envelope.message : '';
    } catch {
      return '';
    }
  }

  /** Confirms via modal, then deletes the claim and refreshes the list. */
  deleteClaim(claim: any): void {
    const ref = this.modal.open(DeleteConfirmationComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });
    ref.componentInstance.message = 'Are you sure you want to delete this claim?';
    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') return;
        // Deletes the claim by id.
        const resp = await this.api.request('DELETE', API_ROUTES.DELETE_CLAIM, {
          claim_id: claim.id ?? claim.claim_id,
        });
        if (resp?.status) await this.getClaimList();
      },
      () => {},
    );
  }

  // ── AI status watch ───────────────────────────────────────────────
  //
  // Claims still being validated report their progress through
  // /organization/claims/status, which takes every id at once
  // (`{ claim_ids: [...] }`) and answers with one row per claim. So the page
  // makes a single call every 20 seconds, however many rows are processing,
  // and stops entirely once none are.

  /** The claim's primary key — the same id `deleteClaim` / `viewClaim` send. */
  private rowId(claim: any): string {
    return String(claim?.id ?? claim?.claim_id ?? '');
  }

  /** True while the AI is still working on this claim (Pending / Processing). */
  isAiInProgress(aiStatus: string | null | undefined): boolean {
    return aiStatusInProgress(aiStatus);
  }

  /** Completion percentage for a row, clamped to 0–100 for the bar's width. */
  aiProgress(claim: any): number {
    return aiProgressPercent(claim?.ai_processing_progress);
  }

  /** Ids of every row on the current page that is still waiting on the AI. */
  private pendingRowIds(): string[] {
    const ids: string[] = [];
    for (const claim of (this.claimsData().data as any[]) ?? []) {
      const id = this.rowId(claim);
      if (id && this.isAiInProgress(claim?.ai_status)) ids.push(id);
    }
    return ids;
  }

  /**
   * Arms the next status read while the page has a processing row, and stops
   * the loop when it doesn't. Called after every load — including the ones the
   * user triggers — so paging or searching replaces the pending timer rather
   * than stacking a second one on top of it.
   *
   * `delayMs` only ever shortens the FIRST read after a list load; every
   * reschedule from `readAiStatus` takes the full interval, so a failing
   * request can't turn the loop into a tight retry. Going through the timer
   * even at 0 keeps the read cancellable and off the list load's own await.
   */
  private scheduleAiStatusRead(delayMs = AI_STATUS_POLL_MS): void {
    this.stopAiStatusWatch();
    if (this.destroyed || !this.pendingRowIds().length) return;

    this.pollTimer = setTimeout(() => void this.readAiStatus(), delayMs);
  }

  /**
   * One read covering every processing row, then either the next read or the
   * end of the loop.
   */
  private async readAiStatus(): Promise<void> {
    if (this.destroyed) return;
    this.pollTimer = null;

    // Re-read the ids rather than closing over them: the page may have changed
    // between this timer being armed and it firing.
    const claimIds = this.pendingRowIds();
    if (!claimIds.length) return;

    // Silent: this runs on a timer, so no global loader and no toaster.
    const res = await this.api.request(
      'POST',
      API_ROUTES.GET_CLAIM_STATUS,
      { claim_ids: claimIds },
      { showToaster: false, showLoader: false },
    );
    if (this.destroyed) return;

    if (res?.status && Array.isArray(res.data)) {
      this.applyStatuses(res.data);
    }

    // A failed read changes nothing and is treated as "still processing" — one
    // dropped request must not end the watch. `scheduleAiStatusRead` stops the
    // loop on its own once no row is left processing.
    this.scheduleAiStatusRead();
  }

  /**
   * Merges a status response into its rows, matched by claim id. Only the
   * fields the status endpoint owns are copied, so a partial response can't
   * blank out the rest of a row, and rows it didn't mention are left alone.
   */
  private applyStatuses(statuses: any[]): void {
    const byId = new Map<string, any>();
    for (const status of statuses) {
      const id = String(status?.id ?? status?.claim_id ?? '');
      if (id) byId.set(id, status);
    }
    if (!byId.size) return;

    const current = this.claimsData();
    const rows = ((current.data as any[]) ?? []).map((claim) => {
      const status = byId.get(this.rowId(claim));
      if (!status) return claim;
      return {
        ...claim,
        ai_status: status.ai_status ?? claim.ai_status,
        ai_processing_progress: status.ai_processing_progress ?? claim.ai_processing_progress,
        ai_processing_stage: status.ai_processing_stage ?? claim.ai_processing_stage,
        compliance_score: status.compliance_score ?? claim.compliance_score,
        review_status: status.review_status ?? claim.review_status,
      };
    });
    this.claimsData.set({ ...current, data: rows });
  }

  private stopAiStatusWatch(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }
}
