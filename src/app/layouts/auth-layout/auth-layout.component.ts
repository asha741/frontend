import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
/**
 * Shell layout used by unauthenticated/auth-related routes (e.g. login, register,
 * forgot password). Renders no logic of its own; it just hosts the routed child
 * view via RouterOutlet inside the auth page chrome defined in its template.
 */
export class AuthLayoutComponent {}
