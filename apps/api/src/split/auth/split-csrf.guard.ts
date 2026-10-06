import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { SplitAuthService } from './split-auth.service.js';
import type { SplitAuthenticatedRequest } from './split-auth.guard.js';

@Injectable()
export class SplitCsrfGuard implements CanActivate {
  constructor(private readonly auth: SplitAuthService) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SplitAuthenticatedRequest>();
    this.auth.verifyCsrf(request.splitAuth!, request.headers['x-csrf-token'] as string | undefined);
    return true;
  }
}
