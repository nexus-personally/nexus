import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SplitAuthService } from '../data-access/split-auth.service';
import { splitRouteAccess } from './split-route-access';

export const splitAuthGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(SplitAuthService);
  const router = inject(Router);
  await auth.restoreSession();
  const access = splitRouteAccess(auth.isAuthenticated(), state.url);
  return access === true ? true : router.parseUrl(access);
};
