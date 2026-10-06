import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

function splitAllowedOrigins() {
  const configured =
    process.env.SPLIT_ALLOWED_ORIGINS ??
    process.env.WEB_ORIGIN ??
    (process.env.NODE_ENV === 'production'
      ? (process.env.RENDER_EXTERNAL_URL ?? '')
      : 'http://localhost:4200,http://127.0.0.1:4200');
  return new Set(
    configured
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function isAllowedSplitOrigin(
  method: string,
  origin: string | undefined,
  allowed: ReadonlySet<string>,
) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method) || Boolean(origin && allowed.has(origin));
}

@Injectable()
export class SplitOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const origin = request.headers.origin;
    if (!isAllowedSplitOrigin(request.method, origin, splitAllowedOrigins())) {
      throw new BadRequestException({
        error: { code: 'SPLIT_ORIGIN_INVALID', message: 'Untrusted request origin.' },
      });
    }
    return true;
  }
}
