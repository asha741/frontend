import { Component, OnDestroy, OnInit, TemplateRef, ViewChild, computed, signal } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';
import { FocusFirstInputDirective } from '../../../core/services/focusFirstInput.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';
import {
  AI_STATUS_POLL_MS,
  aiProgressPercent,
  isAiInProgress as aiStatusInProgress,
} from '../../../core/utils/ai-status.util';

interface ClaimDocument {
  category: string;
  file_name: string;
  storage_url: string;
}

interface ClaimFailedNote {
  visit_id: string;
  note_page: number;
  failed_sections: string[];
}

interface ClaimRuleResult {
  rule_id: string;
  rule_name: string;
  status: string;
  priority: string;
  failure_reason: string;
  recommendation?: string;
  failed_notes?: ClaimFailedNote[];
}

interface ClaimFlagSummary {
  high: number;
  medium: number;
  low: number;
}

interface ClaimDetail {
  claim_id: string;
  patient_name: string;
  provider_name: string;
  uploaded_at: string;
  review_status: string;
  reviewer_notes?: string;
  ai_status: string;
  /** Present while the AI is still running — see /organization/claims/status. */
  ai_processing_progress?: number;
  ai_processing_stage?: string;
  documents: ClaimDocument[];
  compliance_score: number;
  rule_results: ClaimRuleResult[];
  flag_summary: ClaimFlagSummary;
}

type TabKey = 'all' | 'high' | 'medium' | 'low';

@Component({
  selector: 'app-view-claim-analyst',
  standalone: true,
  imports: [
    BadgeClassPipe,
    DatePipe,
    UpperCasePipe,
    ReactiveFormsModule,
    EmptyStateComponent,
    MarkdownPipe,
    TrimWhitespaceDirective,
    FocusFirstInputDirective,
  ],
  templateUrl: './view-claim-analyst.html',
  styleUrl: './view-claim-analyst.scss',
})
/**
 * Claim detail / review page. Loads a single claim (resolving whether it was
 * opened from the provider, patient, or plain claim-analyst context), shows
 * its documents and rule-validation results (filterable by priority tab),
 * tracks review progress via a stepper, and lets a reviewer save notes or
 * finalize the review (Pass/Failed).
 */
