import assert from 'node:assert/strict';
import test from 'node:test';
import { validateExpenseInput } from './split-expense.validation.js';

const input = (participants: string[]) => ({
  description: 'Lunch',
  categoryKey: 'food',
  amountMinor: 5000,
  currency: 'MYR',
  expenseDate: '2026-10-14',
  payments: [{ memberId: 'payer', amountMinor: 5000 }],
  split: { method: 'single', participants },
});

test('single split assigns the complete expense amount to one member', () => {
  const result = validateExpenseInput(input(['debtor']), 'MYR');

  assert.equal(result.splitMethod, 'single');
  assert.deepEqual(result.allocations, [{ memberId: 'debtor', amountMinor: 5000 }]);
});

test('single split rejects zero or multiple selected members', () => {
  assert.throws(() => validateExpenseInput(input([]), 'MYR'));
  assert.throws(() => validateExpenseInput(input(['debtor', 'other']), 'MYR'));
});
