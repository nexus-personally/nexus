import { Controller, Get, Header, NotFoundException, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

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

@Controller()
export class StaticController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  async index(@Res() reply: FastifyReply) {
    return reply.send(await readFile(resolve(webRoot, 'index.html')));
  }

  @Get('/*')
  async route(@Req() request: FastifyRequest, @Res() reply: FastifyReply) {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/api' || pathname.startsWith('/api/')) throw new NotFoundException();
    const path = pathname.replace(/^\/+/, '');
    try {
      return await this.sendFile(path, reply);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return reply
          .type('text/html; charset=utf-8')
          .send(await readFile(resolve(webRoot, 'index.html')));
      }
      throw error;
    }
  }

  private async sendFile(path: string, reply: FastifyReply) {
    const filePath = resolve(webRoot, path);
    if (!filePath.startsWith(`${webRoot}${sep}`)) throw new NotFoundException();
    let contents: Buffer;
    try {
      contents = await readFile(filePath);
    } catch {
      throw new NotFoundException();
    }
    return reply.type(mimeTypes[extname(filePath)] ?? 'application/octet-stream').send(contents);
  }
}
