import assert from 'node:assert/strict';
import test from 'node:test';
import { splitClaimMembershipPlan } from './split-membership-lifecycle.js';
test('removed registered member rejoins a generic invite with the original member id', () =>
  assert.deepEqual(
    splitClaimMembershipPlan({ id: 'member-original', membershipStatus: 'removed' }, false),
    { kind: 'reactivate', memberId: 'member-original' },
  ));
test('left registered member also reactivates instead of duplicating history', () =>
  assert.deepEqual(
    splitClaimMembershipPlan({ id: 'member-original', membershipStatus: 'left' }, false),
    { kind: 'reactivate', memberId: 'member-original' },
  ));
test('active member duplicate claim is rejected', () =>
  assert.deepEqual(
    splitClaimMembershipPlan({ id: 'member-original', membershipStatus: 'active' }, false),
    { kind: 'conflict' },
  ));
test('targeted guest claim rejects any other existing membership identity', () =>
  assert.deepEqual(
    splitClaimMembershipPlan({ id: 'member-original', membershipStatus: 'removed' }, true),
    { kind: 'conflict' },
  ));
