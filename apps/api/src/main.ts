import 'reflect-metadata';
import './database/env.js';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { extname, resolve, sep } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import type { FastifyInstance } from 'fastify';
import { AppModule } from './app.module.js';

const isProduction = process.env.NODE_ENV === 'production';
const rateLimitWindowMs = 60_000;
const maxApiRequestsPerWindow = 60;
const initialBlockMs = 15 * 60_000;
const maxBlockMs = 24 * 60 * 60_000;
const forgetIpAfterMs = 30 * 24 * 60 * 60_000;
const maxTrackedIps = 20_000;

interface IpRateLimitState {
  windowStartedAt: number;
  requestCount: number;
  blockedUntil: number;
  strikes: number;
  lastSeenAt: number;
}

const ipRateLimits = new Map<string, IpRateLimitState>();
let lastIpCleanupAt = 0;

function rawPath(request: FastifyRequest): string | undefined {
  try {
    return new URL(request.url, 'http://localhost').pathname;
  } catch {
    return undefined;
  }
}

async function applySecurity(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction) {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    reply.header('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https:; upgrade-insecure-requests");
  }

  const path = rawPath(request);
  if (!path) {
    reply.code(400).send({ statusCode: 400, message: 'Invalid request path.' });
    return;
  }

  const isApiPath = path === '/api' || path.startsWith('/api/');
  if (!isApiPath) return;

  if (path !== '/api/health' && request.method !== 'OPTIONS') {
    const now = Date.now();
    const ip = clientAddress(request);
    let state = ipRateLimits.get(ip);

    if (!state) {
      cleanupIpRateLimits(now);
      if (ipRateLimits.size >= maxTrackedIps) {
        let oldestIp: string | undefined;
        let oldestSeenAt = Infinity;
        for (const [trackedIp, trackedState] of ipRateLimits) {
          if (trackedState.lastSeenAt < oldestSeenAt) {
            oldestIp = trackedIp;
            oldestSeenAt = trackedState.lastSeenAt;
          }
        }
        if (oldestIp) ipRateLimits.delete(oldestIp);
      }

      state = { windowStartedAt: now, requestCount: 0, blockedUntil: 0, strikes: 0, lastSeenAt: now };
      ipRateLimits.set(ip, state);
    }

    state.lastSeenAt = now;
    if (state.blockedUntil > now) {
      const retryAfter = Math.ceil((state.blockedUntil - now) / 1000);
      reply.header('Retry-After', String(retryAfter)).code(403).send({
        statusCode: 403,
        message: 'IP temporarily blocked for repeated API requests.',
      });
      return;
    }

    if (now - state.windowStartedAt >= rateLimitWindowMs) {
      state.windowStartedAt = now;
      state.requestCount = 0;
    }
    state.requestCount += 1;

    if (state.requestCount > maxApiRequestsPerWindow) {
      state.strikes += 1;
      state.blockedUntil = now + Math.min(initialBlockMs * 4 ** (state.strikes - 1), maxBlockMs);
      const retryAfter = Math.ceil((state.blockedUntil - now) / 1000);
      console.warn(JSON.stringify({
        event: 'ip_temporarily_blocked',
        ip,
        requestsPerMinute: state.requestCount,
        strike: state.strikes,
        blockedForSeconds: retryAfter,
      }));
      reply.header('Retry-After', String(retryAfter)).code(429).send({
        statusCode: 429,
        message: 'Too many API requests. This IP is temporarily blocked.',
      });
      return;
    }
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      throw new BadRequestException('Untrusted request origin.');
    }
  }
}

function cleanupIpRateLimits(now: number): void {
  if (now - lastIpCleanupAt < rateLimitWindowMs) return;
  lastIpCleanupAt = now;
  for (const [ip, state] of ipRateLimits) {
    if (now - state.lastSeenAt > forgetIpAfterMs) ipRateLimits.delete(ip);
  }
}

let allowedOrigins = new Set<string>();

function clientAddress(request: FastifyRequest): string {
  // Render routes public traffic through Cloudflare, which overwrites this header.
  // Do not trust arbitrary X-Forwarded-For values supplied by callers.
  if (process.env.RENDER_EXTERNAL_URL) {
    const cloudflareIp = request.headers['cf-connecting-ip'];
    if (typeof cloudflareIp === 'string' && isIP(cloudflareIp)) return cloudflareIp;
  }
  return request.ip || 'unknown';
}

const webRoot = resolve(process.cwd(), 'apps/web/browser');
const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function serveWebFallback(request: FastifyRequest, reply: FastifyReply) {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    return reply.code(400).send({ statusCode: 400, message: 'Invalid request path.' });
  }
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return reply.code(404).send({ statusCode: 404, message: 'Not Found' });
  }

  const filePath = resolve(webRoot, pathname.replace(/^\/+/, ''));
  if (filePath.startsWith(`${webRoot}${sep}`)) {
    try {
      const contents = await readFile(filePath);
      return reply.type(mimeTypes[extname(filePath)] ?? 'application/octet-stream').send(contents);
    } catch {
      // A missing asset or client-side route should fall back to Angular's entry point.
    }
  }

  return reply
    .type('text/html; charset=utf-8')
    .send(await readFile(resolve(webRoot, 'index.html')));
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 4 * 1024 * 1024, trustProxy: false }),
  );
  allowedOrigins = new Set(
    (process.env.WEB_ORIGIN ?? (isProduction ? (process.env.RENDER_EXTERNAL_URL ?? '') : 'http://localhost:4200,http://127.0.0.1:4200'))
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: false,
  });

  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;
  fastify.addHook('onRequest', applySecurity);

  fastify.get('/', serveWebFallback);
  fastify.get('/*', serveWebFallback);
  await app.init();

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
