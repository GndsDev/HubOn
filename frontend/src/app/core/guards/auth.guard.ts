import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstAccessiblePath } from '../auth/access-control';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  const allowedRoles = (route.data['roles'] as string[] | undefined) ?? [];
  if (auth.hasAnyRole(allowedRoles)) {
    return true;
  }

  return router.parseUrl(firstAccessiblePath(auth.currentUser()?.roles ?? []));
};

export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.parseUrl(firstAccessiblePath(auth.currentUser()?.roles ?? []));
};
