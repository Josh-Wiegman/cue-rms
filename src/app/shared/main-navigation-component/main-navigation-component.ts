import { Component, Injectable, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';

import { AuthService } from '../../auth/auth.service';
import { dbFunctionsService } from '../supabase-service/db_functions.service';
import { environment } from '../../../environments/environment';
import { SupabaseService } from '../supabase-service/supabase.service';

type NavigationItem = {
  label: string;
  path: string;
  available?: boolean;
};

export interface OrgLogoResponse {
  ok: boolean;
  organisation?: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
  };
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class NavbarService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly baseUrl = environment.supabaseDataUrl.replace(/\/+$/, '');
  private readonly anonKey = environment.supabaseKey ?? '';

  async getOrgLogo(orgSlug: string): Promise<OrgLogoResponse | null> {
    try {
      const { data } = await this.supabaseService.client.auth.getSession();
      const token = data.session?.access_token ?? this.anonKey;

      const url = `${this.baseUrl}/functions/v1/org-logo?slug=${encodeURIComponent(orgSlug)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: this.anonKey,
        },
      });

      if (!res.ok) {
        console.error('Org logo fetch failed:', res.status, res.statusText);
        return null;
      }

      const json = (await res.json()) as OrgLogoResponse;
      return json;
    } catch (err) {
      console.error('NavbarService.getOrgLogo() error:', err);
      return null;
    }
  }
}

@Component({
  selector: 'main-navigation-component',
  imports: [RouterLink, RouterLinkActive, NgIf, NgFor, AsyncPipe],
  templateUrl: './main-navigation-component.html',
  styleUrl: './main-navigation-component.scss',
})
export class MainNavigationComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly dbFunctions = inject(dbFunctionsService);
  private readonly navbarService = inject(NavbarService); // ⬅️ NEW

  // Use your existing slug/id (header x-org-slug aligns with this)
  private readonly organisationId = 'gravity';

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
      const response = await this.dbFunctions.getNavigationItems();
      const items = Array.isArray(response) ? response : [];

      this.navItems = items
        .filter((item) => item && item.available !== false)
        .map((item) => ({
          label: item.label ?? '',
          path: item.path ?? '/',
          available: item.available,
        }))
        .filter((item) => item.label && item.path);
    } catch (error) {
      console.error('Failed to load navigation items', error);
      this.navItems = [];
    }
  }

  // ⬇️ NEW: fetch org name/logo from your edge function
  private async loadOrgBranding(): Promise<void> {
    try {
      const resp = await this.navbarService.getOrgLogo(this.organisationId);
      if (resp?.ok && resp.organisation) {
        this.orgName = resp.organisation.name || 'Company Name';
        this.orgLogoUrl = resp.organisation.logoUrl ?? null;
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
}
