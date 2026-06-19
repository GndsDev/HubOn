import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return false;
  }

  const allowedRoles = (route.data['roles'] as string[] | undefined) ?? [];
  if (auth.hasAnyRole(allowedRoles)) {
    return true;
  }

  return router.parseUrl(firstAccessiblePath(auth.currentUser()?.roles ?? []));
};

function firstAccessiblePath(roles: string[]): string {
  if (roles.includes('OWNER') || roles.includes('ADMIN')) return '/dashboard';
  if (roles.includes('WAITER')) return '/mesas';
  if (roles.includes('KITCHEN')) return '/cozinha';
  if (roles.includes('CASHIER')) return '/comandas';
  return '/dashboard';
}
