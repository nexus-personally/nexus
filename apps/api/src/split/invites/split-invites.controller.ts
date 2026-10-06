import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentSplitSession } from '../auth/current-split-user.decorator.js';
import { SplitAuthGuard } from '../auth/split-auth.guard.js';
import { SplitCsrfGuard } from '../auth/split-csrf.guard.js';
import { SplitOriginGuard } from '../auth/split-origin.guard.js';
import type { SplitAuthenticatedSession } from '../auth/split-auth.types.js';
import { SplitInvitesService } from './split-invites.service.js';
@Controller('split')
@UseGuards(SplitOriginGuard)
export class SplitInvitesController {
  constructor(private readonly invites: SplitInvitesService) {}
  @Post('groups/:groupId/invites') @UseGuards(SplitAuthGuard, SplitCsrfGuard) create(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('groupId') g: string,
    @Body() b: unknown,
  ) {
    return this.invites.create(s.user.id, g, b);
  }
  @Get('groups/:groupId/invites') @UseGuards(SplitAuthGuard) list(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('groupId') g: string,
  ) {
    return this.invites.list(s.user.id, g);
  }
  @Delete('groups/:groupId/invites/:inviteId') @UseGuards(SplitAuthGuard, SplitCsrfGuard) revoke(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('groupId') g: string,
    @Param('inviteId') i: string,
  ) {
    return this.invites.revoke(s.user.id, g, i);
  }
  @Get('invites/:token/preview') preview(@Param('token') token: string) {
    return this.invites.preview(token);
  }
  @Post('invites/:token/claim') @UseGuards(SplitAuthGuard, SplitCsrfGuard) claim(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('token') token: string,
  ) {
    return this.invites.claim(s.user, token);
  }
}
