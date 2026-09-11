import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';

/** Simple "Back" control that navigates to the previous location. */
@Component({
  selector: 'app-back-button',
  standalone: true,
  templateUrl: './back-button.component.html',
  styleUrl: './back-button.component.scss',
})
export class BackButtonComponent {
  private readonly location = inject(Location);

  onBack(): void {
    this.location.back();
  }
}
