import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UpperCasePipe } from '@angular/common';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import { BadgeClassPipe } from '../../../shared/pipes/badge-class.pipe';

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

interface ClaimDetail {
  claim_id: string;
  rule_results: ClaimRuleResult[];
}

@Component({
  selector: 'app-failed-notes',
  standalone: true,
  imports: [BadgeClassPipe, NgbTooltipModule, UpperCasePipe, MarkdownPipe],
  templateUrl: './failed-notes.html',
  styleUrl: './failed-notes.scss',
})
/**
 * Detail page shown when drilling into a single validation rule's failed
 * notes from a claim. Decrypts the claim/rule ids from the route, fetches
 * the full claim detail, and picks out the matching rule's failed notes.
 */
export class FailedNotes implements OnInit {
  constructor(
    private route: ActivatedRoute,
    public api: ApiService,
    public crypto: CryptoService,
  ) {}

  readonly rule = signal<ClaimRuleResult | null>(null);

  readonly failedNotes = computed(() => this.rule()?.failed_notes ?? []);

  private claimId: string | null = null;
  private ruleId: string | null = null;

  /** Decrypts the claim/rule ids from the route params, then loads the notes. */
  async ngOnInit(): Promise<void> {
    const idParam = this.route.snapshot.paramMap.get('id');
    const ruleIdParam = this.route.snapshot.paramMap.get('ruleId');
    if (!idParam || !ruleIdParam) return;

    this.claimId = await this.crypto.decryptId(idParam);
    this.ruleId = await this.crypto.decryptId(ruleIdParam);
    await this.loadFailedNotes();
  }

  /**
   * Fetches the full claim detail (including all rule results) and picks out
   * the one matching `ruleId` — the API has no per-rule fetch endpoint, so
   * the whole claim is loaded and filtered client-side.
   */
  async loadFailedNotes(): Promise<void> {
    if (!this.claimId) return;

    // Returns the full claim, including every rule's results.
    const res = await this.api.request(
      'POST',
      API_ROUTES.GET_CLAIM_DETAIL,
      { claim_id: this.claimId },
      { showToaster: false },
    );

    if (res?.status && res.data) {
      const claim = res.data as ClaimDetail;
      const rule = claim.rule_results?.find((r) => r.rule_id === this.ruleId) ?? null;
      this.rule.set(rule);
    }
  }
}
