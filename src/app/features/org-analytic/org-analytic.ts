import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { factories, models, service } from 'powerbi-client';

import { ApiService } from '../../core/services/api.service';
import { API_ROUTES } from '../../core/constants/api-routes';
import { LoaderComponent } from '../../shared/components/loader/loader.component';

/** The dashboard types the embed endpoint accepts. */
export const ORG_ANALYTIC_TYPES = ['organization', 'client', 'employee', 'supervisor'] as const;

export type OrgAnalyticType = (typeof ORG_ANALYTIC_TYPES)[number];

/** Narrows the route's `data.dashboardType` to one of the four accepted types. */
const isAnalyticType = (value: unknown): value is OrgAnalyticType =>
  typeof value === 'string' && (ORG_ANALYTIC_TYPES as readonly string[]).includes(value);

/** Heading shown when a route somehow omits its own `data.title`. */
const DEFAULT_TITLE = 'Org Analytic Dashboard';

/**
 * Floor for the report box. Below this the report is unreadable anyway, so a
 * very short viewport (a phone in landscape) is allowed to scroll rather than
 * be handed a sliver of a report.
 */
const MIN_REPORT_HEIGHT = 320;


/**
 * Org Analytic — renders one embedded Power BI report.
 *
 * POST /organization/powerbi/embed-info  { dashboard_type }
 *   -> { accessToken, embedToken, embedUrl, reportId }
 *
 * Mounted as a child of the Dashboard, Patient, Provider and Claim Analyst
 * routes (e.g. /patient-management/org-analytic), each supplying its own
 * `data.dashboardType`. Nesting is what lets the shared breadcrumb build a real
 * trail — it walks the route tree collecting `data.title` per level.
 *
 * An embed token can't ride on an iframe URL, so the config is handed to the
 * report through Power BI's JS API (`powerbi-client`) against the host element.
 */
@Component({
  selector: 'app-org-analytic',
  standalone: true,
  imports: [LoaderComponent],
  templateUrl: './org-analytic.html',
  styleUrl: './org-analytic.scss',
})
export class OrgAnalytic implements AfterViewInit, OnDestroy {
  constructor(public api: ApiService, public route: ActivatedRoute) {}

  /** The div the Power BI report is embedded into. */
  @ViewChild('reportHost') reportHost?: ElementRef<HTMLDivElement>;

  /** The card wrapping the report — sized to whatever the shell leaves over. */
  @ViewChild('reportCard') reportCard?: ElementRef<HTMLElement>;

  /** Card height in px; 0 until the first measurement, which unsets the style. */
  readonly reportHeight = signal(0);

  readonly loading = signal(false);
  readonly title = signal(DEFAULT_TITLE);
  /** Set only when the report could not be shown, so the page says why. */
  readonly errorMessage = signal('');

  /**
   * One Power BI service instance for this page. Created lazily in
   * `ngAfterViewInit` so nothing touches `window` before the view exists.
   */
  private powerbi: service.Service | null = null;

  /**
   * Watches the card's own box, not just the window. `FitToWidth` only
   * recalculates on a real `window` resize event, but the card can change
   * width for reasons that never fire one — the route-change/sidebar
   * transition still settling right after navigation, a breadcrumb wrapping
   * to a second line, a scrollbar appearing. Without this, the report embeds
   * at whatever (too-narrow) width the card had at that first, unsettled
   * moment and is then stuck there until something happens to fire a real
   * window resize — which a full page reload masks, since by the time Angular
   * re-mounts there's no transition in flight and the card is already at its
   * final size.
   */
  private resizeObserver: ResizeObserver | null = null;

  /**
   * Embedding needs the host element, so this runs after the view initialises
   * rather than in `ngOnInit`.
   */
  async ngAfterViewInit(): Promise<void> {
    // Size the card before embedding, so the report is laid out once at its
    // final size instead of being re-fitted after the fact.
    this.sizeReport();

    const card = this.reportCard?.nativeElement;
    if (card) {
      this.resizeObserver = new ResizeObserver(() => this.onCardResize());
      this.resizeObserver.observe(card);
    }

    // Heading comes from the route's own `data.title` — the same value the
    // breadcrumb renders as the last crumb — so the two can never drift apart.
    this.title.set(this.route.snapshot.data['title'] || DEFAULT_TITLE);

    const type = this.route.snapshot.data['dashboardType'];
    if (!isAnalyticType(type)) {
      this.errorMessage.set('This analytics dashboard is not available.');
      return;
    }
    await this.loadReport(type);
  }

