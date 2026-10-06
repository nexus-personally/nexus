import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentSplitSession } from '../auth/current-split-user.decorator.js';
import { SplitAuthGuard } from '../auth/split-auth.guard.js';
import { SplitOriginGuard } from '../auth/split-origin.guard.js';
import type { SplitAuthenticatedSession } from '../auth/split-auth.types.js';
import { SplitGroupsService } from '../groups/split-groups.service.js';
import { SplitExchangeRateService } from './split-exchange-rate.service.js';

@Controller('split/groups/:groupId/fx-rate')
@UseGuards(SplitOriginGuard, SplitAuthGuard)
export class SplitExchangeRateController {
  constructor(private readonly groups: SplitGroupsService, private readonly rates: SplitExchangeRateService) {}
  @Get()
  async get(
    @CurrentSplitSession() session: SplitAuthenticatedSession,
    @Param('groupId') groupId: string,
    @Query('from') from = '',
    @Query('to') to = '',
    @Query('date') date = '',
  ) {
    await this.groups.access(session.user.id, groupId);
    return this.rates.getRate(from, to, date);
  }
}
