import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CellRowspanFn, DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';
import {
  AI_STATUS_POLL_MS,
  aiProgressPercent,
  isAiInProgress as aiStatusInProgress,
} from '../../../core/utils/ai-status.util';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuType } from '../../../core/constants/permissions';

/** One failed page of a document, listed on the Failed Pages Reason page. */
export interface FailedPage {
  sr_no: number;
  page_no: number;
  reason: string;
}

/** One row of the Documents tab. */
export interface BatchDocument {
  sr_no: number;
  document_name: string;
  status: string;
  pages_processed: number;
  pages_failed: number;
  failed_reason: string;
  failed_pages?: FailedPage[];
}

/** One patient/provider pairing of the Extract Data tab. */
interface BatchExtractRow {
  sr_no: number;
  patient_name: string;
  client_id: string;
  provider_name: string;
  provider_license: string;
  treatment_plan: number;
  progress_notes: number;
  dla_20: number;
  status: string;
  failure_reason: string;
}

/**
 * Only the first row of a patient's group carries `isGroupStart`, with
 * `groupSize` set to the row count of that group. `extractPatientRowspan`
 * (below) uses these to drive the Patient Name column's Kendo `cellRowspan`.
 */
interface ExtractDisplayRow extends BatchExtractRow {
  isGroupStart: boolean;
  groupSize: number;
}

/** One row of the Claims tab. */
interface BatchClaim {
  sr_no: number;
  id?: string;
  claim_id: string;
  patient_name: string;
  client_id: string;
  provider_name: string;
  document_count: number;
  upload_type: string;
  ai_status: string;
  /** Present while the AI is still running — see /organization/claims/status. */
  ai_processing_progress?: number;
  ai_processing_stage?: string;
  compliance_score: number;
  review_status: string;
  uploaded_at: string;
}

type DetailTab = 'documents' | 'extract-data' | 'claims';

const emptyState = (): State => ({ skip: 0, take: 10, sort: [], filter: { logic: 'and', filters: [] } });

/**
 * A UUID — the batch's internal id. Never a batch reference anyone should be
 * shown, so `batchLabel` suppresses one wherever it comes from.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bulk Upload — Batch Detail (read-only).
 *
 * POST /organization/bulk-upload/batches/detail  { batch_id }
 * → { batch_information, documents, extract_data, claims }
 *
 * Everything arrives in one response, so all three tabs page client-side.
 */
@Component({
  selector: 'app-bulk-upload-detail',
  standalone: true,
  imports: [BadgeClassPipe, GridModule, NgbTooltipModule, DatePipe],
  templateUrl: './bulk-upload-detail.html',
  styleUrl: './bulk-upload-detail.scss',
})
export class BulkUploadDetail implements OnInit, OnDestroy {
  constructor(
    public api: ApiService,
    public route: ActivatedRoute,
    public router: Router,
    public crypto: CryptoService,
    public perms: PermissionService,
  ) {}

  readonly MenuType = MenuType;

  readonly pageSizes = [10, 25, 50];
  readonly loading = signal(false);
  readonly activeTab = signal<DetailTab>('documents');

  readonly batchId = signal<string>('');
  readonly batchInfo = signal<Record<string, any>>({});

  /** The id exactly as it sits in the URL — reused when linking to a sub-page. */
  private encryptedBatchId = '';

  // ── Batch Information strip ─────────────────────────────────────────
  /**
   * The human-readable batch reference (e.g. "BCH-2026-010"). Deliberately NOT
   * falling back to the route's own id: until the detail response lands this is
   * empty and the heading reads just "Batch Detail", rather than flashing the
   * internal UUID. `batch_id` is still accepted as a second choice, but only
   * when it carries a real code — a UUID under that key is suppressed too.
   */
  readonly batchLabel = computed(() => {
    const label = this.pick(['batch_code', 'batch_id']);
    return UUID_RE.test(label) ? '' : label;
  });
  readonly treatmentPlanCount = computed(() => this.pick(['treatment_plan', 'treatment_plan_count']));
  readonly progressNotesCount = computed(() => this.pick(['progress_notes', 'progress_notes_count']));
  readonly dla20Count = computed(() => this.pick(['dla_20', 'dla_20_count']));
  readonly fileSize = computed(() => this.pick(['file_size']));
  readonly batchStatus = computed(() => this.pick(['status', 'batch_status']));

  // ── Documents tab ───────────────────────────────────────────────────
  private allDocuments: BatchDocument[] = [];
  documentsState: State = emptyState();
  readonly documentsGridData = signal<GridDataResult>({ data: [], total: 0 });

  // ── Extract Data tab (grouped by patient, shown unpaginated) ────────
  readonly extractGridData = signal<GridDataResult>({ data: [], total: 0 });

