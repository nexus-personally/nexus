import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocationPreview,
  canManageExpense,
  activityText,
  expensePayload,
  parseExpenseAmount,
  validateExpenseDraft,
  type SplitExpenseDraft,
} from './split-expense.models';

const draft = (): SplitExpenseDraft => ({
  description: 'Dinner',
  categoryKey: 'food',
  amount: '10.00',
  currency: 'MYR',
  baseCurrency: 'MYR',
  exchangeRate: '',
  expenseDate: '2026-12-12',
  note: '',
  payments: [{ memberId: 'samuel', amount: '10.00' }],
  participantIds: ['john', 'amy', 'samuel'],
  method: 'equal',
  allocations: {},
});

test('activity renders readable historical expense language from safe metadata',()=>{
  assert.equal(activityText({id:'a',actorUserId:'u',actionType:'EXPENSE_DELETED',entityType:'expense',entityId:'e',metadata:{description:'Dinner'},createdAt:''},'Samuel'),'Samuel deleted Dinner');
});

test('payload preserves frontend intent while backend remains allocation authority', () => {
  const value = draft();
  const payload = expensePayload(value);
  assert.equal(payload.amountMinor, 1000);
  assert.deepEqual(payload.split, { method: 'equal', participants: ['john', 'amy', 'samuel'] });
  assert.deepEqual(payload.payments, [{ memberId: 'samuel', amountMinor: 1000 }]);
});

test('expense controls follow owner, creator and archive permissions', () => {
  assert.equal(canManageExpense('active', 'owner', 'owner', 'member'), true);
  assert.equal(canManageExpense('active', 'member', 'creator', 'creator'), true);
  assert.equal(canManageExpense('active', 'member', 'other', 'creator'), false);
  assert.equal(canManageExpense('archived', 'owner', 'owner', 'owner'), false);
});

test('amount parsing respects currency precision without binary floating point', () => {
  assert.equal(parseExpenseAmount('30.55', 'MYR'), 3055);
  assert.equal(parseExpenseAmount('500', 'JPY'), 500);
  assert.equal(parseExpenseAmount('500.1', 'JPY'), null);
  assert.equal(parseExpenseAmount('0.001', 'MYR'), null);
});

test('equal preview distributes minor-unit remainder in stable participant order', () => {
  assert.deepEqual(allocationPreview(draft()), [
    { memberId: 'john', amountMinor: 334 },
    { memberId: 'amy', amountMinor: 333 },
    { memberId: 'samuel', amountMinor: 333 },
  ]);
});

test('draft validation independently checks payer and exact allocation totals', () => {
  const value = draft();
  value.method = 'exact';
  value.allocations = { john: '3.00', amy: '3.00', samuel: '3.00' };
  assert.equal(validateExpenseDraft(value).payments, undefined);
  assert.equal(validateExpenseDraft(value).split, 'Split allocations must total MYR 10.00.');
});

test('percentage and shares previews are deterministic and payer need not participate', () => {
  const value = draft();
  value.payments = [{ memberId: 'payer-only', amount: '10.00' }];
  value.participantIds = ['john', 'amy'];
  value.method = 'percentage';
  value.allocations = { john: '33.33', amy: '66.67' };
  assert.deepEqual(allocationPreview(value), [
    { memberId: 'john', amountMinor: 334 },
    { memberId: 'amy', amountMinor: 666 },
  ]);
  value.method = 'shares';
  value.allocations = { john: '1', amy: '2' };
  assert.deepEqual(allocationPreview(value), [
    { memberId: 'john', amountMinor: 334 },
    { memberId: 'amy', amountMinor: 666 },
  ]);
});
