/**
 * AI processing status — the ONE place the "still running" vocabulary and the
 * refresh cadence live.
 *
 * A claim being validated by the AI reports a percentage while it works. Both
 * the claims grid (which re-reads the list) and the claim detail page (which
 * reads `/organization/claims/status`) decide "is this still running?" and
 * "how far along?" from here, so the two can't drift apart.
 */

/**
 * How often a screen re-reads a claim that is still being processed — the
 * grid per processing row, the detail page for the claim it is showing.
 * 20 seconds is the project-wide polling cadence.
 */
export const AI_STATUS_POLL_MS = 20 * 1000;

/**
 * Statuses that mean the AI is still working. Anything else — Completed,
 * Validated, Failed — is terminal and ends the refresh loop.
 */
export const AI_IN_PROGRESS_STATUSES = ['pending', 'processing', 'in progress'];

/** True while the AI is still working on a claim with this status. */
export function isAiInProgress(aiStatus: string | null | undefined): boolean {
  return AI_IN_PROGRESS_STATUSES.includes(String(aiStatus ?? '').trim().toLowerCase());
}

/**
 * `ai_processing_progress` as a whole number clamped to 0–100 — safe to bind
 * straight to a progress bar's width, whatever the backend sends.
 */
export function aiProgressPercent(progress: unknown): number {
  const raw = Number(progress ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(100, Math.max(0, Math.round(raw)));
}
