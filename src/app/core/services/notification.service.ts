import { Injectable, Injector, signal } from '@angular/core';
import { ApiService } from './api.service';
import { API_ROUTES } from '../constants/api-routes';

export interface NotificationItem {
  id: string;
  notificationType: string;
  title: string;
  message: string;
  status: 'Read' | 'Unread';
  createdAt: string;
  redirectUrl: string | null;
}

/** Silent options for background polling — no toaster, no global loader spinner. */
const SILENT = { showToaster: false, showLoader: false };

const POLL_INTERVAL_MS = 60_000;

/** Notifications fetched per page — the panel loads this many at a time as it's scrolled. */
const PAGE_SIZE = 10;

/**
 * Owns the notification bell's state: unread count, the unread list, and the
 * per-minute count poll. `startPolling()` is called from `AuthService` on
 * login/session-restore; `stopPolling()` on logout.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  readonly notifications = signal<NotificationItem[]>([]);
  readonly unreadCount = signal(0);
  /** True only for the initial page-1 load (panel just opened). */
  readonly loading = signal(false);
  /** True while a subsequent page is loading in (scrolled to the bottom). */
  readonly loadingMore = signal(false);
  /** True once every page has been fetched — `loadMore()` becomes a no-op. */
  readonly hasMore = signal(true);

  private currentPage = 1;
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  // ApiService in turn injects AuthService, which is the service that starts/stops
  // this polling — a direct constructor injection here would create a circular
  // dependency (NG0200) when AuthService resolves this service during its own
  // construction. Resolve it lazily through the injector instead.
  constructor(private injector: Injector) {}

  private get api(): ApiService {
    return this.injector.get(ApiService);
  }

  /** Starts the per-minute unread-count poll. Idempotent — a second call while already polling is a no-op. */
  startPolling(): void {
    if (this.pollHandle) return;
    void this.fetchUnreadCount();
    this.pollHandle = setInterval(() => void this.fetchUnreadCount(), POLL_INTERVAL_MS);
  }

  /** Stops the poll and clears the in-memory notification state (called on logout). */
  stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    this.notifications.set([]);
    this.unreadCount.set(0);
  }

  /** Refreshes just the bell badge count (cheap, silent — used by the background poll). */
  async fetchUnreadCount(): Promise<void> {
    // GET the current unread notification count for the logged-in user.
    const res = await this.api.request<{ unread_count: number }>('GET', API_ROUTES.GET_NOTIFICATIONS_COUNT, null, SILENT);
    if (res?.status) {
      this.unreadCount.set(res.data?.unread_count ?? 0);
    }
  }

  /** Loads the panel's first page (latest first, per the API). Resets any prior scroll-loaded pages. */
  async fetchList(): Promise<void> {
    this.currentPage = 1;
    this.hasMore.set(true);
    this.loading.set(true);
    const res = await this.fetchPage(this.currentPage);
    if (res?.status) {
      const items = this.toItems(res.data?.items);
      this.notifications.set(items);
      this.unreadCount.set(res.data?.unread_count ?? 0);
      this.updateHasMore(items.length, res.data?.pagination);
    }
    this.loading.set(false);
  }

  /** Appends the next page as the panel is scrolled to the bottom. A no-op once `hasMore` is false. */
  async loadMore(): Promise<void> {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const nextPage = this.currentPage + 1;
    const res = await this.fetchPage(nextPage);
    if (res?.status) {
      const items = this.toItems(res.data?.items);
      this.currentPage = nextPage;
      this.notifications.update(existing => [...existing, ...items]);
      this.updateHasMore(this.notifications().length, res.data?.pagination);
    }
    this.loadingMore.set(false);
  }

  /** POSTs for one page of the notification list (paginated because GET can't carry a body here). */
  private fetchPage(page: number) {
    return this.api.request<any>('POST', API_ROUTES.GET_NOTIFICATIONS_LIST, {
      page,
      page_size: PAGE_SIZE,
    }, SILENT);
  }

  private toItems(items: any[] | undefined): NotificationItem[] {
    return (items ?? []).map(i => ({
      id: i.id,
      notificationType: i.notification_type,
      title: i.title,
      message: i.message,
      status: i.status,
      createdAt: i.created_at,
      redirectUrl: i.redirect_url ?? null,
    }));
  }

  /** A page shorter than `PAGE_SIZE`, or a total that's already all loaded, means there's nothing left. */
  private updateHasMore(loadedCount: number, pagination: { total_records?: number } | undefined): void {
    const total = pagination?.total_records;
    this.hasMore.set(total != null ? loadedCount < total : loadedCount % PAGE_SIZE === 0 && loadedCount > 0);
  }

  /** Ids currently being marked read — a Set so a second quick click on another row spinners just that row too. */
  readonly markingReadIds = signal<ReadonlySet<string>>(new Set());
  readonly markingAllRead = signal(false);

  /** Marks a single notification read, then reloads the panel's list to reflect the new status/count. */
  async markAsRead(id: string): Promise<void> {
    this.markingReadIds.update(ids => new Set(ids).add(id));
    try {
      // PATCH one notification's status to Read.
      const res = await this.api.request('PATCH', API_ROUTES.MARK_NOTIFICATION_READ, { notification_id: id }, SILENT);
      if (res?.status) {
        await this.fetchList();
      }
    } finally {
      this.markingReadIds.update(ids => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    }
  }

  /** Marks every notification read for this user, then refreshes both the list and the badge count. */
  async markAllAsRead(): Promise<void> {
    this.markingAllRead.set(true);
    try {
      // PATCH all notifications for this user to Read.
      const res = await this.api.request('PATCH', API_ROUTES.MARK_ALL_NOTIFICATIONS_READ, {}, SILENT);
      if (res?.status) {
        this.fetchList();
        this.fetchUnreadCount();
      }
    } finally {
      this.markingAllRead.set(false);
    }
  }
}
