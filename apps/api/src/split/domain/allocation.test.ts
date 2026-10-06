import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocateEqual,
  allocateExact,
  allocatePercentage,
  allocateShares,
  validatePaymentTotal,
} from './allocation.js';
import { convertMinorAmount, currencyPrecision, parseMinorAmount } from './money.js';

test('currency precision supports JPY zero-decimal and MYR two-decimal money', () => {
  assert.equal(currencyPrecision('JPY'), 0);
  assert.equal(currencyPrecision('MYR'), 2);
  assert.equal(parseMinorAmount('30.55', 'MYR'), 3055);
  assert.equal(parseMinorAmount('50', 'JPY'), 50);
});
test('equal allocation handles RM30 / 3 and a single minor unit', () => {
  assert.deepEqual(
    allocateEqual(3000, ['samuel', 'john', 'amy']).map((x) => x.amountMinor),
    [1000, 1000, 1000],
  );
  assert.deepEqual(
    allocateEqual(1, ['samuel']).map((x) => x.amountMinor),
    [1],
  );
});
test('equal allocation distributes RM10 remainder in stable participant order', () => {
  const expected = [334, 333, 333];
  assert.deepEqual(
    allocateEqual(1000, ['samuel', 'john', 'amy']).map((x) => x.amountMinor),
    expected,
  );
  assert.deepEqual(
    allocateEqual(1000, ['samuel', 'john', 'amy']).map((x) => x.amountMinor),
    expected,
  );
});
test('exact allocation must equal the expense total', () => {
  assert.deepEqual(
    allocateExact(10000, [
      ['samuel', 2000],
      ['john', 3000],
      ['amy', 5000],
    ]).map((x) => x.amountMinor),
    [2000, 3000, 5000],
  );
  assert.throws(
    () =>
      allocateExact(10000, [
        ['samuel', 2000],
        ['john', 3000],
        ['amy', 4000],
      ]),
    /SPLIT_ALLOCATION_INVALID/,
  );
});
test('percentage allocation uses integer basis points and deterministic rounding', () => {
  assert.deepEqual(
    allocatePercentage(20000, [
      ['samuel', 2500],
      ['john', 2500],
      ['amy', 5000],
    ]).map((x) => x.amountMinor),
    [5000, 5000, 10000],
  );
  assert.deepEqual(
    allocatePercentage(1000, [
      ['a', 3334],
      ['b', 3333],
      ['c', 3333],
    ]).map((x) => x.amountMinor),
    [334, 333, 333],
  );
  assert.throws(
    () =>
      allocatePercentage(1000, [
        ['a', 5000],
        ['b', 4000],
      ]),
    /SPLIT_ALLOCATION_INVALID/,
  );
});
test('shares allocation accepts positive integers and preserves the total', () => {
  assert.deepEqual(
    allocateShares(20000, [
      ['samuel', 1],
      ['john', 1],
      ['amy', 2],
    ]).map((x) => x.amountMinor),
    [5000, 5000, 10000],
  );
  assert.throws(() => allocateShares(100, [['a', 0]]), /SPLIT_ALLOCATION_INVALID/);
});
test('payer need not participate and multiple payments must independently equal total', () => {
  assert.doesNotThrow(() =>
    validatePaymentTotal(10000, [
      ['samuel', 6000],
      ['john', 4000],
    ]),
  );
  assert.deepEqual(
    allocateEqual(10000, ['john', 'amy']).map((x) => x.memberId),
    ['john', 'amy'],
  );
  assert.throws(
    () =>
      validatePaymentTotal(10000, [
        ['samuel', 6000],
        ['john', 3000],
      ]),
    /SPLIT_PAYMENT_TOTAL_INVALID/,
  );
});
test('explicit foreign exchange conversion respects currency precision', () => {
  assert.equal(convertMinorAmount(10000, 'CNY', 'MYR', '0.582'), 5820);
  assert.equal(convertMinorAmount(1000, 'JPY', 'MYR', '0.03'), 3000);
});
