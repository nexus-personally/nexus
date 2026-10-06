import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SplitAuthService } from '../data-access/split-auth.service';

export const splitGuestGuard: CanActivateFn = async () => {
  const auth = inject(SplitAuthService);
  const router = inject(Router);
  await auth.restoreSession();
  return auth.isAuthenticated() ? router.createUrlTree(['/split/groups']) : true;
};
