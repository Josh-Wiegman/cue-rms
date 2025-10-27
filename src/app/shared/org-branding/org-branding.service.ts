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

interface CachedBranding {
  branding: OrganisationBranding;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class OrgBrandingService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly baseUrl = environment.supabaseDataUrl.replace(/\/+$/, '');
  private readonly anonKey = environment.supabaseKey ?? '';

  private readonly CACHE_KEY_PREFIX = 'org_branding_';
  private readonly CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours

  async getBranding(orgSlug: string): Promise<OrganisationBranding | null> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${orgSlug}`;

    // --- 1️⃣ Try to load from cache
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

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
      if (!json?.ok || !json.organisation) return null;

      const branding: OrganisationBranding = {
        name: json.organisation.name || 'Company Name',
        logoUrl: json.organisation.logoUrl ?? null,
      };

      // --- 2️⃣ Store in cache
      this.setCached(cacheKey, branding);
      return branding;
    } catch (error) {
      console.error('OrgBrandingService.getBranding error', error);
      return null;
    }
  }

  // --- Cache helpers
  private getCached(key: string): OrganisationBranding | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const parsed: CachedBranding = JSON.parse(raw);
      const expired = Date.now() - parsed.timestamp > this.CACHE_TTL;

      if (expired) {
        localStorage.removeItem(key);
        return null;
      }

      return parsed.branding;
    } catch {
      return null;
    }
  }

  private setCached(key: string, branding: OrganisationBranding): void {
    try {
      const payload: CachedBranding = { branding, timestamp: Date.now() };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to write cache', err);
    }
  }
}