  /**
   * Merges the Patient Name column's cell over `groupSize` rows, starting at
   * each group's first row. Kendo's `RowArgs.dataItem` is its internal row
   * wrapper (`{ data, index, type, ... }`), not the raw row — unwrap `.data`
   * to reach the fields `groupExtractRows` set.
   */
  readonly extractPatientRowspan: CellRowspanFn = (row) => {
    const item = (row.dataItem?.data ?? row.dataItem) as ExtractDisplayRow;
    return item?.isGroupStart ? item.groupSize : 1;
  };

  // ── Claims tab ──────────────────────────────────────────────────────
  private allClaims: BatchClaim[] = [];

  /** The pending AI status read, or null when no claim on the page is processing. */
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  /** Set on destroy so an in-flight status response is dropped instead of applied. */
  private destroyed = false;
  claimsState: State = emptyState();
  readonly claimsGridData = signal<GridDataResult>({ data: [], total: 0 });

  /** Resolves the batch id from the route (decrypting it) and loads the batch detail. */
  async ngOnInit(): Promise<void> {
    const encId = this.route.snapshot.paramMap.get('id');
    if (!encId) return;

    this.encryptedBatchId = encId;
    let batchId = encId;
    try {
      batchId = await this.crypto.decryptId(encId);
    } catch {
      // A plain (unencrypted) id in the URL is still usable.
    }
    this.batchId.set(batchId);
    await this.loadDetail();
  }

  /** Loads the full batch detail (info + documents + extract data + claims) and populates all three tabs. */
  async loadDetail(): Promise<void> {
    this.loading.set(true);
    // Single call returns everything needed for the page; tabs page client-side from it.
    const res = await this.api.request(
      'POST',
      API_ROUTES.GET_BULK_UPLOAD_BATCH_DETAIL,
      { batch_id: this.batchId() },
      { showToaster: false },
    );

    if (res?.status) {
      const d = res.data;
      this.batchInfo.set(d?.batch_information ?? {});
      this.allDocuments = d?.documents ?? [];
      this.allClaims = d?.claims ?? [];
      const extractRows = this.groupExtractRows(d?.extract_data ?? []).flat();
      this.extractGridData.set({ data: extractRows, total: extractRows.length });
      this.applyDocumentsPage();
      this.applyClaimsPage();
    }
    this.loading.set(false);
  }

  /** First non-empty value among `batch_information`'s candidate keys. */
  private pick(keys: string[]): string {
    const info = this.batchInfo();
    for (const key of keys) {
      const value = info?.[key];
      if (value !== null && value !== undefined && value !== '') return String(value);
    }
    return '';
  }

  /** Groups extract-data rows by patient name (falling back to client id), preserving first-seen order. */
  private groupExtractRows(rows: BatchExtractRow[]): ExtractDisplayRow[][] {
    const order: string[] = [];
    const groups = new Map<string, ExtractDisplayRow[]>();

    rows.forEach((row, index) => {
      // Grouped on the client id, not the name: two different clients can
      // share a name, and merging those would show one patient's providers
      // under the other's. The name is only the fallback for a row the
      // extraction could not tie to a client, and a row carrying neither gets
      // a key of its own — otherwise every unidentified row (what a failed
      // extraction produces) would collapse into a single merged block.
      const key = String(row.client_id || row.patient_name || `row-${index}`);
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push({ ...row, isGroupStart: false, groupSize: 0 });
    });

    return order.map((key) => {
      const group = groups.get(key)!;
      group[0].isGroupStart = true;
      group[0].groupSize = group.length;
      return group;
    });
  }

  // ── Paging (all three tabs page in the browser) ─────────────────────

  onDocumentsStateChange(state: DataStateChangeEvent): void {
    this.documentsState = state;
    this.applyDocumentsPage();
  }

  private applyDocumentsPage(): void {
    const skip = this.documentsState.skip ?? 0;
    const take = this.documentsState.take ?? 10;
    this.documentsGridData.set({
      data: this.allDocuments.slice(skip, skip + take),
      total: this.allDocuments.length,
    });
  }

  onClaimsStateChange(state: DataStateChangeEvent): void {
    this.claimsState = state;
    this.applyClaimsPage();
  }

  /**
   * Re-slices the Claims tab and restarts its status watch — the page it shows
   * has changed, so read the statuses straight away and then settle into the
   * normal interval.
   */
  private applyClaimsPage(): void {
    this.setClaimsPage();
    this.scheduleAiStatusRead(0);
  }

  /** The page slice alone, with no effect on the status watch. */
  private setClaimsPage(): void {
    const skip = this.claimsState.skip ?? 0;
    const take = this.claimsState.take ?? 10;
    this.claimsGridData.set({
      data: this.allClaims.slice(skip, skip + take),
      total: this.allClaims.length,
    });
  }

