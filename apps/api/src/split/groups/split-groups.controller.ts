import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentSplitSession } from '../auth/current-split-user.decorator.js';
import { SplitAuthGuard } from '../auth/split-auth.guard.js';
import { SplitCsrfGuard } from '../auth/split-csrf.guard.js';
import { SplitOriginGuard } from '../auth/split-origin.guard.js';
import type { SplitAuthenticatedSession } from '../auth/split-auth.types.js';
import { SplitGroupsService } from './split-groups.service.js';

@Controller('split/groups')
@UseGuards(SplitOriginGuard, SplitAuthGuard)
export class SplitGroupsController {
  constructor(private readonly groups: SplitGroupsService) {}
  @Post() @UseGuards(SplitCsrfGuard) create(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Body() body: unknown,
  ) {
    return this.groups.create(s.user, body);
  }
  @Get() list(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Query('status') status?: string,
  ) {
    return this.groups.list(s.user.id, status);
  }
  @Get(':groupId') get(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('groupId') id: string,
  ) {
    return this.groups.get(s.user.id, id);
  }
  @Patch(':groupId') @UseGuards(SplitCsrfGuard) update(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('groupId') id: string,
    @Body() body: unknown,
  ) {
    return this.groups.update(s.user.id, id, body);
  }
  @Post(':groupId/archive') @UseGuards(SplitCsrfGuard) archive(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('groupId') id: string,
  ) {
    return this.groups.archive(s.user.id, id);
  }
  @Post(':groupId/reopen') @UseGuards(SplitCsrfGuard) reopen(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('groupId') id: string,
  ) {
    return this.groups.reopen(s.user.id, id);
  }
}
