import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentSplitSession } from '../auth/current-split-user.decorator.js';
import { SplitAuthGuard } from '../auth/split-auth.guard.js';
import { SplitCsrfGuard } from '../auth/split-csrf.guard.js';
import { SplitOriginGuard } from '../auth/split-origin.guard.js';
import type { SplitAuthenticatedSession } from '../auth/split-auth.types.js';
import { SplitSettlementsService } from './split-settlements.service.js';
@Controller('split/groups/:groupId/settlements')
@UseGuards(SplitOriginGuard,SplitAuthGuard)
export class SplitSettlementsController {
  constructor(private readonly settlements: SplitSettlementsService) {}
  @Post() @UseGuards(SplitCsrfGuard) create(@CurrentSplitSession() s:SplitAuthenticatedSession,@Param('groupId') g:string,@Body() b:unknown){ return this.settlements.create(s.user.id,g,b); }
  @Get() list(@CurrentSplitSession() s:SplitAuthenticatedSession,@Param('groupId') g:string){ return this.settlements.list(s.user.id,g); }
}