export class ViewClaimAnalyst implements OnInit, OnDestroy {
  /** Reviewer Actions form — POSTed to `/organization/claims/review`. */
  readonly reviewForm: FormGroup;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    public api: ApiService,
    public crypto: CryptoService,
    public fb: FormBuilder,
    public modal: NgbModal,
  ) {
    this.reviewForm = this.fb.group({
      reviewer_notes: ['', [Validators.maxLength(1000)]],
      review_status: ['', [Validators.required]],
    });
  }

  readonly claim = signal<ClaimDetail | null>(null);
  readonly activeTab = signal<TabKey>('all');
  readonly isSubmitted = signal(false);
  readonly submitting = signal(false);
  /** Opened from the Patient Claims tab — Reviewer Actions is display-only, no edit button. */
  readonly isReadOnly = signal(false);

  /** Reviewer Actions modal — opened from the "Review Status" button beside the compliance score. */
  @ViewChild('reviewModalTpl') reviewModalTpl!: TemplateRef<unknown>;
  private reviewModalRef: NgbModalRef | null = null;

  /** Review-status enum (`typeId: 3`) — Pending / Pass / Failed. */
  reviewStatusOptions: { label: string; value: string }[] = [];

  /** The pending AI status read, or null when the claim is no longer processing. */
  private aiStatusTimer: ReturnType<typeof setTimeout> | null = null;

  /** Set on destroy so an in-flight status response is dropped instead of applied. */
  private destroyed = false;

  get f() {
    return this.reviewForm.controls;
  }

  private claimId: string | null = null;
  private encryptedClaimId: string | null = null;
  private providerId: string | null = null;
  private patientId: string | null = null;

  readonly documentGroups = computed(() => {
    const docs = this.claim()?.documents ?? [];
    const groups = new Map<string, ClaimDocument[]>();
    for (const doc of docs) {
      const key = doc.category || 'Other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(doc);
    }
    return Array.from(groups.entries()).map(([category, documents]) => ({ category, documents }));
  });

  readonly ruleCounts = computed(() => {
    const flagSummary = this.claim()?.flag_summary;
    const rules = this.claim()?.rule_results ?? [];
    return {
      all: rules.length,
      high: flagSummary?.high ?? rules.filter((r) => this.priorityOf(r) === 'high').length,
      medium: flagSummary?.medium ?? rules.filter((r) => this.priorityOf(r) === 'medium').length,
      low: flagSummary?.low ?? rules.filter((r) => this.priorityOf(r) === 'low').length,
    };
  });

  readonly filteredRules = computed(() => {
    const rules = this.claim()?.rule_results ?? [];
    const tab = this.activeTab();
    if (tab === 'all') return rules;
    return rules.filter((r) => this.priorityOf(r) === tab);
  });

  /**
   * Decrypts the claim id (and optional provider/patient context ids) from
   * the route, then loads the review-status options and the claim itself.
   * Presence of a patientId marks the page read-only (opened from the
   * Patient Claims tab, where Reviewer Actions is display-only).
   */
  async ngOnInit(): Promise<void> {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;

    this.encryptedClaimId = idParam;
    this.claimId = await this.crypto.decryptId(idParam);

    const providerIdParam = this.route.snapshot.paramMap.get('providerId');
    if (providerIdParam) {
      this.providerId = await this.crypto.decryptId(providerIdParam);
    }

    const patientIdParam =
      this.route.snapshot.paramMap.get('patientId') ?? this.route.parent?.snapshot.paramMap.get('patientId') ?? null;
    if (patientIdParam) {
      this.patientId = await this.crypto.decryptId(patientIdParam);
      this.isReadOnly.set(true);
    }

    await this.loadReviewStatusOptions();
    await this.loadClaim();
  }

  /** Review Status dropdown values come from the shared enum endpoint. */
  async loadReviewStatusOptions(): Promise<void> {
    const res = await this.api.request('POST', API_ROUTES.GET_MASTER_LIST, { typeIds: [3] }, {
      showToaster: false,
    });
    if (res?.status && Array.isArray(res.data)) {
      const reviewStatusType = res.data.find((d: any) => d.typeId === 3);
      if (reviewStatusType && Array.isArray(reviewStatusType.options)) {
        this.reviewStatusOptions = [...reviewStatusType.options];
      }
    }
  }

  /**
   * Fetches the claim detail, choosing the endpoint/body based on which
   * context the page was opened from (provider, patient, or the plain
   * claim-analyst list) since each variant scopes/authorizes the lookup
   * differently on the backend.
   */
  async loadClaim(): Promise<void> {
    if (!this.claimId) return;

    const endpoint = this.providerId
      ? API_ROUTES.GET_PROVIDER_CLAIM_DETAIL
      : this.patientId
        ? API_ROUTES.GET_PATIENT_CLAIM_DETAIL
        : API_ROUTES.GET_CLAIM_DETAIL;
    const body = this.providerId
      ? { provider_id: this.providerId, claim_id: this.claimId }
      : this.patientId
        ? { id: this.patientId, claim_id: this.claimId }
        : { claim_id: this.claimId };

    // Returns the full claim: documents, rule results, flag summary, review state.
    const res = await this.api.request('POST', endpoint, body, { showToaster: false });

    if (this.destroyed) return;

    if (res?.status && res.data) {
      const claim = res.data as ClaimDetail;
      this.claim.set(claim);
      // Prefill the Reviewer Actions form with whatever the claim already has.
      this.reviewForm.patchValue({
        reviewer_notes: claim.reviewer_notes ?? '',
        review_status: claim.review_status ?? '',
      });
    }

    // A claim that is still being validated keeps watching itself; one that
    // isn't costs nothing. The detail payload may not carry a percentage —
    // when it doesn't, read once straight away so the bar shows a real number
    // instead of 0% until the next read.
    this.scheduleAiStatusRead(
      typeof this.claim()?.ai_processing_progress === 'number' ? AI_STATUS_POLL_MS : 0,
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopAiStatusWatch();
  }

  // ── AI status watch ───────────────────────────────────────────────
  //
  // While the AI is still validating, the detail page reads
  // /organization/claims/status every 20 seconds: a small response carrying
  // just the progress, so the page can show how far along the claim is
  // without re-fetching its documents and rule results each time. The
  // endpoint is batched (`{ claim_ids: [...] }` → one row per claim), so this
  // page sends a one-element list and reads the row back out.

  /** True while the AI is still working on this claim. */
  isAiInProgress(): boolean {
    return aiStatusInProgress(this.claim()?.ai_status);
  }

  /** Completion percentage, clamped to 0–100 for the progress bar's width. */
  aiProgress(): number {
    return aiProgressPercent(this.claim()?.ai_processing_progress);
  }

  /**
   * Arms the next status read while the claim is processing, and stops the
   * loop once it isn't. Called after every claim load, so a reload (Save
   * Notes, Approve) replaces the pending timer instead of stacking another.
   *
   * `delayMs` only ever shortens the FIRST read after a load — every
   * reschedule from `readAiStatus` takes the full interval, so a failing
   * request can't turn the loop into a tight retry.
   */
  private scheduleAiStatusRead(delayMs = AI_STATUS_POLL_MS): void {
    this.stopAiStatusWatch();
    if (this.destroyed || !this.claimId || !this.isAiInProgress()) return;

    this.aiStatusTimer = setTimeout(() => void this.readAiStatus(), delayMs);
  }

  /**
   * One status read. Merges the progress into the claim, then either arms the
   * next read or — once the AI has finished — reloads the full claim, since
   * the rule results and flag summary only arrive on the detail endpoint.
   */
  private async readAiStatus(): Promise<void> {
    if (this.destroyed || !this.claimId) return;
    this.aiStatusTimer = null;

    // Silent: this runs on a timer, so no global loader and no toaster.
    const res = await this.api.request(
      'POST',
      API_ROUTES.GET_CLAIM_STATUS,
      { claim_ids: [this.claimId] },
      { showToaster: false, showLoader: false },
    );
    if (this.destroyed) return;

    const status = this.statusFor(res?.data, this.claimId);
    if (res?.status && status) {
      const current = this.claim();
      if (current) {
        // Only the fields the status endpoint owns — a partial response must
        // not blank out the documents or rule results already on screen.
        this.claim.set({
          ...current,
          ai_status: status.ai_status ?? current.ai_status,
          ai_processing_progress: status.ai_processing_progress ?? current.ai_processing_progress,
          ai_processing_stage: status.ai_processing_stage ?? current.ai_processing_stage,
          compliance_score: status.compliance_score ?? current.compliance_score,
          review_status: status.review_status ?? current.review_status,
        });
      }

      if (!aiStatusInProgress(status.ai_status)) {
        // Finished — pull the full claim so the rule results, flag summary and
        // reviewer actions reflect the completed run.
        await this.loadClaim();
        return;
      }
    }

    // A failed read is treated as "still processing" — one dropped request
    // must not end the watch on a claim that is genuinely still running.
    this.scheduleAiStatusRead();
  }

  /**
   * This claim's row out of a batched status response. The list is keyed by
   * claim id, but a single-id request can only be about this claim — so an
   * unkeyed or differently-keyed row is still accepted when it's the only one.
   */
  private statusFor(data: any, claimId: string | null): any {
    if (!data) return null;
    const rows = Array.isArray(data) ? data : [data];
    if (!rows.length) return null;
    const match = rows.find((row) => String(row?.id ?? row?.claim_id ?? '') === String(claimId));
    return match ?? (rows.length === 1 ? rows[0] : null);
  }

  private stopAiStatusWatch(): void {
    if (this.aiStatusTimer) clearTimeout(this.aiStatusTimer);
    this.aiStatusTimer = null;
  }

  /** Switches the rule-results filter tab (all/high/medium/low). */
  setActiveTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }

  /** Normalizes a rule's priority string for tab matching/counting. */
  priorityOf(rule: ClaimRuleResult): TabKey | 'all' {
    return (rule.priority ?? '').toLowerCase() as TabKey;
  }

  /**
   * Maps the claim's AI/review status to a 0-based index into the progress
   * stepper (which step should currently be ticked as complete).
   */
  stepIndex(): number {
    const ai = (this.claim()?.ai_status ?? '').toLowerCase();
    const review = (this.claim()?.review_status ?? '').toLowerCase();
    
    // If review is completed (pass/fail), return 5 to tick "Reviewer Pending" (Step 4)
    if (review === 'pass' || review === 'failed') return 5;
    
    // If AI is completed, return 4 to tick "AI Validated" (Step 3)
    if (ai === 'completed' || ai === 'validated' || ai === 'failed') return 4;
    
    // Otherwise return 3 (AI Validated is pending, so it gets no tick)
    return 3;
  }

  isAiFailed(): boolean {
    return (this.claim()?.ai_status ?? '').toLowerCase() === 'failed';
  }

  isReviewFailed(): boolean {
    return (this.claim()?.review_status ?? '').toLowerCase() === 'failed';
  }

  isReviewPassed(): boolean {
    return (this.claim()?.review_status ?? '').toLowerCase() === 'pass';
  }

  /**
   * Once a reviewer has finalized a claim (Pass/Failed), `Pending` is no
   * longer a valid choice — hide it from the dropdown so it can't be
   * re-selected.
   */
  get visibleReviewStatusOptions(): { label: string; value: string }[] {
    if (!this.isReviewPassed() && !this.isReviewFailed()) return this.reviewStatusOptions;
    return this.reviewStatusOptions.filter(option => option.value.toLowerCase() !== 'pending');
  }

  /** AI has finished with this claim (either outcome) — a decision can be made. */
  isAiComplete(): boolean {
    const ai = (this.claim()?.ai_status ?? '').toLowerCase();
    return ai === 'validated' || ai === 'failed';
  }

  /**
   * Save stays disabled until AI validation has finished AND the reviewer
   * has made an actual decision. `Pending` is in the dropdown (the enum
   * ships it) but it isn't a decision, so it doesn't enable Save.
   */
  canApprove(): boolean {
    const status = (this.reviewForm.value.review_status ?? '').toLowerCase();
    return (
      this.isAiComplete() &&
      (status === 'pass' || status === 'failed') &&
      !this.submitting()
    );
  }

  /** Opens the Reviewer Actions modal, prefilled from the current form state. */
  openReviewModal(): void {
    this.isSubmitted.set(false);
    this.reviewModalRef = this.modal.open(this.reviewModalTpl, { centered: true });
  }

  closeReviewModal(): void {
    this.reviewModalRef?.dismiss('canceled');
    this.reviewModalRef = null;
  }

  /** Save button in the Reviewer Actions modal — finalizes the review, closing the modal on success. */
  async submitReview(): Promise<void> {
    await this.approveClaim();
    // approveClaim() resets isSubmitted back to false only once it succeeds —
    // on a validation failure it stays true so the modal's errors stay visible.
    if (!this.isSubmitted()) {
      this.reviewModalRef?.close('saved');
      this.reviewModalRef = null;
    }
  }

  /**
   * Finalizes the review — POST /organization/claims/review
   * { claim_id, review_status, reviewer_notes }.
   */
  async approveClaim(): Promise<void> {
    this.isSubmitted.set(true);
    if (this.reviewForm.invalid || !this.claimId || !this.canApprove()) return;

    this.submitting.set(true);
    const res = await this.api.request('POST', API_ROUTES.REVIEW_CLAIM, {
      claim_id: this.claimId,
      review_status: this.reviewForm.value.review_status,
      reviewer_notes: this.reviewForm.value.reviewer_notes?.trim() ?? '',
    });
    this.submitting.set(false);

    if (res?.status) {
      this.isSubmitted.set(false);
      // Re-read the claim so the stepper / badges reflect the new review status.
      await this.loadClaim();
    }
  }

  /** storage_url of whichever document is currently being fetched — drives the per-row spinner. */
  readonly downloadingUrl = signal<string | null>(null);

  isDownloading(doc: ClaimDocument): boolean {
    return this.downloadingUrl() === doc.storage_url;
  }

  /** Fetches the document as a blob and saves it — avoids `target="_blank"` opening a blank tab for non-renderable types like .docx. */
  async downloadDocument(doc: ClaimDocument): Promise<void> {
    if (!doc.storage_url || this.downloadingUrl()) return;
    this.downloadingUrl.set(doc.storage_url);
    try {
      // Fetches the document blob directly from storage (not via the API service).
      const response = await fetch(doc.storage_url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = doc.file_name || 'document';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }, 100);
    } finally {
      this.downloadingUrl.set(null);
    }
  }

  /** Navigates to the failed-notes drill-down for a specific rule. */
  async viewFailedNotes(ruleId: string): Promise<void> {
    if (!this.encryptedClaimId) return;
    const encRuleId = await this.crypto.encryptId(ruleId);
    this.router.navigate(['/claim-analyst/view', this.encryptedClaimId, 'failed-notes', encRuleId]);
  }
}
