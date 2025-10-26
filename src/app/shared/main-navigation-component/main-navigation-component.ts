import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe, NgIf } from '@angular/common';

import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'main-navigation-component',
  imports: [RouterLink, RouterLinkActive, NgIf, AsyncPipe],
  templateUrl: './main-navigation-component.html',
  styleUrl: './main-navigation-component.scss',
})
export class MainNavigationComponent {
  private readonly authService = inject(AuthService);

  protected readonly user$ = this.authService.currentUser$;

  protected async logout(): Promise<void> {
    await this.authService.logout();
  }
}
