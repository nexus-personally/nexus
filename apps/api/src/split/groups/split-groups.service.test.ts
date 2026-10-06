import assert from 'node:assert/strict';
import test from 'node:test';
import { SplitGroupsService } from './split-groups.service.js';

test('creating a group derives ownership from the authenticated Split user', async () => {
  const calls: unknown[] = [];
  const repository = {
    createGroup: async (input: unknown) => {
      calls.push(input);
      return input;
    },
  };
  const service = new SplitGroupsService(repository as never, {
    now: () => new Date('2026-10-06T00:00:00Z'),
    uuid: (() => {
      let value = 0;
      return () => `00000000-0000-4000-8000-${String(++value).padStart(12, '0')}`;
    })(),
    token: () => 'token',
  });

  await service.create(
    { id: 'user-1', displayName: 'Alex' },
    { name: ' Guangzhou Trip ', type: 'travel', baseCurrency: 'MYR' },
  );

  assert.equal(calls.length, 1);
  assert.equal(
    (calls[0] as { group: { name: string; createdByUserId: string } }).group.name,
    'Guangzhou Trip',
  );
  assert.equal(
    (calls[0] as { group: { createdByUserId: string } }).group.createdByUserId,
    'user-1',
  );
  assert.equal((calls[0] as { owner: { userId: string; role: string } }).owner.userId, 'user-1');
  assert.equal((calls[0] as { owner: { role: string } }).owner.role, 'owner');
});

test('base currency locks after the first active Expense without blocking other settings', async () => {
  const access = {
    group: {
      id: 'g1',
      name: 'Trip',
      type: 'travel',
      baseCurrency: 'MYR',
      simplifyDebts: true,
      startDate: null,
      endDate: null,
      status: 'active',
      createdByUserId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    membership: {
      id: 'm1',
      groupId: 'g1',
      userId: 'user-1',
      displayName: 'Alex',
      role: 'owner',
      membershipStatus: 'active',
      joinedAt: new Date(),
      linkedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  const repository = {
    findGroupAccess: async () => access,
    hasActiveExpenses: async () => true,
    updateGroup: async (g: unknown) => g,
  };
  const service = new SplitGroupsService(repository as never, {
    now: () => new Date(),
    uuid: () => '',
    token: () => '',
  });
  await assert.rejects(
    () => service.update('user-1', 'g1', { baseCurrency: 'USD' }),
    (error: unknown) =>
      (error as { getResponse(): { error: { code: string } } }).getResponse().error.code ===
      'SPLIT_BASE_CURRENCY_LOCKED',
  );
  assert.equal((await service.update('user-1', 'g1', { name: 'Updated' })).name, 'Updated');
});
