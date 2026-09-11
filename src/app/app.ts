import { AfterViewInit, ChangeDetectorRef, Component, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { filter } from 'rxjs';
import { ToastService } from './core/services/toast.service';
import { LoaderService } from './core/services/loader.service';
import { LoaderComponent } from './shared/components/loader/loader.component';

// External globals loaded via <script> tags / jQuery plugins (ported from custom.js)
declare const bootstrap: any;
declare const flatpickr: any;
declare const $: any;

/**
 * Root application component. Hosts the router outlet plus the global toast
 * and loader UI, and re-runs a batch of legacy jQuery/vanilla-JS DOM
 * behaviors (ported from the template's `custom.js`) that the lazy-loaded
 * feature components rely on for their markup to work correctly.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgbToastModule, LoaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements AfterViewInit {
  constructor(
    public toastService: ToastService,
    public loader: LoaderService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {
    this.toastService.registerChangeDetector(this.cdr);

    // The SVG images live inside lazy-loaded route components that mount into
    // <router-outlet> after the root view has initialized. Re-run the inline-SVG
    // swap after every navigation, once the newly-activated view is in the DOM.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        requestAnimationFrame(() => this.replaceSvgImages());
      });
  }

  protected readonly title = signal('Agency Admin');

  /**
   * Angular equivalent of jQuery's $(document).ready(...). Runs once, after
   * the root view (and its static template, e.g. the auth layout on first
   * load) has been rendered, wiring up all the legacy DOM-based UI behaviors.
   * Note: lazily-loaded route content that mounts later is handled separately
   * via the router-event subscription in the constructor (see replaceSvgImages).
   */
  ngAfterViewInit(): void {
    this.initProfilePanelToggle();
    this.initRolePermissionMatrix();
    this.replaceSvgImages();
    this.initCustomScrollbar();
    this.initMatchHeight();
    this.initTooltips();
    this.initRoleSwitcher();
    this.initPasswordToggle();
    this.initLoginFormValidation();
    this.initFlatpickr();
  }

  /**
   * Wires up the profile page's "Details" / "Change Password" tab toggle:
   * clicking a `[data-ma-profile-panel-target]` button shows the matching
   * panel and marks that button active. Opens directly to the password
   * panel if the page was loaded with a `#change-password` hash.
   */
  private initProfilePanelToggle(): void {
    const actionButtons = document.querySelectorAll<HTMLElement>('[data-ma-profile-panel-target]');

    if (!actionButtons.length) {
      return;
    }

    const detailsPanel = document.getElementById('maProfileDetailsPanel');
    const passwordPanel = document.getElementById('maProfilePasswordPanel');
    const panelTitle = document.getElementById('maProfilePanelTitle');

    if (!detailsPanel || !passwordPanel || !panelTitle) {
      return;
    }

    const setActivePanel = (target: string | null): void => {
      const showPassword = target === 'password';

      detailsPanel.classList.toggle('d-none', showPassword);
      passwordPanel.classList.toggle('d-none', !showPassword);
      panelTitle.textContent = showPassword ? 'Change Password' : 'Profile Details';

      actionButtons.forEach((button) => {
        const isActive = button.getAttribute('data-ma-profile-panel-target') === target;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');

        if (button.classList.contains('btn-outline-primary')) {
          button.classList.toggle('btn-primary', isActive);
          button.classList.toggle('btn-outline-primary', !isActive);
        }
      });
    };

    actionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setActivePanel(button.getAttribute('data-ma-profile-panel-target'));
      });
    });

    if (window.location.hash === '#change-password') {
      setActivePanel('password');
    }
  }

  /**
   * Wires up "select all" checkboxes in role/permission matrix tables: each
   * row's select-all box toggles every permission checkbox in that row, and
   * conversely gets checked/unchecked automatically to reflect whether all
   * permission checkboxes in the row are currently checked.
   */
  private initRolePermissionMatrix(): void {
    const matrixTables = document.querySelectorAll('.ma-role-permission-table');

    if (!matrixTables.length) {
      return;
    }

    matrixTables.forEach((table) => {
      const rowSelectAllBoxes = table.querySelectorAll<HTMLInputElement>('[data-ma-role-select-all-row]');

      rowSelectAllBoxes.forEach((selectAllBox) => {
        const row = selectAllBox.closest('tr');

        if (!row) {
          return;
        }

        const permissionBoxes = row.querySelectorAll<HTMLInputElement>('[data-ma-role-permission]');

        const syncSelectAllState = (): void => {
          const allChecked =
            permissionBoxes.length > 0 &&
            Array.prototype.every.call(permissionBoxes, (checkbox: HTMLInputElement) => checkbox.checked);
          selectAllBox.checked = allChecked;
        };

        selectAllBox.addEventListener('change', () => {
          permissionBoxes.forEach((checkbox) => {
            checkbox.checked = selectAllBox.checked;
          });
        });

        permissionBoxes.forEach((checkbox) => {
          checkbox.addEventListener('change', syncSelectAllState);
        });

        syncSelectAllState();
      });
    });
  }

  /* ===============================
     Replace SVG
  =============================== */
  /**
   * Fetches the source of every `img.ma-svg` / `img.am-svg` element and
   * replaces the `<img>` with the inline `<svg>` markup (preserving id/class),
   * so the SVG's styling/currentColor can be controlled via CSS. Re-invoked
   * after each navigation since lazy-loaded routes introduce new such images.
   */
  private replaceSvgImages(): void {
    // `:not([data-svg-processing])` skips images already being fetched, so a
    // second run (e.g. a fast follow-up navigation) never double-processes one.
    const images = document.querySelectorAll<HTMLImageElement>(
      'img.ma-svg:not([data-svg-processing]), img.am-svg:not([data-svg-processing])',
    );

    images.forEach((img) => {
      const imgURL = img.getAttribute('src');

      if (!imgURL) {
        return;
      }

      // Mark synchronously, before the async fetch, to claim this image.
      img.setAttribute('data-svg-processing', 'true');

      const imgID = img.getAttribute('id');
      const imgClass = img.getAttribute('class');

      fetch(imgURL)
        .then((response) => response.text())
        .then((data) => {
          const svg = new DOMParser().parseFromString(data, 'image/svg+xml').querySelector('svg');

          if (!svg) {
            img.removeAttribute('data-svg-processing');
            return;
          }

          if (imgID) {
            svg.setAttribute('id', imgID);
          }
          if (imgClass) {
            svg.setAttribute('class', imgClass + ' replaced-svg');
          }

          svg.removeAttribute('xmlns:a');
          // Once replaced, the element is a <svg> and no longer matches the
          // `img.ma-svg` selector, so subsequent runs skip it naturally.
          img.replaceWith(svg);
        })
        .catch(() => {
          // Un-claim on failure so a later navigation can retry the fetch.
          img.removeAttribute('data-svg-processing');
        });
    });
  }

  /* ===============================
     Custom Scrollbar (jQuery plugin)
  =============================== */
  /** Initializes the mCustomScrollbar plugin on desktop viewports only (skipped below 1025px). */
  private initCustomScrollbar(): void {
    if (window.innerWidth > 1025 && $.fn && $.fn.mCustomScrollbar) {
      $('.ma-custom-scrollbar').mCustomScrollbar({
        theme: 'dark-2',
        scrollInertia: 0,
      });
    }
  }

  /* ===============================
     MatchHeight (jQuery plugin)
  =============================== */
  /** Equalizes the heights of `.ma-match-height` elements (e.g. card grids) via the matchHeight plugin. */
  private initMatchHeight(): void {
    if ($.fn && $.fn.matchHeight) {
      $('.ma-match-height').matchHeight();
    }
  }

  /* ===============================
     Bootstrap Tooltips
  =============================== */
  /** Activates Bootstrap tooltips on every `[data-bs-toggle="tooltip"]` element present at init time. */
  private initTooltips(): void {
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
      document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
        new bootstrap.Tooltip(el);
      });
    }
  }

  /* ===============================
     Login Role Switcher
  =============================== */
  /**
   * Wires up the login page's role-selector buttons: clicking one marks it
   * active (and the rest inactive) and updates the submit button's label to
   * reflect the chosen role (purely cosmetic — does not affect submitted data).
   */
  private initRoleSwitcher(): void {
    const roleButtons = document.querySelectorAll<HTMLElement>('.ma-role-switcher .ma-role-btn');

    if (!roleButtons.length) {
      return;
    }

    const submitText = document.querySelector<HTMLElement>('#maSignInBtn span');

    roleButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const role = button.dataset['role'];

        roleButtons.forEach((btn) => {
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        });

        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');

        if (submitText) {
          submitText.textContent = 'Sign In as ' + role;
        }
      });
    });
  }

  /* ===============================
     Password Toggle
  =============================== */
  /** Wires up the show/hide-password eye icon toggle for the `#maPassword` input. */
  private initPasswordToggle(): void {
    const toggle = document.getElementById('maPasswordToggle');

    if (!toggle) {
      return;
    }

    toggle.addEventListener('click', () => {
      const passwordInput = document.getElementById('maPassword') as HTMLInputElement | null;
      const icon = toggle.querySelector('i');

      if (!passwordInput) {
        return;
      }

      const isPassword = passwordInput.getAttribute('type') === 'password';

      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
      toggle.setAttribute('aria-pressed', isPassword ? 'true' : 'false');

      if (icon) {
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
      }
    });
  }

  /* ===============================
     Login Form Validation
  =============================== */
  /**
   * Applies Bootstrap's native HTML5 validation UI to the login form:
   * blocks submission (and its default browser action) while the form is
   * invalid, and adds `was-validated` so Bootstrap's CSS reveals the
   * valid/invalid field styling.
   */
  private initLoginFormValidation(): void {
    const form = document.getElementById('maLoginForm') as HTMLFormElement | null;

    if (!form) {
      return;
    }

    form.addEventListener('submit', (event) => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      form.classList.add('was-validated');
    });
  }

  /* ===============================
     Flatpickr
  =============================== */
  /** Initializes the flatpickr date-picker widget on every `.ma-date-picker` input, using ISO (Y-m-d) format. */
  private initFlatpickr(): void {
    if (typeof flatpickr !== 'undefined') {
      document.querySelectorAll('.ma-date-picker').forEach((el) => {
        flatpickr(el, {
          dateFormat: 'Y-m-d',
          allowInput: true,
        });
      });
    }
  }
}
