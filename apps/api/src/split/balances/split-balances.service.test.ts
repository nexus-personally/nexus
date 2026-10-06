import assert from 'node:assert/strict';
import test from 'node:test';
import { SplitBalancesService } from './split-balances.service.js';

test('balance API service includes current user, guests and removed historical members', async () => {
  const members = [
    { id: 'samuel', userId: 'user', displayName: 'Samuel', membershipStatus: 'active' },
    { id: 'john', userId: null, displayName: 'John', membershipStatus: 'active' },
    { id: 'amy', userId: null, displayName: 'Amy', membershipStatus: 'removed' },
  ];
  const expenses = [{
    originalAmountMinor: 3000, baseAmountMinor: 3000,
    payments: [{ memberId: 'samuel', amountMinor: 3000 }],
    splits: members.map((member) => ({ memberId: member.id, amountMinor: 1000 })),
  }];
  const service = new SplitBalancesService(
    { access: async () => ({ group: { baseCurrency: 'MYR', simplifyDebts: true } }) } as never,
    { listMembers: async () => members, listExpenses: async () => expenses, listSettlements: async () => [] } as never,
  );
  const result = await service.get('user', 'group');
  assert.equal(result.currentUserBalance, 2000);
  assert.equal(result.memberBalances.find((row) => row.memberId === 'amy')?.membershipStatus, 'removed');
  assert.deepEqual(result.simplifiedDebts, [
    { fromMemberId: 'john', toMemberId: 'samuel', amountMinor: 1000 },
    { fromMemberId: 'amy', toMemberId: 'samuel', amountMinor: 1000 },
  ]);
});
