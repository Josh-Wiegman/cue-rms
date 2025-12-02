import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe, NgIf } from '@angular/common';

import { AuthService } from '../../auth/auth.service';
import { dbFunctionsService } from '../supabase-service/db_functions.service';
import { OrgBrandingService } from '../org-branding/org-branding.service';
import { DropdownMenu } from '../dropdown-menu/dropdown-menu';
import { DropdownMenuItem } from '../dropdown-menu/dropdown-menu-item/dropdown-menu-item';

type NavigationLink = {
  label: string;
  path: string;
  available?: boolean;
};

type NavigationGroup = {
  label: string;
  children: NavigationLink[];
  available?: boolean;
};

type NavigationItem = NavigationLink | NavigationGroup;

@Component({
  selector: 'main-navigation-component',
  imports: [
    RouterLink,
    RouterLinkActive,
    NgIf,
    AsyncPipe,
    DropdownMenu,
    DropdownMenuItem,
  ],
  templateUrl: './main-navigation-component.html',
  styleUrl: './main-navigation-component.scss',
})
export class MainNavigationComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly dbFunctions = inject(dbFunctionsService);
  private readonly orgBrandingService = inject(OrgBrandingService);

  // Use your existing slug/id (header x-org-slug aligns with this)
  private readonly organisationId = this.authService.orgSlug;

  protected readonly user$ = this.authService.currentUser$;
  protected navItems: NavigationItem[] = [];

  // ⬇️ NEW: org UI state
  protected orgName = '';
  protected orgLogoUrl: string | null = null;

  protected async logout(): Promise<void> {
    await this.authService.logout();
  }

  async ngOnInit(): Promise<void> {
    // Run both in parallel; whichever finishes first can render
    await Promise.all([this.loadNavigationItems(), this.loadOrgBranding()]);
  }

  private async loadNavigationItems(): Promise<void> {
    try {
      const response = await this.dbFunctions.getNavigationItems(
        this.organisationId,
      );
      const items = Array.isArray(response) ? response : [];

      const flattened = items
        .filter((item) => item && item.available !== false)
        .map((item) => ({
          label: item.label ?? '',
          path: item.path ?? '/',
          available: item.available,
        }))
        .filter((item) => item.label && item.path);

      this.navItems = [
        ...flattened,
        { label: 'Customers', path: '/customers' },
        { label: 'Purchase Orders', path: '/purchase-orders' },
        this.createToolsNavigation(),
      ];
    } catch (error) {
      console.error('Failed to load navigation items', error);
      this.navItems = [
        { label: 'Customers', path: '/customers' },
        { label: 'Purchase Orders', path: '/purchase-orders' },
        this.createToolsNavigation(),
      ];
    }
  }

  private async loadOrgBranding(): Promise<void> {
    try {
      const branding = await this.orgBrandingService.getBranding(
        this.organisationId,
      );
      if (branding) {
        this.orgName = branding.name;
        this.orgLogoUrl = branding.logoUrl;
      } else {
        this.orgName = 'Company Name';
        this.orgLogoUrl = null;
      }
    } catch (err) {
      console.error('Failed to load org branding', err);
      this.orgName = 'Company Name';
      this.orgLogoUrl = null;
    }
  }

  protected isGroup(item: NavigationItem): item is NavigationGroup {
    return 'children' in item && Array.isArray(item.children);
  }

  private createToolsNavigation(): NavigationGroup {
    return {
      label: 'Tools',
      children: [
        {
          label: 'PartyHire Orders',
          path: '/partyhire',
        },
        {
          label: 'Stage Timer',
          path: '/tools/stage-timer',
        },
      ],
    };
  }
}
