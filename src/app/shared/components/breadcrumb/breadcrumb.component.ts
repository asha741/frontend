import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';

import { BreadcrumbService } from '../../../core/services/breadcrumb.service';

interface Crumb {
  label: string;
  url: string;
}

/**
 * Auto-generated breadcrumb built from the router tree using each route's
 * `data.title` / `data.subtitle`. A fixed "Agency Admin" root crumb is always
 * prepended. Rendered in the topbar on desktop and at the top of the page
 * content below $lg (see admin-layout.component.html).
 *
 * A page whose real name is only known after a fetch can replace its own crumb
 * text through `BreadcrumbService` — see that service.
 */
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.scss',
})
export class BreadcrumbComponent {
  constructor(
    public router: Router,
    public activatedRoute: ActivatedRoute,
    public crumbLabels: BreadcrumbService,
  ) {
    // Rebuild the trail on every completed navigation, and once up front so
    // the breadcrumb is correct on initial load (before any NavigationEnd fires).
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.rebuild());
    this.rebuild();
  }

  /** The trail exactly as the route tree describes it, before relabelling. */
  private readonly routeTrail = signal<Crumb[]>([]);
  readonly subTitle = signal('');

  /** The route trail with the fixed root crumb and any page overrides applied. */
  readonly breadcrumbs = computed<Crumb[]>(() => {
    const overrides = this.crumbLabels.labels();
    return [
      { label: 'Agency Admin', url: '/dashboard' },
      ...this.routeTrail().map((crumb) => ({
        ...crumb,
        label: overrides[crumb.url] ?? crumb.label,
      })),
    ];
  });

  /**
   * Walks the activated route tree from the root, accumulating a crumb for
   * every child route whose data carries a `title`, and building up the URL
   * segment by segment as it descends. Re-run on every navigation.
   */
  private rebuild(): void {
    const trail: Crumb[] = [];
    let subtitle = '';

    // Recursively descends the route tree; `url` accumulates the path so far.
    const walk = (route: ActivatedRoute, url: string): void => {
      for (const child of route.children ?? []) {
        const snapshot = child.snapshot;
        if (!snapshot) continue; // route tree may still be activating on first construction
        const segment = snapshot.url.map((s) => s.path).join('/');
        const nextUrl = segment ? `${url}/${segment}` : url;
        const title = snapshot.data['title'];
        const sub = snapshot.data['subtitle'];
        // Skip routes without a title, and de-dupe by URL (e.g. parent/child
        // routes that resolve to the same path shouldn't produce two crumbs).
        if (title && trail.findIndex((c) => c.url === nextUrl) === -1) {
          trail.push({ label: title, url: nextUrl });
          if (sub) subtitle = sub;
        }
        walk(child, nextUrl);
      }
    };

    walk(this.activatedRoute.root, '');

    this.routeTrail.set(trail);
    this.subTitle.set(subtitle);
  }
}
