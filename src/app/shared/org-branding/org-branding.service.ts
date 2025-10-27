import { inject, Injectable } from '@angular/core';

import { SupabaseService } from '../supabase-service/supabase.service';
import { environment } from '../../../environments/environment';
import { OrganisationBranding } from '../../auth/models/auth-user.model';

interface OrgLogoResponse {
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
export class OrgBrandingService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly baseUrl = environment.supabaseDataUrl.replace(/\/+$/, '');
  private readonly anonKey = environment.supabaseKey ?? '';

  async getBranding(orgSlug: string): Promise<OrganisationBranding | null> {
    try {
      const { data } = await this.supabaseService.client.auth.getSession();
      const token = data.session?.access_token ?? this.anonKey;

      const response = await fetch(
        `${this.baseUrl}/functions/v1/org-logo?slug=${encodeURIComponent(orgSlug)}`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${token}`,
            apikey: this.anonKey,
          },
        },
      );

      if (!response.ok) {
        console.error(
          'OrgBrandingService.getBranding failed',
          response.status,
          response.statusText,
        );
        return null;
      }

      const json = (await response.json()) as OrgLogoResponse;
      if (!json?.ok || !json.organisation) {
        return null;
      }

      return {
        name: json.organisation.name || 'Company Name',
        logoUrl: json.organisation.logoUrl ?? null,
      };
    } catch (error) {
      console.error('OrgBrandingService.getBranding error', error);
      return null;
    }
  }
}