  // ── Row actions ─────────────────────────────────────────────────────

  /** Only a document that actually failed pages has a breakdown worth opening. */
  hasFailedPages(row: BatchDocument): boolean {
    return Number(row?.pages_failed) > 0 || !!row?.failed_pages?.length;
  }

  /** Opens the per-page failure breakdown for one document. */
  async viewFailedPages(row: BatchDocument): Promise<void> {
    const encDocId = await this.crypto.encryptId(String(row?.sr_no ?? ''));
    this.router.navigate(['/bulk-upload', this.encryptedBatchId, 'detail', 'failed-pages', encDocId]);
  }

  /** Opens the Claim Analyst detail view for one claim, using its id (or claim_id) encrypted for the URL. */
  async viewClaim(claim: BatchClaim): Promise<void> {
    const encId = await this.crypto.encryptId(String(claim?.id ?? claim?.claim_id ?? ''));
    this.router.navigate(['/claim-analyst/view', encId]);
  }

  // ── Badges ──────────────────────────────────────────────────────────

  /** True when a status value should show the failure-reason info icon. */
  isFailedStatus(status: string): boolean {
    return (status ?? '').toLowerCase() === 'failed';
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopAiStatusWatch();
  }

  // ── AI status watch (Claims tab) ──────────────────────────────────
  //
  // The batch detail response is a one-shot read, so a claim still being
  // validated would otherwise sit at "Pending" forever. /organization/claims/status
  // takes every id at once (`{ claim_ids: [...] }`), so this is one call per
  // tick covering the claims on the visible page, and none at all once they
  // have all finished.

  /** True while the AI is still working on this claim (Pending / Processing). */
  isAiInProgress(aiStatus: string | null | undefined): boolean {
    return aiStatusInProgress(aiStatus);
  }

  /** Completion percentage for a claim, clamped to 0–100 for the bar's width. */
  aiProgress(claim: BatchClaim): number {
    return aiProgressPercent(claim?.ai_processing_progress);
  }

  /** The claim's primary key — the same id `viewClaim` sends. */
  private claimKey(claim: BatchClaim): string {
    return String(claim?.id ?? claim?.claim_id ?? '');
  }

  /** Ids of the claims on the visible page that are still waiting on the AI. */
  private pendingClaimIds(): string[] {
    const ids: string[] = [];
    for (const claim of (this.claimsGridData().data as BatchClaim[]) ?? []) {
      const id = this.claimKey(claim);
      if (id && this.isAiInProgress(claim?.ai_status)) ids.push(id);
    }
    return ids;
  }

  /**
   * Arms the next status read while the page has a processing claim, and stops
   * the loop when it doesn't.
   *
   * `delayMs` only ever shortens the FIRST read after a page change; every
   * reschedule from `readAiStatus` takes the full interval, so a failing
   * request can't turn the loop into a tight retry.
   */
  private scheduleAiStatusRead(delayMs = AI_STATUS_POLL_MS): void {
    this.stopAiStatusWatch();
    if (this.destroyed || !this.pendingClaimIds().length) return;

    this.pollTimer = setTimeout(() => void this.readAiStatus(), delayMs);
  }

  /** One read covering every processing claim on the visible page. */
  private async readAiStatus(): Promise<void> {
    if (this.destroyed) return;
    this.pollTimer = null;

    // Re-read the ids rather than closing over them: the tab may have paged
    // between this timer being armed and it firing.
    const claimIds = this.pendingClaimIds();
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
    // dropped request must not end the watch.
    this.scheduleAiStatusRead();
  }

  /**
   * Merges a status response into the claims it names. The whole `allClaims`
   * list is updated (not just the visible slice) so paging away and back shows
   * the progress already known, then the current page is re-sliced from it.
   */
  private applyStatuses(statuses: any[]): void {
    const byId = new Map<string, any>();
    for (const status of statuses) {
      const id = String(status?.id ?? status?.claim_id ?? '');
      if (id) byId.set(id, status);
    }
    if (!byId.size) return;

    this.allClaims = this.allClaims.map((claim) => {
      const status = byId.get(this.claimKey(claim));
      if (!status) return claim;
      // Only the fields the status endpoint owns, so a partial response can't
      // blank out the rest of the row.
      return {
        ...claim,
        ai_status: status.ai_status ?? claim.ai_status,
        ai_processing_progress: status.ai_processing_progress ?? claim.ai_processing_progress,
        ai_processing_stage: status.ai_processing_stage ?? claim.ai_processing_stage,
        compliance_score: status.compliance_score ?? claim.compliance_score,
        review_status: status.review_status ?? claim.review_status,
      };
    });
    // Re-slice only — rescheduling is `readAiStatus`'s job.
    this.setClaimsPage();
  }

  private stopAiStatusWatch(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }
}
