import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

/** The viewer's IANA timezone (e.g. 'Asia/Kolkata'), for endpoints that convert timestamps server-side. */
export function getViewerTimezone(): string {
  return dayjs.tz.guess();
}

/**
 * Formats an ISO timestamp as a relative "time ago" string (e.g. "30 minutes ago").
 * Returns an empty string if the input is invalid.
 */
export function timeAgo(isoStr: string): string {
  const d = dayjs(isoStr);
  return d.isValid() ? d.fromNow() : '';
}

/**
 * Converts a YYYY-MM-DD date string to a start-of-day ISO string, anchored to
 * the viewer's browser timezone (e.g. Asia/Kolkata for an India-based user)
 * rather than UTC, then expressed in UTC for the backend.
 * e.g. '2026-07-08' in Asia/Kolkata → '2026-07-07T18:30:00.000Z'
 * Returns an empty string if the input is invalid.
 */
export function toISOStartOfDay(dateStr: string): string {
  const d = dayjs.tz(dateStr, getViewerTimezone()).startOf('day');
  return d.isValid() ? d.toISOString() : '';
}

/**
 * Converts a YYYY-MM-DD date string to an end-of-day ISO string, anchored to
 * the viewer's browser timezone (e.g. Asia/Kolkata for an India-based user)
 * rather than UTC, then expressed in UTC for the backend.
 * e.g. '2026-07-08' in Asia/Kolkata → '2026-07-08T18:29:59.999Z'
 * Returns an empty string if the input is invalid.
 */
export function toISOEndOfDay(dateStr: string): string {
  const d = dayjs.tz(dateStr, getViewerTimezone()).endOf('day');
  return d.isValid() ? d.toISOString() : '';
}
