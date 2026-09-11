import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CellRowspanFn, DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';
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
  compliance_score: number;
  review_status: string;
  uploaded_at: string;
}

type DetailTab = 'documents' | 'extract-data' | 'claims';

const emptyState = (): State => ({ skip: 0, take: 10, sort: [], filter: { logic: 'and', filters: [] } });

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
export class BulkUploadDetail implements OnInit {
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
  readonly batchLabel = computed(() => this.pick(['batch_code', 'batch_id']) || this.batchId());
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

    for (const row of rows) {
      const key = String(row.patient_name ?? row.client_id ?? '');
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push({ ...row, isGroupStart: false, groupSize: 0 });
    }

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

  private applyClaimsPage(): void {
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
}
