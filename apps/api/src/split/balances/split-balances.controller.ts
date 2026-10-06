import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentSplitSession } from '../auth/current-split-user.decorator.js';
import { SplitAuthGuard } from '../auth/split-auth.guard.js';
import { SplitOriginGuard } from '../auth/split-origin.guard.js';
import type { SplitAuthenticatedSession } from '../auth/split-auth.types.js';
import { SplitBalancesService } from './split-balances.service.js';

@Controller('split/groups/:groupId/balances')
@UseGuards(SplitOriginGuard, SplitAuthGuard)
export class SplitBalancesController {
  constructor(private readonly balances: SplitBalancesService) {}
  @Get()
  get(@CurrentSplitSession() session: SplitAuthenticatedSession, @Param('groupId') groupId: string) {
    return this.balances.get(session.user.id, groupId);
  }
}
