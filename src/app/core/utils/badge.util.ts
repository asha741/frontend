/**
 * Badge / chip colour lookup — the ONE place a value → badge class mapping lives.
 *
 * Templates never hard-code a `ma-badge--*` modifier. They pipe the raw value
 * through the `badgeClass` pipe (`shared/pipes/badge-class.pipe.ts`), which
 * calls `getBadgeClass()` below:
 *
 *   <span class="ma-badge" [class]="row.status | badgeClass">{{ row.status }}</span>
 *   <span class="ma-badge" [class]="rule.priority | badgeClass: 'priority'">…</span>
 *
 * To recolour a value — or to colour a new one — add it to the arrays here and
 * every grid, card and detail page in the portal picks the change up.
 */

/** Every badge modifier the stylesheet ships (`assets/sass/components/_badges.scss`). */
export const BADGE_CLASS = {
  active: 'ma-badge--active',
  inactive: 'ma-badge--inactive',
  success: 'ma-badge--success',
  accepted: 'ma-badge--accepted',
  warning: 'ma-badge--warning',
  danger: 'ma-badge--danger',
  primary: 'ma-badge--primary',
  admin: 'ma-badge--admin',
} as const;

/** Shown when a value matches nothing in its group. */
export const BADGE_FALLBACK = BADGE_CLASS.primary;

/** One colour and the values that earn it. `match: 'includes'` does a substring test. */
export interface BadgeRule {
  cls: string;
  values: string[];
  match?: 'exact' | 'includes';
}

/** A numeric band (e.g. a pass-rate percentage): the first `min` the value clears wins. */
export interface BadgeRange {
  cls: string;
  min: number;
}

/** Which set of rules to look the value up in. */
export type BadgeGroup =
  'status' | 'organization' | 'invitation' | 'priority' | 'action' | 'flag' | 'passRate';

/**
 * The common statuses — record, batch, document, claim, user, AI and review
 * statuses all resolve here. Rules are read top to bottom; the first hit wins.
 */
const STATUS_RULES: BadgeRule[] = [
  { cls: BADGE_CLASS.active, values: ['active', 'enabled'] },
  { cls: BADGE_CLASS.inactive, values: ['inactive', 'disabled', 'deleted', 'expired', 'archived'] },
  {
    cls: BADGE_CLASS.success,
    values: [
      'completed',
      'validated',
      'verified',
      'pass',
      'passed',
      'paid',
      'success',
      'approved',
      'valid',
      'acceptable',
      'travel time is acceptable',
    ],
  },
  { cls: BADGE_CLASS.accepted, values: ['accepted', 'recovered'] },
  {
    cls: BADGE_CLASS.warning,
    values: [
      'pending',
      'pending verification',
      'processing',
      'in progress',
      'in review',
      'locked',
      'partial',
      'on hold',
      'warning',
    ],
  },
  {
    cls: BADGE_CLASS.danger,
    values: ['failed', 'fail', 'denied', 'rejected', 'error', 'cancelled', 'canceled', 'not acceptable', 'invalid travel time'],
  },
  { cls: BADGE_CLASS.primary, values: ['invited', 'provisioning', 'draft', 'new', 'not started'] },
];

/**
 * Organization provisioning: a failed or pending run is retried by the platform,
 * so it reads amber rather than red. Everything else falls through to the
 * common statuses.
 */
const ORGANIZATION_RULES: BadgeRule[] = [
  { cls: BADGE_CLASS.warning, values: ['failed', 'pending'] },
  ...STATUS_RULES,
];

/** Invitation lifecycle — an expired invite is spent, not an error. */
const INVITATION_RULES: BadgeRule[] = [
  { cls: BADGE_CLASS.accepted, values: ['accepted'] },
  { cls: BADGE_CLASS.inactive, values: ['expired', 'revoked', 'cancelled'] },
  { cls: BADGE_CLASS.warning, values: ['pending', 'invited', 'sent', 'resent'] },
];

/** Rule / finding priority. */
const PRIORITY_RULES: BadgeRule[] = [
  { cls: BADGE_CLASS.danger, values: ['high', 'critical', 'urgent'] },
  { cls: BADGE_CLASS.warning, values: ['medium', 'moderate'] },
  { cls: BADGE_CLASS.success, values: ['low', 'minor'] },
];

/** Audit-log actions arrive as free text ("User Created"), so these match on substrings. */
const ACTION_RULES: BadgeRule[] = [
  { cls: BADGE_CLASS.accepted, values: ['create', 'success'], match: 'includes' },
  { cls: BADGE_CLASS.warning, values: ['update'], match: 'includes' },
  { cls: BADGE_CLASS.danger, values: ['delete', 'fail'], match: 'includes' },
  { cls: BADGE_CLASS.primary, values: ['login', 'logout'], match: 'includes' },
];

/** Flagged / not flagged — accepts a boolean straight from the row. */
const FLAG_RULES: BadgeRule[] = [
  { cls: BADGE_CLASS.danger, values: ['true', 'flagged', 'yes'] },
  { cls: BADGE_CLASS.success, values: ['false', 'clean', 'no'] },
];

/** Pass-rate colour bands, matching the report design. */
const PASS_RATE_RANGES: BadgeRange[] = [
  { cls: BADGE_CLASS.success, min: 80 },
  { cls: BADGE_CLASS.warning, min: 50 },
  { cls: BADGE_CLASS.danger, min: 0 },
];

/** Value-based groups. */
export const BADGE_GROUPS: Record<string, BadgeRule[]> = {
  status: STATUS_RULES,
  organization: ORGANIZATION_RULES,
  invitation: INVITATION_RULES,
  priority: PRIORITY_RULES,
  action: ACTION_RULES,
  flag: FLAG_RULES,
};

/** Number-based groups — checked before the value groups. */
export const BADGE_RANGES: Record<string, BadgeRange[]> = {
  passRate: PASS_RATE_RANGES,
};

/** Per-group fallback for an empty / unknown value; defaults to `BADGE_FALLBACK`. */
export const BADGE_GROUP_FALLBACK: Record<string, string> = {
  flag: BADGE_CLASS.success,
};

/**
 * Resolves a value to its badge modifier class.
 *
 * @param value Raw cell value — string, number, boolean or null; case is ignored.
 * @param group Which rule set to search. Defaults to the common statuses.
 */
export function getBadgeClass(value: unknown, group: BadgeGroup = 'status'): string {
  const fallback = BADGE_GROUP_FALLBACK[group] ?? BADGE_FALLBACK;

  const ranges = BADGE_RANGES[group];
  if (ranges) {
    const num = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    if (!Number.isFinite(num)) return fallback;
    return ranges.find((range) => num >= range.min)?.cls ?? fallback;
  }

  const val = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!val) return fallback;

  const rules = BADGE_GROUPS[group] ?? STATUS_RULES;
  const hit = rules.find((rule) =>
    rule.match === 'includes'
      ? rule.values.some((v) => val.includes(v))
      : rule.values.includes(val),
  );

  return hit?.cls ?? fallback;
}
