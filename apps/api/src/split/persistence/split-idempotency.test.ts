import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdempotencyCommand } from './split-idempotency.js';

const errorCode = (work: () => unknown) => {
  try { work(); assert.fail('Expected validation to fail.'); }
  catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    return (error as { getResponse(): { error: { code: string } } }).getResponse().error.code;
  }
};

test('same JSON request hashes identically regardless of object property order', () => {
  const left = createIdempotencyCommand('user', 'split.expense.create:group', 'request-key-000001', {
    amountMinor: 123, details: { note: 'lunch', kind: 'food' },
  });
  const right = createIdempotencyCommand('user', 'split.expense.create:group', 'request-key-000001', {
    details: { kind: 'food', note: 'lunch' }, amountMinor: 123,
  });
  assert.equal(left.requestHash, right.requestHash);
});

test('idempotency keys are required and bounded to the supported header format', () => {
  const request = { amountMinor: 10 };
  assert.equal(errorCode(() => createIdempotencyCommand('user', 'operation', undefined, request)), 'SPLIT_IDEMPOTENCY_KEY_INVALID');
  assert.equal(errorCode(() => createIdempotencyCommand('user', 'operation', 'too-short', request)), 'SPLIT_IDEMPOTENCY_KEY_INVALID');
});
