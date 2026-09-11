import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';
import { FocusFirstInputDirective } from '../../../core/services/focusFirstInput.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';

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
export class ViewClaimAnalyst implements OnInit {
  /** Reviewer Actions form — POSTed to `/organization/claims/review`. */
  readonly reviewForm: FormGroup;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    public api: ApiService,
    public crypto: CryptoService,
    public fb: FormBuilder,
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
  readonly savingNotes = signal(false);
  /** Opened from the Patient Claims tab — Reviewer Actions is display-only, no edits/buttons. */
  readonly isReadOnly = signal(false);

  /** Review-status enum (`typeId: 3`) — Pending / Pass / Failed. */
  reviewStatusOptions: { label: string; value: string }[] = [];

  get f() {
    return this.reviewForm.controls;
  }

  private claimId: string | null = null;
  private encryptedClaimId: string | null = null;
  private providerId: string | null = null;
  private encryptedProviderId: string | null = null;
  private patientId: string | null = null;
  private encryptedPatientId: string | null = null;

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
      this.encryptedProviderId = providerIdParam;
      this.providerId = await this.crypto.decryptId(providerIdParam);
    }

    const patientIdParam =
      this.route.snapshot.paramMap.get('patientId') ?? this.route.parent?.snapshot.paramMap.get('patientId') ?? null;
    if (patientIdParam) {
      this.encryptedPatientId = patientIdParam;
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

    if (res?.status && res.data) {
      const claim = res.data as ClaimDetail;
      this.claim.set(claim);
      // Prefill the Reviewer Actions form with whatever the claim already has.
      this.reviewForm.patchValue({
        reviewer_notes: claim.reviewer_notes ?? '',
        review_status: claim.review_status ?? '',
      });
    }
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
   * Approve Claim stays disabled until AI validation has finished AND the
   * reviewer has made an actual decision. `Pending` is in the dropdown (the
   * enum ships it) but it isn't a decision, so it doesn't enable Approve —
   * use Save Notes to keep working on a claim that's still pending.
   */
  canApprove(): boolean {
    const status = (this.reviewForm.value.review_status ?? '').toLowerCase();
    return (
      this.isAiComplete() &&
      (status === 'pass' || status === 'failed') &&
      !this.submitting() &&
      !this.savingNotes()
    );
  }

  /**
   * Saves the notes without finalizing — keeps whatever review status the
   * claim already carries (typically `Pending`).
   */
  async saveNotes(): Promise<void> {
    if (!this.claimId || this.savingNotes() || this.f['reviewer_notes'].invalid || !this.isAiComplete())
      return;

    this.savingNotes.set(true);
    // Same review endpoint as approveClaim(), but with the claim's existing
    // status re-sent so the save doesn't change it.
    const res = await this.api.request('POST', API_ROUTES.REVIEW_CLAIM, {
      claim_id: this.claimId,
      review_status: this.claim()?.review_status ?? 'Pending',
      reviewer_notes: this.reviewForm.value.reviewer_notes?.trim() ?? '',
    });
    this.savingNotes.set(false);

    if (res?.status) await this.loadClaim();
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

  /** Discards edits and returns to the page this claim was opened from. */
  cancelReview(): void {
    if (this.encryptedProviderId) {
      this.router.navigate(['/provider-management', this.encryptedProviderId, 'patients']);
      return;
    }
    if (this.encryptedPatientId) {
      this.router.navigate(['/patient-management/profile', this.encryptedPatientId]);
      return;
    }
    this.router.navigate(['/claim-analyst']);
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
