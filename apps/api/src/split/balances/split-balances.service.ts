import { Inject, Injectable } from '@nestjs/common';
import { applySettlements, applySettlementsToDebts, calculateBalances, simplifyBalances, toBaseLines } from '../domain/balance.js';
import { SplitGroupsService } from '../groups/split-groups.service.js';
import { SPLIT_REPOSITORY, type SplitRepository } from '../persistence/split.repository.js';

@Injectable()
export class SplitBalancesService {
  constructor(
    private readonly groups: SplitGroupsService,
    @Inject(SPLIT_REPOSITORY) private readonly repository: SplitRepository,
  ) {}
  async get(userId: string, groupId: string) {
    const access = await this.groups.access(userId, groupId);
    const [members, expenses, settlements] = await Promise.all([
      this.repository.listMembers(groupId),
      this.repository.listExpenses(groupId),
      this.repository.listSettlements(groupId),
    ]);
    const result = calculateBalances(
      members.map((member) => member.id),
      expenses.map((expense) => ({
        payments: toBaseLines(expense.payments, expense.originalAmountMinor, expense.baseAmountMinor),
        splits: toBaseLines(expense.splits, expense.originalAmountMinor, expense.baseAmountMinor),
      })),
    );
    const settledBalances = applySettlements(result.memberBalances, settlements);
    const chronologicalSettlements = [...settlements].sort((left, right) =>
      left.settlementDate.localeCompare(right.settlementDate) ||
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id),
    );
    const memberBalances = settledBalances.map((row) => ({
      ...row,
      displayName: members.find((member) => member.id === row.memberId)?.displayName ?? 'Former member',
      membershipStatus: members.find((member) => member.id === row.memberId)?.membershipStatus ?? 'removed',
      isGuest: !members.find((member) => member.id === row.memberId)?.userId,
    }));
    const currentMember = members.find((member) => member.userId === userId);
    return {
      baseCurrency: access.group.baseCurrency,
      currentUserBalance: memberBalances.find((row) => row.memberId === currentMember?.id)?.amountMinor ?? 0,
      memberBalances,
      directDebts: applySettlementsToDebts(result.directDebts, chronologicalSettlements, settledBalances),
      simplifiedDebts: simplifyBalances(settledBalances),
      simplifyDebtsEnabled: access.group.simplifyDebts,
    };
  }
}
