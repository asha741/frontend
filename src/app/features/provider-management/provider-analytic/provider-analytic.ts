import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { factories, models, service } from 'powerbi-client';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { CryptoService } from '../../../core/services/crypto.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';

/** Heading shown while the provider's name hasn't loaded yet, or on a bad param. */
const DEFAULT_TITLE = 'Provider Analytics';

/**
 * Floor for the report box. Below this the report is unreadable anyway, so a
 * very short viewport (a phone in landscape) is allowed to scroll rather than
 * be handed a sliver of a report.
 */
const MIN_REPORT_HEIGHT = 320;

/**
 * Provider Analytic — renders one embedded Power BI report scoped to a single
 * provider, reached by clicking a provider's name in the Provider Management
 * grid.
 *
 * POST /organization/providers/powerbi-embed  { provider_id }
 *   -> { accessToken, embedToken, embedUrl, reportId }
 *
 * Sibling of `OrgAnalytic` (organization-wide) and `PatientAnalytic`
 * (patient-scoped); this one reads the `:providerId` route param — the
 * business `provider_id`, not the internal `id` guid — and asks the backend
 * for that one provider's report.
 *
 * An embed token can't ride on an iframe URL, so the config is handed to the
 * report through Power BI's JS API (`powerbi-client`) against the host element.
 */
@Component({
  selector: 'app-provider-analytic',
  standalone: true,
  imports: [LoaderComponent],
  templateUrl: './provider-analytic.html',
  styleUrl: './provider-analytic.scss',
})
export class ProviderAnalytic implements AfterViewInit, OnDestroy {
  constructor(
    public api: ApiService,
    public route: ActivatedRoute,
    public crypto: CryptoService,
  ) {}

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
   * Watches the card's own box, not just the window — see `OrgAnalytic` for
   * why a plain `window:resize` listener isn't enough on its own.
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

    // The `:providerId` param carries the business `provider_id` (not the
    // internal `id` guid) — that's what the embed endpoint expects — and is
    // AES-GCM encrypted, same as the Edit Provider route, so it's never
    // exposed in the URL in the clear.
    const encId = this.route.snapshot.paramMap.get('providerId');
    if (!encId) {
      this.errorMessage.set('This analytics dashboard is not available.');
      return;
    }

    let providerId: string;
    try {
      providerId = await this.crypto.decryptId(encId);
    } catch {
      // Handle either encrypted ids or plain ids (e.g. a stale/unencrypted link).
      providerId = encId;
    }

    await this.loadReport(providerId);
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

  /** Fetches the embed config for `providerId` and hands it to the Power BI client. */
  async loadReport(providerId: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      // Toaster off: this fires on page load, so a failure belongs in the page
      // itself rather than as a popup. The backend's own message is still what
      // gets shown — it's read off the response into `errorMessage` below.
      const res = await this.api.request(
        'POST',
        API_ROUTES.GET_PROVIDER_POWERBI_EMBED,
        { provider_id: providerId },
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
