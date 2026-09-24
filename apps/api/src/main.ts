import 'reflect-metadata';
import './database/env.js';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { AppModule } from './app.module.js';

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
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
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
    new FastifyAdapter({ bodyLimit: 4 * 1024 * 1024 }),
  );
  const allowedOrigins = new Set(
    (process.env.WEB_ORIGIN ?? 'http://localhost:4200,http://127.0.0.1:4200')
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

      callback(new Error(`Origin ${origin} is not allowed by CORS.`), false);
    },
    credentials: false,
  });

  const fastify = app.getHttpAdapter().getInstance();
  fastify.get('/', serveWebFallback);
  fastify.get('/*', serveWebFallback);
  await app.init();

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
