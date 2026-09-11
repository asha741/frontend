import { Component, HostListener, computed, effect, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, BreadcrumbComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
/**
 * Root layout shell for the admin panel: composes the sidebar, header, and
 * routed page content, and manages responsive sidebar behavior (a
 * collapsible icon rail on desktop vs. a slide-in drawer on mobile).
 */
export class AdminLayoutComponent {
  /** Below this width the sidebar behaves as a mobile slide-in drawer. */
  private static readonly DESKTOP_MIN = 1200;

  private readonly isDesktop = signal(this.matchesDesktop());
  private readonly collapsed = signal(false); // desktop: icon-only rail
  private readonly mobileOpen = signal(false); // mobile: slide-in drawer

  // Drive the classes that style.css expects on `.ma-dashboard`.
  readonly sidebarCollapsed = computed(() => this.isDesktop() && this.collapsed());
  readonly sidebarOpen = computed(() => !this.isDesktop() && this.mobileOpen());

  constructor() {
    // Lock background scroll while the mobile drawer is open.
    effect(() => {
      document.body.classList.toggle('ma-sidebar-open-body', this.sidebarOpen());
    });
  }

  /**
   * Re-evaluates the desktop/mobile breakpoint on viewport resize and keeps
   * the mobile drawer from staying open once the layout switches to desktop.
   */
  @HostListener('window:resize')
  onResize(): void {
    const desktop = this.matchesDesktop();
    this.isDesktop.set(desktop);
    if (desktop) {
      this.mobileOpen.set(false); // drop the mobile drawer when moving to desktop
    }
  }

  /** Header toggle button: collapse the rail on desktop, open the drawer on mobile. */
  toggleSidebar(): void {
    if (this.isDesktop()) {
      this.collapsed.update((v) => !v);
    } else {
      this.mobileOpen.update((v) => !v);
    }
  }

  /** Close button / overlay / nav-link tap: only relevant to the mobile drawer. */
  closeSidebar(): void {
    this.mobileOpen.set(false);
  }

  /** Whether the current viewport width qualifies as the desktop layout. */
  private matchesDesktop(): boolean {
    return window.innerWidth >= AdminLayoutComponent.DESKTOP_MIN;
  }
}
