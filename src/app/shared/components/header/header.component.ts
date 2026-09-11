import {
  Component,
  ElementRef,
  Output,
  EventEmitter,
  ViewChild,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { BreadcrumbComponent } from '../breadcrumb/breadcrumb.component';
import { DeleteConfirmationComponent } from '../delete-confirmation/delete-confirmation.component';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';

/**
 * Top app bar: sidebar toggle, breadcrumb, notification bell/panel, and the
 * user menu (including logout). Owns the notification dropdown's open state
 * and click-outside/escape dismissal.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, BreadcrumbComponent, NgbTooltipModule, TimeAgoPipe],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  @Output() sidebarToggle = new EventEmitter<void>();
  @ViewChild('notificationRoot') notificationRoot?: ElementRef<HTMLElement>;
  readonly auth = inject(AuthService);
  readonly notifications = inject(NotificationService);
  private readonly modalService = inject(NgbModal);

  /**
   * The notification panel is a plain Angular-controlled overlay, not a Bootstrap
   * `data-bs-toggle="dropdown"` one. That JS-driven dropdown positions the panel
   * via Popper, and `.ma-topbar` is `position: sticky` (assets/css/style.css) —
   * Popper's `absolute` strategy computes offset against that sticky ancestor, a
   * calculation that (a) depends on the page's current scroll position and (b)
   * resolves asynchronously a beat after the panel becomes visible. Together that
   * produced the panel occasionally flashing at the wrong position/size for a
   * frame before snapping to the right spot. A plain `@if` + `position: absolute;
   * top: 100%; right: 0;` relative to the panel's own (non-sticky) wrapper is
   * synchronous, CSS-only layout math — no JS positioning step, nothing to race.
   */
  readonly notificationsOpen = signal(false);

  /** Toggles the notification panel; opening it re-fetches the list from the API. */
  toggleNotifications(): void {
    const opening = !this.notificationsOpen();
    this.notificationsOpen.set(opening);
    if (opening) {
      // Refresh notifications from the backend each time the panel is opened.
      void this.notifications.fetchList();
    }
  }

  /** Loads the next page once the list is scrolled within 40px of its bottom. */
  onNotificationListScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) {
      // Fetches the next page of notifications from the API.
      void this.notifications.loadMore();
    }
  }

  /** Closes the notification panel. */
  closeNotifications(): void {
    this.notificationsOpen.set(false);
  }

  /** Closes on any click outside the panel — mirrors the old `data-bs-auto-close="outside"`. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.notificationsOpen()) return;
    const root = this.notificationRoot?.nativeElement;
    if (root && !root.contains(event.target as Node)) {
      this.closeNotifications();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeNotifications();
  }

  /**
   * Marks the clicked notification as read (if unread) and follows its
   * redirect URL, if any.
   * @param id id of the notification that was clicked.
   */
  async onNotificationClick(id: string): Promise<void> {
    const item = this.notifications.notifications().find((n) => n.id === id);
    if (!item) return;
    // Await the read receipt before navigating — a full-page redirect right
    // after firing the PATCH would cancel it mid-flight (browser navigation
    // aborts in-flight requests), so the server might never see it as read.
    if (item.status === 'Unread') {
      await this.notifications.markAsRead(id);
    }
    if (item.redirectUrl) {
      this.closeNotifications();
      window.location.href = item.redirectUrl;
    }
  }

  /** Marks every notification as read via the API. */
  markAllAsRead(): void {
    void this.notifications.markAllAsRead();
  }

  /** Opens a confirmation modal and, if confirmed, logs the user out. */
  logout(): void {
    const modalRef = this.modalService.open(DeleteConfirmationComponent, { centered: true });
    modalRef.componentInstance.title = 'Logout';
    modalRef.componentInstance.message = 'Are you sure you want to log out of your account?';
    modalRef.componentInstance.confirmButtonText = 'Logout';
    modalRef.result.then(
      (result) => {
        if (result === 'confirmed') this.auth.logout();
      },
      () => {
        /* dismissed (backdrop / esc) — stay logged in */
      },
    );
  }
}
