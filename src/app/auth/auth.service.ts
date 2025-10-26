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

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly storageKey = 'cue-rms:session';

  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(
    null,
  );
  readonly currentUser$ = this.currentUserSubject.asObservable();

  private readonly sessionInitialization: Promise<void>;

  constructor() {
    this.sessionInitialization = this.restoreSession();
  }

  private async restoreSession(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

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

  async login(email: string, password: string): Promise<AuthUser> {
    // Call Edge Function that: verifies subdomain -> org, checks membership, signs in server-side
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'user-management',
      {
        body: { action: 'login', payload: { email, password } },
      },
    );

    if (error) throw new Error(error.message ?? 'Login failed');

    // If function returns a session, apply it to the client so Supabase-js is “logged in”
    if (data?.session) {
      const { access_token, refresh_token } = data.session;
      const { error: setErr } =
        await this.supabaseService.client.auth.setSession({
          access_token,
          refresh_token,
        });
      if (setErr) throw new Error(setErr.message);
    }

    // Build the user payload the same way you did before (but we already have basics in data.user)
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

  async logout(): Promise<void> {
    try {
      const { error } = await this.supabaseService.client.auth.signOut();
      if (error) {
        console.error('Error signing out of Supabase', error);
      }
    } finally {
      this.currentUserSubject.next(null);
      this.clearPersistedSession();
      if (this.isBrowser) {
        await this.router.navigate(['/login']);
      }
    }
  }

  async createUser(payload: CreateUserRequest): Promise<unknown> {
    if (!this.canManageUsers()) {
      throw new Error('You do not have permission to create users.');
    }

    const { data, error } = await this.supabaseService.client.functions.invoke(
      'user-management',
      {
        body: { action: 'register', payload },
      },
    );

    if (error) throw new Error(error.message ?? 'Failed to create the user.');
    return data;
  }

  hasPermission(level: PermissionLevel): boolean {
    const user = this.currentUserSubject.value;
    return user ? user.permissionLevel <= level : false;
  }

  canManageUsers(permissionLevel?: PermissionLevel): boolean {
    const level =
      permissionLevel ?? this.currentUserSubject.value?.permissionLevel;
    if (level === undefined) {
      return false;
    }

    // Only users with privilege level of Administrator (3) or higher (numerically lower)
    // are allowed to manage users.
    return level <= PermissionLevel.Administrator;
  }

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
    if (typeof value === 'number' && isPermissionLevel(value)) {
      return value;
    }

    return PermissionLevel.Viewer;
  }

  private persistUser(user: AuthUser): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(user));
  }

  private clearPersistedSession(): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.removeItem(this.storageKey);
  }
}
