import { Component, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { DeleteConfirmationComponent } from '../delete-confirmation/delete-confirmation.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  /** Emitted by the close button / nav taps so the layout can dismiss the mobile drawer. */
  @Output() close = new EventEmitter<void>();

  private readonly auth = inject(AuthService);
  private readonly modalService = inject(NgbModal);

  /**
   * Only the items this user's permissions unlock. The list itself lives in
   * `core/constants/navigation.ts`, shared with the route guard.
   */
  readonly navItems = inject(PermissionService).menu;
}
