import 'reflect-metadata';
import './database/env.js';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { FastifyInstance } from 'fastify';
import { AppModule } from './app.module.js';

const isProduction = process.env.NODE_ENV === 'production';
const trustProxy = process.env.TRUST_PROXY === 'true';
const adminToken = process.env.ADMIN_ACCESS_TOKEN?.trim() ?? '';
if (isProduction && adminToken.length < 32) {
  throw new Error('ADMIN_ACCESS_TOKEN must be set to a randomly generated value of at least 32 characters in production.');
}

function matchesToken(candidate: string | undefined): boolean {
  if (!adminToken || !candidate || candidate.length > 512) return false;
  const expectedDigest = createHmac('sha256', 'nexus-admin-token').update(adminToken).digest();
  const candidateDigest = createHmac('sha256', 'nexus-admin-token').update(candidate).digest();
  return timingSafeEqual(expectedDigest, candidateDigest);
}

const securityCounters = new Map<string, number>();

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

  if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      throw new BadRequestException('Untrusted request origin.');
    }
  }

  const privateApiPath = path === '/api' || path.startsWith('/api/');
  const isPublicEndpoint = ['/api/health', '/api/templates'].includes(path) || path.startsWith('/api/public/');
  if (!privateApiPath || isPublicEndpoint) return;

  const currentMinute = Math.floor(Date.now() / 60_000);
  const bucket = `${clientAddress(request)}:admin:${currentMinute}`;
  const current = securityCounters.get(bucket) ?? 0;
  securityCounters.set(bucket, current + 1);
  for (const key of securityCounters.keys()) {
    const minute = Number(key.slice(key.lastIndexOf(':') + 1));
    if (minute < currentMinute - 1) securityCounters.delete(key);
  }
  if (current >= 120) {
    reply.header('Retry-After', '60').code(429).send({ statusCode: 429, message: 'Too many requests.' });
    return;
  }

  const token = request.headers['x-nexus-admin-token'];
  if (!adminToken || typeof token !== 'string' || !matchesToken(token)) {
    if (isProduction && !adminToken) throw new UnauthorizedException('Admin access is not configured.');
    throw new UnauthorizedException('Admin access required.');
  }
}

let allowedOrigins = new Set<string>();

function clientAddress(request: FastifyRequest): string {
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
    new FastifyAdapter({ bodyLimit: 4 * 1024 * 1024, trustProxy }),
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
