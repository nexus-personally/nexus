import assert from 'node:assert/strict';
import test from 'node:test';
import { applySettlements, calculateBalances, simplifyBalances } from './balance.js';

test('acceptance example derives exact net balances from payments minus shares', () => {
  const result = calculateBalances(
    ['samuel', 'john', 'amy'],
    [
      { payments: [['samuel', 3000]], splits: [['samuel', 1000], ['john', 1000], ['amy', 1000]] },
      { payments: [['john', 300]], splits: [['samuel', 100], ['john', 100], ['amy', 100]] },
    ],
  );
  assert.deepEqual(result.memberBalances, [
    { memberId: 'samuel', amountMinor: 1900 },
    { memberId: 'john', amountMinor: -800 },
    { memberId: 'amy', amountMinor: -1100 },
  ]);
  assert.deepEqual(simplifyBalances(result.memberBalances), [
    { fromMemberId: 'john', toMemberId: 'samuel', amountMinor: 800 },
    { fromMemberId: 'amy', toMemberId: 'samuel', amountMinor: 1100 },
  ]);
});

test('partial settlement applies outgoing credit and incoming debit signs', () => {
  assert.deepEqual(
    applySettlements(
      [
        { memberId: 'samuel', amountMinor: 1900 },
        { memberId: 'john', amountMinor: -800 },
        { memberId: 'amy', amountMinor: -1100 },
      ],
      [{ fromMemberId: 'john', toMemberId: 'samuel', amountMinor: 500 }],
    ),
    [
      { memberId: 'samuel', amountMinor: 1400 },
      { memberId: 'john', amountMinor: -300 },
      { memberId: 'amy', amountMinor: -1100 },
    ],
  );
});

test('multiple payers and payer-not-participant preserve a zero-sum ledger', () => {
  const result = calculateBalances(['payer', 'john', 'amy'], [
    { payments: [['payer', 6000], ['john', 4000]], splits: [['john', 5000], ['amy', 5000]] },
  ]);
  assert.equal(result.memberBalances.reduce((sum, row) => sum + row.amountMinor, 0), 0);
  assert.deepEqual(result.memberBalances, [
    { memberId: 'payer', amountMinor: 6000 },
    { memberId: 'john', amountMinor: -1000 },
    { memberId: 'amy', amountMinor: -5000 },
  ]);
});

test('simplification uses stable member order for ties and ignores zero balances', () => {
  assert.deepEqual(
    simplifyBalances([
      { memberId: 'credit-a', amountMinor: 500 },
      { memberId: 'credit-b', amountMinor: 500 },
      { memberId: 'debt-a', amountMinor: -500 },
      { memberId: 'debt-b', amountMinor: -500 },
      { memberId: 'zero', amountMinor: 0 },
    ]),
    [
      { fromMemberId: 'debt-a', toMemberId: 'credit-a', amountMinor: 500 },
      { fromMemberId: 'debt-b', toMemberId: 'credit-b', amountMinor: 500 },
    ],
  );
});
