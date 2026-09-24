import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from './api.service';

export const adminAccessGuard: CanActivateFn = () => {
  if (inject(ApiService).hasAdminToken) return true;
  return inject(Router).createUrlTree(['/resume']);
};
