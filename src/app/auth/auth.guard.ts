import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { inject } from '@angular/core';

import { AuthService } from './auth.service';

export class authGuard implements CanActivate {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): boolean | UrlTree {
    const path = state.url.split('?')[0];

    if (path === '/reset-password') {
      return true;
    }

    const isAuthed = this.authService.isAuthenticated();

    if (!isAuthed) {
      return this.router.parseUrl('/login');
    }

    return true;
  }
}
