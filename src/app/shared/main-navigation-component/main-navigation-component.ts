import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';

import { AuthService } from '../../auth/auth.service';
import { dbFunctionsService } from '../supabase-service/db_functions.service';

type NavigationItem = {
  label: string;
  path: string;
  available?: boolean;
};

@Component({
  selector: 'main-navigation-component',
  imports: [RouterLink, RouterLinkActive, NgIf, NgFor, AsyncPipe],
  templateUrl: './main-navigation-component.html',
  styleUrl: './main-navigation-component.scss',
})
export class MainNavigationComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly dbFunctions = inject(dbFunctionsService);

  private readonly organisationId = 'gravity';

  protected readonly user$ = this.authService.currentUser$;
  protected navItems: NavigationItem[] = [];

  protected async logout(): Promise<void> {
    await this.authService.logout();
  }

  async ngOnInit(): Promise<void> {
    await this.loadNavigationItems();
  }

  private async loadNavigationItems(): Promise<void> {
    try {
      const response = await this.dbFunctions.getNavigationItems(
        this.organisationId,
      );

      const items = Array.isArray(response) ? response : [];

      this.navItems = items
        .filter((item) => item && item.available !== false)
        .map((item) => ({
          label: item.label ?? item.name ?? '',
          path: item.path ?? item.route ?? '/',
          available: item.available,
        }))
        .filter((item) => item.label && item.path);
    } catch (error) {
      console.error('Failed to load navigation items', error);
      this.navItems = [];
    }
  }
}
