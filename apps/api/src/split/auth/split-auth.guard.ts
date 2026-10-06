import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { readCookie } from './session/split-session-cookie.js';
import { SplitAuthService } from './split-auth.service.js';
import type { SplitAuthenticatedSession } from './split-auth.types.js';

export type SplitAuthenticatedRequest = FastifyRequest & { splitAuth?: SplitAuthenticatedSession };

@Injectable()
export class SplitAuthGuard implements CanActivate {
  constructor(private readonly auth: SplitAuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SplitAuthenticatedRequest>();
    request.splitAuth = await this.auth.authenticate(readCookie(request.headers.cookie));
    return true;
  }
}
