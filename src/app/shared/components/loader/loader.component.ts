import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loader',
  standalone: true,
  styles: [`
    .ma-loader-overlay {
      position: fixed; inset: 0; background: rgba(255,255,255,0.7);
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; z-index: 9998;
    }
    .ma-loader-overlay.inline {
      position: relative; background: transparent; padding: 2rem;
    }
    .ma-spinner {
      width: 40px; height: 40px; border: 4px solid #e3e3e3;
      border-top-color: #0d6efd; border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .ma-loader-text { margin-top: 0.75rem; color: #555; font-size: 0.875rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.scss',
})
/**
 * Presentational full-screen (or inline) loading spinner overlay.
 * Purely display-driven via its `@Input`s — no internal state or logic.
 */
export class LoaderComponent {
  /** Whether the overlay/spinner is visible. */
  @Input() show = false;
  /** Renders as a non-fixed, transparent block inline in the layout instead of a fixed full-screen overlay. */
  @Input() inline = false;
  /** Optional text shown below the spinner. */
  @Input() message = '';
}
