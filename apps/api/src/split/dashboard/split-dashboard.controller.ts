import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentSplitSession } from '../auth/current-split-user.decorator.js';
import { SplitAuthGuard } from '../auth/split-auth.guard.js';
import { SplitCsrfGuard } from '../auth/split-csrf.guard.js';
import { SplitOriginGuard } from '../auth/split-origin.guard.js';
import type { SplitAuthenticatedSession } from '../auth/split-auth.types.js';
import { SplitDashboardService } from './split-dashboard.service.js';

@Controller('split/dashboard')
@UseGuards(SplitOriginGuard, SplitAuthGuard)
export class SplitDashboardController {
  constructor(private readonly dashboard: SplitDashboardService) {}

  @Get()
  summary(
    @CurrentSplitSession() session: SplitAuthenticatedSession,
    @Query('month') month?: string,
  ) {
    return this.dashboard.summary(session.user.id, month);
  }

  @Post('adjustments')
  @UseGuards(SplitCsrfGuard)
  create(
    @CurrentSplitSession() session: SplitAuthenticatedSession,
    @Body() body: unknown,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.dashboard.createAdjustment(session.user.id, body, key);
  }

  @Patch('adjustments/:adjustmentId')
  @UseGuards(SplitCsrfGuard)
  update(
    @CurrentSplitSession() session: SplitAuthenticatedSession,
    @Param('adjustmentId') id: string,
    @Body() body: unknown,
  ) {
    return this.dashboard.updateAdjustment(session.user.id, id, body);
  }

  @Delete('adjustments/:adjustmentId')
  @UseGuards(SplitCsrfGuard)
  @HttpCode(204)
  async remove(
    @CurrentSplitSession() session: SplitAuthenticatedSession,
    @Param('adjustmentId') id: string,
  ) {
    await this.dashboard.deleteAdjustment(session.user.id, id);
  }

  @Post('cards')
  @UseGuards(SplitCsrfGuard)
  createCard(
    @CurrentSplitSession() session: SplitAuthenticatedSession,
    @Body() body: unknown,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.dashboard.createCard(session.user.id, body, key);
  }

  @Patch('cards/:cardId')
  @UseGuards(SplitCsrfGuard)
  updateCard(
    @CurrentSplitSession() session: SplitAuthenticatedSession,
    @Param('cardId') id: string,
    @Body() body: unknown,
  ) {
    return this.dashboard.updateCard(session.user.id, id, body);
  }

  @Delete('cards/:cardId')
  @UseGuards(SplitCsrfGuard)
  @HttpCode(204)
  async removeCard(
    @CurrentSplitSession() session: SplitAuthenticatedSession,
    @Param('cardId') id: string,
  ) {
    await this.dashboard.deleteCard(session.user.id, id);
  }
}
