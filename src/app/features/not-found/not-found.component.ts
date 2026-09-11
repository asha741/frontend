import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Fallback route component displayed when a user navigates to an
 * unmatched/unknown URL (typically wired up as the wildcard "**" route).
 * Has no state or logic of its own; the template provides the messaging
 * and a link (via RouterLink) back to a known route.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {}
