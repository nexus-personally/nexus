import { Body, Controller, Get, Headers, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentSplitSession } from './current-split-user.decorator.js';
import { SplitAuthGuard } from './split-auth.guard.js';
import { SplitAuthService } from './split-auth.service.js';
import type { SplitAuthenticatedSession, SplitAuthResult } from './split-auth.types.js';
import { clearSessionCookie, readCookie, sessionCookie } from './session/split-session-cookie.js';
import { SplitOriginGuard } from './split-origin.guard.js';
import { SplitCsrfGuard } from './split-csrf.guard.js';

@Controller('split/auth')
@UseGuards(SplitOriginGuard)
export class SplitAuthController {
  constructor(private readonly auth: SplitAuthService) {}

  @Post('register')
  async register(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.revokePresentedSession(readCookie(request.headers.cookie));
    return this.respond(await this.auth.register(body), reply);
  }

  @Post('login')
  async login(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.revokePresentedSession(readCookie(request.headers.cookie));
    return this.respond(await this.auth.login(body), reply);
  }

  @Post('logout')
  @UseGuards(SplitAuthGuard)
  async logout(
    @CurrentSplitSession() session: SplitAuthenticatedSession,
    @Headers('x-csrf-token') csrfToken: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    this.auth.verifyCsrf(session, csrfToken);
    await this.auth.logout(session.sessionId);
    reply.header('Set-Cookie', clearSessionCookie()).code(204);
  }

  @Get('me')
  @UseGuards(SplitAuthGuard)
  async me(@CurrentSplitSession() session: SplitAuthenticatedSession) {
    return { user: session.user, csrfToken: this.auth.csrfForSession(session) };
  }

  @Patch('profile')
  @UseGuards(SplitAuthGuard, SplitCsrfGuard)
  updateProfile(
    @CurrentSplitSession() session: SplitAuthenticatedSession,
    @Body() body: unknown,
  ) {
    return this.auth.updateProfile(session.user.id, body);
  }

  @Patch('password')
  @UseGuards(SplitAuthGuard, SplitCsrfGuard)
  async updatePassword(
    @CurrentSplitSession() session: SplitAuthenticatedSession,
    @Body() body: unknown,
  ) {
    await this.auth.updatePassword(session.user.id, body);
    return { status: 'updated' };
  }

  private respond(result: SplitAuthResult, reply: FastifyReply) {
    reply.header('Set-Cookie', sessionCookie(result.sessionToken, result.absoluteExpiresAt));
    return { user: result.user, csrfToken: result.csrfToken };
  }
}
