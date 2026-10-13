import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentSplitSession } from '../auth/current-split-user.decorator.js';
import { SplitAuthGuard } from '../auth/split-auth.guard.js';
import { SplitOriginGuard } from '../auth/split-origin.guard.js';
import type { SplitAuthenticatedSession } from '../auth/split-auth.types.js';
import { SplitAnalyticsService } from './split-analytics.service.js';

@Controller('split/groups/:groupId/analytics')
@UseGuards(SplitOriginGuard, SplitAuthGuard)
export class SplitAnalyticsController {
  constructor(private readonly analytics: SplitAnalyticsService) {}

  @Get()
  get(
    @CurrentSplitSession() session: SplitAuthenticatedSession,
    @Param('groupId') groupId: string,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.get(session.user.id, groupId, month, from, to);
  }
}
