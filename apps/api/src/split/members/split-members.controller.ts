import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentSplitSession } from '../auth/current-split-user.decorator.js';
import { SplitAuthGuard } from '../auth/split-auth.guard.js';
import { SplitCsrfGuard } from '../auth/split-csrf.guard.js';
import { SplitOriginGuard } from '../auth/split-origin.guard.js';
import type { SplitAuthenticatedSession } from '../auth/split-auth.types.js';
import { SplitMembersService } from './split-members.service.js';
@Controller('split/groups/:groupId/members')
@UseGuards(SplitOriginGuard, SplitAuthGuard)
export class SplitMembersController {
  constructor(private readonly members: SplitMembersService) {}
  @Get() list(@CurrentSplitSession() s: SplitAuthenticatedSession, @Param('groupId') g: string) {
    return this.members.list(s.user.id, g);
  }
  @Post('guest') @UseGuards(SplitCsrfGuard) guest(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('groupId') g: string,
    @Body() b: unknown,
  ) {
    return this.members.createGuest(s.user.id, g, b);
  }
  @Delete(':memberId') @UseGuards(SplitCsrfGuard) remove(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('groupId') g: string,
    @Param('memberId') m: string,
  ) {
    return this.members.remove(s.user.id, g, m);
  }
}
