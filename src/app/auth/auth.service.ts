import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { User } from '@supabase/supabase-js';

import { SupabaseService } from '../shared/supabase-service/supabase.service';
import { AuthUser, CreateUserRequest } from './models/auth-user.model';
import {
  isPermissionLevel,
  PermissionLevel,
} from './models/permission-level.model';
import { environment } from '../../environments/environment';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly storageKey = 'cue-rms:session';
  private readonly orgOverrideKey = 'cue-rms:org-override';

  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(
    null,
  );
  readonly currentUser$ = this.currentUserSubject.asObservable();

  private readonly orgSubject = new BehaviorSubject<string>('public');
  readonly org$ = this.orgSubject.asObservable();

  private readonly sessionInitialization: Promise<void>;

  constructor() {
    // Derive org early so components can use it on init
    const slug = this.detectOrgSlug();
    this.orgSubject.next(slug);

    this.sessionInitialization = this.restoreSession();
  }

  // ---------- ORG DETECTION ----------
  private detectOrgSlug(): string {
    if (!this.isBrowser) {
      // SSR: safest default; server will still enforce via host
      return environment.defaultOrgSlug ?? 'public';
    }

    // 1) Dev override from query (?org=dev)
    const url = new URL(window.location.href);
    const qp = url.searchParams.get('org');
    if (qp && SLUG_RE.test(qp)) {
      localStorage.setItem(this.orgOverrideKey, qp);
      return qp;
    }

    // 2) Dev override from localStorage
    const saved = localStorage.getItem(this.orgOverrideKey);
    if (saved && SLUG_RE.test(saved)) {
      return saved;
    }

    // 3) Host-based slug (authoritative for display; server also uses this)
    const base = (environment.baseTenantDomain ?? '').toLowerCase(); // e.g. 'cue-rms.com'
    const host = window.location.hostname.toLowerCase();

    if (base && host.endsWith(base)) {
      // strip "<slug>." prefix from "<slug>.base"
      let remainder = host.slice(0, host.length - base.length);
      if (remainder.endsWith('.')) remainder = remainder.slice(0, -1);
      if (!remainder) return environment.defaultOrgSlug ?? 'public';
      const [slug] = remainder.split('.').filter(Boolean);
      if (slug && SLUG_RE.test(slug)) return slug;
    }

    // 4) Fallback: non-tenant host (localhost, app link, etc.)
    return environment.defaultOrgSlug ?? 'public';
  }

  /** Dev helper: allow setting a manual org (e.g. from a tenant switcher) */
  setOrgForDev(slug: string) {
    if (!this.isBrowser) return;
    if (!SLUG_RE.test(slug)) throw new Error('Invalid org slug');
    localStorage.setItem(this.orgOverrideKey, slug);
    this.orgSubject.next(slug);
  }

  // ---------- SESSION ----------
  private async restoreSession(): Promise<void> {
    if (!this.isBrowser) return;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed: AuthUser = JSON.parse(stored) as AuthUser;
        this.currentUserSubject.next(parsed);
        return;
      }

      const { data, error } =
        await this.supabaseService.client.auth.getSession();
      if (error) {
        console.error('Failed to restore Supabase session', error);
        return;
      }

      const supabaseUser = data.session?.user;
      if (supabaseUser) {
        await this.loadUserProfile(supabaseUser);
      }
    } catch (error) {
      console.error('Unexpected error restoring session', error);
      this.clearPersistedSession();
    }
  }

  async ensureSessionResolved(): Promise<void> {
    await this.sessionInitialization;
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  get currentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  get orgSlug(): string {
    return this.orgSubject.value;
  }

  // ---------- AUTH ----------
  async login(email: string, password: string): Promise<AuthUser> {
    // Do NOT send orgSlug or x-org-slug — server infers from subdomain.
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'user-management',
      {
        body: { action: 'login', payload: { email, password } },
        // headers: { }  // no tenant headers for login; host is authoritative
      },
    );

    if (error) throw new Error(error.message ?? 'Login failed');
    if (!data?.user) throw new Error('Login failed: no user returned');

    // Apply session so supabase-js is logged in too
    if (data.session?.access_token && data.session?.refresh_token) {
      const { error: setErr } =
        await this.supabaseService.client.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      if (setErr) throw new Error(setErr.message);
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? '',
      displayName: data.user.displayName ?? data.user.email ?? 'Unknown user',
      permissionLevel: data.user.permissionLevel,
    };

    this.persistUser(user);
    this.currentUserSubject.next(user);
    return user;
  }

  async createUser(payload: CreateUserRequest): Promise<unknown> {
    if (!this.canManageUsers()) {
      throw new Error('You do not have permission to create users.');
    }

    const admin = this.currentUserSubject.value;
    const invitation = payload.invitation
      ? {
          ...payload.invitation,
          organisation: {
            name: payload.invitation.organisation.name,
            logoUrl: payload.invitation.organisation.logoUrl ?? null,
          },
          invitedBy:
            payload.invitation.invitedBy ??
            (admin
              ? { displayName: admin.displayName, email: admin.email }
              : undefined),
        }
      : undefined;

    // For invite/register:
    // - If your Edge Function allows privileged overrides via header, you can include x-org-slug.
    // - If you rely on host only, you can omit it (recommended).
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'user-management',
      {
        body: {
          action: 'invite',
          payload: {
            email: payload.email,
            displayName: payload.displayName,
            permissionLevel: payload.permissionLevel,
            invitation,
            // orgSlug intentionally omitted to avoid tenant_mismatch with host
          },
        },
        // headers: { 'x-org-slug': this.orgSubject.value } // only if your privileged flow requires it
      },
    );

    if (error) throw new Error(error.message ?? 'Failed to create the user.');
    return data;
  }

  async logout(): Promise<void> {
    try {
      const { error } = await this.supabaseService.client.auth.signOut();
      if (error) console.error('Error signing out of Supabase', error);
    } finally {
      this.currentUserSubject.next(null);
      this.clearPersistedSession();
      if (this.isBrowser) await this.router.navigate(['/login']);
    }
  }

  hasPermission(level: PermissionLevel): boolean {
    const user = this.currentUserSubject.value;
    return user ? user.permissionLevel <= level : false;
  }

  canManageUsers(permissionLevel?: PermissionLevel): boolean {
    const level =
      permissionLevel ?? this.currentUserSubject.value?.permissionLevel;
    if (level === undefined) return false;
    return level <= PermissionLevel.Administrator;
  }

  // ---------- PROFILE ----------
  private async loadUserProfile(supabaseUser: User): Promise<AuthUser> {
    const { data, error } = await this.supabaseService.client
      .from('user_profiles')
      .select('display_name, permission_level')
      .eq('id', supabaseUser.id)
      .single();

    if (error) {
      console.error('Failed to fetch user profile from Supabase', error);
    }

    const permissionLevel = this.parsePermissionLevel(data?.permission_level);

    const user: AuthUser = {
      id: supabaseUser.id,
      email: supabaseUser.email ?? '',
      displayName: data?.display_name ?? supabaseUser.email ?? 'Unknown user',
      permissionLevel,
    };

    this.persistUser(user);
    this.currentUserSubject.next(user);
    return user;
  }

  private parsePermissionLevel(value: unknown): PermissionLevel {
    if (typeof value === 'number' && isPermissionLevel(value)) return value;
    return PermissionLevel.Viewer;
  }

  private persistUser(user: AuthUser): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.storageKey, JSON.stringify(user));
  }

  private clearPersistedSession(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.storageKey);
  }
}
