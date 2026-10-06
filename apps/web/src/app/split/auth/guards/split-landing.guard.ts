import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SplitAuthService } from '../data-access/split-auth.service';
import { splitLandingDestination } from './split-route-access';
export const splitLandingGuard: CanActivateFn = async () => {
  const auth = inject(SplitAuthService),
    router = inject(Router);
  await auth.restoreSession();
  return router.parseUrl(splitLandingDestination(auth.isAuthenticated()));
};
