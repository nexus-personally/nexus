import assert from 'node:assert/strict';
import test from 'node:test';
import { SplitExpensesService } from './split-expenses.service.js';
import type { SplitExpense } from './split-expense.types.js';

const now = new Date('2026-10-06T00:00:00Z');
let id = 0;
const runtime = { now: () => now, uuid: () => `id-${++id}`, token: () => '' };
const group = (role: 'owner' | 'member' = 'owner', status: 'active' | 'archived' = 'active') =>
  ({
    group: {
      id: 'g1',
      name: 'Trip',
      type: 'travel',
      baseCurrency: 'MYR',
      simplifyDebts: true,
      startDate: null,
      endDate: null,
      status,
      createdByUserId: 'owner',
      createdAt: now,
      updatedAt: now,
    },
    membership: {
      id: role === 'owner' ? 'm-owner' : 'm-user',
      groupId: 'g1',
      userId: role === 'owner' ? 'owner' : 'user',
      displayName: 'User',
      role,
      membershipStatus: 'active',
      joinedAt: now,
      linkedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  }) as const;
const members = [
  { ...group().membership, id: 'm-owner' },
  { ...group('member').membership, id: 'm-user' },
  { ...group('member').membership, id: 'm-guest', userId: null, displayName: 'Guest' },
];
const body = {
  description: ' Dinner ',
  categoryKey: 'food',
  amountMinor: 3000,
  currency: 'MYR',
  expenseDate: '2026-12-12',
  note: null,
  payments: [{ memberId: 'm-owner', amountMinor: 3000 }],
  split: { method: 'equal', participants: ['m-owner', 'm-user', 'm-guest'] },
};
const code = async (work: () => Promise<unknown>) => {
  try {
    await work();
    assert.fail('expected error');
  } catch (e) {
    return (e as { getResponse(): { error: { code: string; details?: unknown } } }).getResponse()
      .error.code;
  }
};

test('owner or member creates a transactional Expense aggregate with guest participation', async () => {
  let write: { expense: SplitExpense; activityId: string; actorUserId: string } | undefined;
  const repo = {
    listMembers: async () => members,
    createExpense: async (w: typeof write) => {
      write = w;
      return w!.expense;
    },
  };
  for (const role of ['owner', 'member'] as const) {
    const service = new SplitExpensesService(
      { access: async () => group(role), requireActive: () => {} } as never,
      repo as never,
      runtime,
    );
    const result = await service.create({ id: role === 'owner' ? 'owner' : 'user' }, 'g1', body);
    assert.equal(result.description, 'Dinner');
    assert.equal(result.splitMethod, 'equal');
    assert.deepEqual(
      result.splits.map((x) => x.amountMinor),
      [1000, 1000, 1000],
    );
    assert.equal(result.payments[0]?.memberId, 'm-owner');
    assert.ok(write?.activityId);
    assert.equal(write?.actorUserId, role === 'owner' ? 'owner' : 'user');
  }
});
test('payer and participant must be active members of the same Group', async () => {
  const repo = { listMembers: async () => members, createExpense: async () => assert.fail() };
  const service = new SplitExpensesService(
    { access: async () => group(), requireActive: () => {} } as never,
    repo as never,
    runtime,
  );
  assert.equal(
    await code(() =>
      service.create({ id: 'owner' }, 'g1', {
        ...body,
        payments: [{ memberId: 'foreign', amountMinor: 3000 }],
      }),
    ),
    'SPLIT_PAYER_INVALID',
  );
  assert.equal(
    await code(() =>
      service.create({ id: 'owner' }, 'g1', {
        ...body,
        split: { method: 'equal', participants: ['m-owner', 'removed'] },
      }),
    ),
    'SPLIT_PARTICIPANT_INVALID',
  );
});
test('archived Group rejects Expense mutation', async () => {
  const service = new SplitExpensesService(
    {
      access: async () => group('owner', 'archived'),
      requireActive: (a: ReturnType<typeof group>) => {
        if (a.group.status === 'archived')
          throw Object.assign(new Error(), {
            getResponse: () => ({ error: { code: 'SPLIT_GROUP_ARCHIVED' } }),
          });
      },
    } as never,
    {} as never,
    runtime,
  );
  assert.equal(
    await code(() => service.create({ id: 'owner' }, 'g1', body)),
    'SPLIT_GROUP_ARCHIVED',
  );
});
test('member edits and deletes only own Expense while owner may change any', async () => {
  const expense = {
    id: 'e1',
    groupId: 'g1',
    description: 'Dinner',
    categoryKey: 'food',
    splitMethod: 'equal',
    originalAmountMinor: 3000,
    originalCurrency: 'MYR',
    baseAmountMinor: 3000,
    baseCurrency: 'MYR',
    exchangeRate: '1',
    expenseDate: '2026-12-12',
    note: null,
    createdByUserId: 'other',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedByUserId: null,
    payments: [],
    splits: [],
  } as SplitExpense;
  const repo = { findExpense: async () => expense, deleteExpense: async () => expense };
  const memberService = new SplitExpensesService(
    { access: async () => group('member'), requireActive: () => {} } as never,
    repo as never,
    runtime,
  );
  assert.equal(
    await code(() => memberService.delete('user', 'g1', 'e1')),
    'SPLIT_EXPENSE_FORBIDDEN',
  );
  const ownerService = new SplitExpensesService(
    { access: async () => group(), requireActive: () => {} } as never,
    repo as never,
    runtime,
  );
  assert.equal((await ownerService.delete('owner', 'g1', 'e1')).id, 'e1');
});
test('normal reads exclude missing or soft-deleted Expense through repository boundary', async () => {
  const service = new SplitExpensesService(
    { access: async () => group() } as never,
    { searchExpenses: async () => [], findExpense: async () => undefined } as never,
    runtime,
  );
  assert.deepEqual(await service.list('owner', 'g1'), {items:[],nextCursor:null});
  assert.equal(await code(() => service.get('owner', 'g1', 'deleted')), 'SPLIT_EXPENSE_NOT_FOUND');
});
test('member edits an own Expense and repository receives the actual activity actor', async () => {
  const own = {
    id: 'e-own',
    groupId: 'g1',
    description: 'Dinner',
    categoryKey: 'food',
    splitMethod: 'equal',
    originalAmountMinor: 3000,
    originalCurrency: 'MYR',
    baseAmountMinor: 3000,
    baseCurrency: 'MYR',
    exchangeRate: '1',
    expenseDate: '2026-12-12',
    note: null,
    createdByUserId: 'user',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedByUserId: null,
    payments: [
      {
        id: 'p',
        expenseId: 'e-own',
        groupId: 'g1',
        memberId: 'm-user',
        amountMinor: 3000,
        createdAt: now,
      },
    ],
    splits: [
      {
        id: 's',
        expenseId: 'e-own',
        groupId: 'g1',
        memberId: 'm-user',
        amountMinor: 3000,
        createdAt: now,
      },
    ],
  } as SplitExpense;
  let actor = '';
  const repo = {
    findExpense: async () => own,
    listMembers: async () => members,
    updateExpense: async (w: { expense: SplitExpense; actorUserId: string }) => {
      actor = w.actorUserId;
      return w.expense;
    },
  };
  const service = new SplitExpensesService(
    { access: async () => group('member'), requireActive: () => {} } as never,
    repo as never,
    runtime,
  );
  const updated = await service.update({ id: 'user' }, 'g1', 'e-own', { description: 'Lunch' });
  assert.equal(updated.description, 'Lunch');
  assert.equal(actor, 'user');
});
test('payment and exact allocation totals return stable domain errors', async () => {
  const service = new SplitExpensesService(
    { access: async () => group(), requireActive: () => {} } as never,
    { listMembers: async () => members } as never,
    runtime,
  );
  assert.equal(
    await code(() =>
      service.create({ id: 'owner' }, 'g1', {
        ...body,
        payments: [{ memberId: 'm-owner', amountMinor: 2999 }],
      }),
    ),
    'SPLIT_PAYMENT_TOTAL_INVALID',
  );
  assert.equal(
    await code(() =>
      service.create({ id: 'owner' }, 'g1', {
        ...body,
        split: { method: 'exact', allocations: [{ memberId: 'm-owner', amountMinor: 2999 }] },
      }),
    ),
    'SPLIT_ALLOCATION_INVALID',
  );
});
test('expense search forwards combined filters and returns a stable cursor page', async () => {
  const rows=Array.from({length:31},(_,index)=>({id:`e-${index}`,createdAt:new Date(2026,0,1,0,0,99-index)}));
  let query:Record<string,unknown>={};
  const service=new SplitExpensesService(
    {access:async()=>group()} as never,
    {searchExpenses:async(_groupId:string,value:Record<string,unknown>)=>{query=value;return rows;}} as never,
    runtime,
  );
  const page=await service.list('owner','g1',{search:' dinner ',category:'food',currency:'MYR',payerId:'m-owner',memberId:'m-user',from:'2026-01-01',to:'2026-12-31'});
  assert.equal(query.search,'dinner');
  assert.equal(query.limit,31);
  assert.equal(page.items.length,30);
  assert.ok(page.nextCursor);
});
