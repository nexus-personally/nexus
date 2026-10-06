import { Inject, Injectable } from '@nestjs/common';
import { applySettlements, calculateBalances, simplifyBalances } from '../domain/balance.js';
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
        payments: this.toBaseLines(expense.payments, expense.originalAmountMinor, expense.baseAmountMinor),
        splits: this.toBaseLines(expense.splits, expense.originalAmountMinor, expense.baseAmountMinor),
      })),
    );
    const settledBalances = applySettlements(result.memberBalances, settlements);
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
      directDebts: result.directDebts,
      simplifiedDebts: simplifyBalances(settledBalances),
      simplifyDebtsEnabled: access.group.simplifyDebts,
    };
  }
  private toBaseLines(
    rows: Array<{ memberId: string; amountMinor: number }>,
    originalTotal: number,
    baseTotal: number,
  ): Array<readonly [string, number]> {
    const result = rows.map((row) => [
      row.memberId,
      Number((BigInt(row.amountMinor) * BigInt(baseTotal)) / BigInt(originalTotal)),
    ] as [string, number]);
    let remainder = baseTotal - result.reduce((sum, [, amount]) => sum + amount, 0);
    for (let index = 0; remainder > 0; index = (index + 1) % result.length) {
      result[index]![1] += 1;
      remainder -= 1;
    }
    return result;
  }
}
