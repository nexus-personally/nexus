import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SplitAuthenticatedRequest } from './split-auth.guard.js';

export const CurrentSplitSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<SplitAuthenticatedRequest>().splitAuth,
);
