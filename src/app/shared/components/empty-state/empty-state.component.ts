import { Component, Input } from '@angular/core';

/**
 * Presentational placeholder shown in place of a list/table/grid when there
 * is no data to display. Purely visual — no state, no API calls.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  styles: [`
    :host { display: block; height: 100%; }
    .ma-empty-state {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 100%; padding: 3rem 1rem; text-align: center; color: #aaa;
    }
    .ma-empty-icon { font-size: 3rem; margin-bottom: 1rem; }
    .ma-empty-title { font-size: 1.1rem; font-weight: 600; color: #555; margin-bottom: 0.5rem; }
    .ma-empty-message { font-size: 0.875rem; color: #888; }
  `],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  @Input() title = 'No Data Found';
  @Input() message = 'There are no records to display.';
  @Input() icon = 'fa-inbox';
}
