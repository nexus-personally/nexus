import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentSplitSession } from '../auth/current-split-user.decorator.js';
import { SplitAuthGuard } from '../auth/split-auth.guard.js';
import { SplitCsrfGuard } from '../auth/split-csrf.guard.js';
import { SplitOriginGuard } from '../auth/split-origin.guard.js';
import type { SplitAuthenticatedSession } from '../auth/split-auth.types.js';
import { SplitExpensesService } from './split-expenses.service.js';
@Controller('split/groups/:groupId/expenses')
@UseGuards(SplitOriginGuard, SplitAuthGuard)
export class SplitExpensesController {
  constructor(private readonly expenses: SplitExpensesService) {}
  @Post() @UseGuards(SplitCsrfGuard) create(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('groupId') g: string,
    @Body() b: unknown,
  ) {
    return this.expenses.create(s.user, g, b);
  }
  @Get() list(@CurrentSplitSession() s: SplitAuthenticatedSession, @Param('groupId') g: string, @Query() query:Record<string,string|undefined>) {
    return this.expenses.list(s.user.id, g, query);
  }
  @Get(':expenseId') get(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('groupId') g: string,
    @Param('expenseId') e: string,
  ) {
    return this.expenses.get(s.user.id, g, e);
  }
  @Patch(':expenseId') @UseGuards(SplitCsrfGuard) update(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('groupId') g: string,
    @Param('expenseId') e: string,
    @Body() b: unknown,
  ) {
    return this.expenses.update(s.user, g, e, b);
  }
  @Delete(':expenseId') @UseGuards(SplitCsrfGuard) delete(
    @CurrentSplitSession() s: SplitAuthenticatedSession,
    @Param('groupId') g: string,
    @Param('expenseId') e: string,
  ) {
    return this.expenses.delete(s.user.id, g, e);
  }
}