  /** Re-fits the report when the viewport changes — rotation, resize, zoom. */
  @HostListener('window:resize')
  onWindowResize(): void {
    this.sizeReport();
  }

  /**
   * Fires on every real change to the card's own box — including the initial
   * one right after mount, once the surrounding layout finishes settling.
   * Re-measures the card height and nudges Power BI (which only listens for
   * `window` resizes) into recomputing `FitToWidth` against the card's actual
   * current width.
   */
  private onCardResize(): void {
    this.sizeReport();
    window.dispatchEvent(new Event('resize'));
  }

  /**
   * Gives the card exactly the height left between its own top and the bottom
   * of the viewport, so the page itself fills one screen and never scrolls.
   *
   * The report fills that box's full width (see the embed settings below) and
   * scrolls within itself when it is taller than the box. That is deliberate:
   * letting the card grow past the viewport instead would put the page's own
   * scrollbar behind the iframe, which swallows the wheel — the bottom of a
   * tall report becomes unreachable.
   *
   * Both figures are measured rather than hard-coded: the card's top already
   * accounts for the sticky topbar, the page heading and the mobile-only
   * breadcrumb (which can wrap to a second line), and the gutter is the shell's
   * own bottom padding, which changes at a breakpoint.
   */
  private sizeReport(): void {
    const card = this.reportCard?.nativeElement;
    if (!card) return;

    // Document-relative, so a scrolled page still measures the same.
    const top = card.getBoundingClientRect().top + window.scrollY;
    const content = card.closest('.ma-content');
    const gutter = content ? parseFloat(getComputedStyle(content).paddingBottom) || 0 : 0;

    this.reportHeight.set(Math.max(window.innerHeight - top - gutter, MIN_REPORT_HEIGHT));
  }

  /** Fetches the embed config for `type` and hands it to the Power BI client. */
  async loadReport(type: OrgAnalyticType): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      // Toaster off: this fires on page load, so a failure belongs in the page
      // itself rather than as a popup. The backend's own message is still what
      // gets shown — it's read off the response into `errorMessage` below.
      const res = await this.api.request(
        'POST',
        API_ROUTES.GET_POWERBI_EMBED_INFO,
        { dashboard_type: type },
        { showToaster: false },
      );
      if (!res?.status) {
        this.errorMessage.set(res?.message ?? '');
        return;
      }

      const config = res.data;
      const host = this.reportHost?.nativeElement;
      if (!host || !config?.embedUrl || !config?.reportId) {
        this.errorMessage.set(res?.message ?? '');
        return;
      }

      this.powerbi ??= new service.Service(
        factories.hpmFactory,
        factories.wpmpFactory,
        factories.routerFactory,
      );
      // Reset first so a re-entry doesn't stack a second report on the host.
      this.powerbi.reset(host);
      this.powerbi.embed(host, {
        type: 'report',
        id: config.reportId,
        embedUrl: config.embedUrl,
        // `embedToken` is the report-scoped token; `accessToken` is the AAD one
        // and is not what an Embed-type config expects.
        accessToken: config.embedToken,
        tokenType: models.TokenType.Embed,
        settings: {
          panes: { filters: { visible: false }, pageNavigation: { visible: true } },
          background: models.BackgroundType.Transparent,
          // FitToWidth makes the report use the card's full width, rather than
          // being scaled down to fit the height with white gutters either side.
          layoutType: models.LayoutType.Custom,
          customLayout: { displayOption: models.DisplayOption.FitToWidth },
        },
      });
    } finally {
      this.loading.set(false);
    }
  }

  /** Tears the report down so its iframe and listeners don't outlive the page. */
  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    const host = this.reportHost?.nativeElement;
    if (this.powerbi && host) this.powerbi.reset(host);
  }
}
