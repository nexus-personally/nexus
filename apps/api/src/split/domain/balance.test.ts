import assert from 'node:assert/strict';
import test from 'node:test';
import { applySettlements, applySettlementsToDebts, calculateBalances, simplifyBalances, toBaseLines } from './balance.js';

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

test('partial settlement reduces the matching direct debt instead of leaving the original amount', () => {
  assert.deepEqual(
    applySettlementsToDebts(
      [{ fromMemberId: 'john', toMemberId: 'samuel', amountMinor: 800 }],
      [{ fromMemberId: 'john', toMemberId: 'samuel', amountMinor: 300 }],
      [
        { memberId: 'john', amountMinor: -500 },
        { memberId: 'samuel', amountMinor: 500 },
      ],
    ),
    [{ fromMemberId: 'john', toMemberId: 'samuel', amountMinor: 500 }],
  );
});

test('simplified settlement consumes a deterministic path through direct debts', () => {
  assert.deepEqual(
    applySettlementsToDebts(
      [
        { fromMemberId: 'a', toMemberId: 'b', amountMinor: 500 },
        { fromMemberId: 'b', toMemberId: 'c', amountMinor: 500 },
      ],
      [{ fromMemberId: 'a', toMemberId: 'c', amountMinor: 300 }],
      [
        { memberId: 'a', amountMinor: -200 },
        { memberId: 'b', amountMinor: 0 },
        { memberId: 'c', amountMinor: 200 },
      ],
    ),
    [
      { fromMemberId: 'a', toMemberId: 'b', amountMinor: 200 },
      { fromMemberId: 'b', toMemberId: 'c', amountMinor: 200 },
    ],
  );
});

test('settlement path reduction preserves every member net balance, including debt cycles', () => {
  const debts = [
    { fromMemberId: 'a', toMemberId: 'b', amountMinor: 100 },
    { fromMemberId: 'b', toMemberId: 'c', amountMinor: 100 },
    { fromMemberId: 'c', toMemberId: 'a', amountMinor: 100 },
  ];
  const initial = [
    { memberId: 'a', amountMinor: 0 },
    { memberId: 'b', amountMinor: 0 },
    { memberId: 'c', amountMinor: 0 },
  ];
  const settlement = [{ fromMemberId: 'a', toMemberId: 'b', amountMinor: 40 }];
  const afterSettlement = applySettlements(initial, settlement);
  const remainingDebts = applySettlementsToDebts(debts, settlement, afterSettlement);
  const reconstructed = initial.map(({ memberId }) => ({
    memberId,
    amountMinor: remainingDebts.reduce((balance, debt) =>
      balance + (debt.toMemberId === memberId ? debt.amountMinor : 0) -
      (debt.fromMemberId === memberId ? debt.amountMinor : 0), 0),
  }));
  assert.deepEqual(reconstructed, afterSettlement);
});

test('a simplified settlement without an exact direct-debt path falls back to true remaining balances', () => {
  const directDebts = [
    { fromMemberId: 'd1', toMemberId: 'c2', amountMinor: 100 },
    { fromMemberId: 'd2', toMemberId: 'c1', amountMinor: 100 },
  ];
  const settledBalances = [
    { memberId: 'd1', amountMinor: 0 },
    { memberId: 'd2', amountMinor: -100 },
    { memberId: 'c1', amountMinor: 0 },
    { memberId: 'c2', amountMinor: 100 },
  ];
  assert.deepEqual(
    applySettlementsToDebts(
      directDebts,
      [{ fromMemberId: 'd1', toMemberId: 'c1', amountMinor: 100 }],
      settledBalances,
    ),
    [{ fromMemberId: 'd2', toMemberId: 'c2', amountMinor: 100 }],
  );
});

test('balance accumulation rejects values beyond JavaScript safe integer precision', () => {
  assert.throws(
    () => calculateBalances(['payer'], [
      { payments: [['payer', Number.MAX_SAFE_INTEGER]], splits: [] },
      { payments: [['payer', 1]], splits: [] },
    ]),
    (error: unknown) => error instanceof Error && 'getResponse' in error &&
      JSON.stringify((error as { getResponse: () => unknown }).getResponse()).includes('SPLIT_BALANCE_RANGE_EXCEEDED'),
  );
});

test('base-currency allocation uses deterministic remainder cents and conserves the expense total', () => {
  assert.deepEqual(
    toBaseLines([
      { memberId: 'a', amountMinor: 1 },
      { memberId: 'b', amountMinor: 1 },
      { memberId: 'c', amountMinor: 1 },
    ], 3, 2),
    [['a', 1], ['b', 1], ['c', 0]],
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
