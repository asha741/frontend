import { Pipe, PipeTransform } from '@angular/core';
import { timeAgo } from '../../core/utils/date.util';

/** Formats an ISO timestamp as a relative "time ago" string, e.g. `30 minutes ago`. */
@Pipe({ name: 'timeAgo', standalone: true })
export class TimeAgoPipe implements PipeTransform {
  /**
   * @param value ISO timestamp string (or nullish)
   * @returns human-readable relative time string, or '' if value is nullish/empty
   */
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return timeAgo(value);
  }
}
