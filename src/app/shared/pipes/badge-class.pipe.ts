import { Pipe, PipeTransform } from '@angular/core';

import { BadgeGroup, getBadgeClass } from '../../core/utils/badge.util';

/**
 * Resolves a value to its `ma-badge--*` modifier class through the shared
 * lookup in `core/utils/badge.util.ts` — the single place badge colours live.
 *
 *   <span class="ma-badge" [class]="row.status | badgeClass">{{ row.status }}</span>
 *   <span class="ma-badge" [class]="rule.priority | badgeClass: 'priority'">…</span>
 */
@Pipe({ name: 'badgeClass', standalone: true })
export class BadgeClassPipe implements PipeTransform {
  /**
   * @param value the raw status/priority/etc. value to map to a badge class
   * @param group which lookup table in `badge.util.ts` to use (defaults to 'status')
   * @returns the resolved `ma-badge--*` CSS modifier class
   */
  transform(value: unknown, group: BadgeGroup = 'status'): string {
    return getBadgeClass(value, group);
  }
}
