import assert from 'node:assert/strict';
import test from 'node:test';
import { splitLandingDestination } from './auth/guards/split-route-access';
import { activeMembers, inviteReturnUrl, validateGroupDraft } from './data-access/split.models';
test('/split sends authenticated users to groups and anonymous users to login', () => {
  assert.equal(splitLandingDestination(true), '/split/groups');
  assert.equal(splitLandingDestination(false), '/split/login');
});
test('create group validates required name and date order', () => {
  const errors = validateGroupDraft({
    name: ' ',
    type: 'travel',
    baseCurrency: 'MYR',
    startDate: '2026-12-17',
    endDate: '2026-12-10',
  });
  assert.equal(errors['name'], '请输入群组名称。');
  assert.equal(errors['endDate'], '结束日期必须晚于或等于开始日期。');
});
test('members view omits removed history by default', () => {
  const base = {
    groupId: 'g',
    userId: null,
    displayName: 'Guest',
    role: 'member' as const,
    joinedAt: '',
    linkedAt: null,
  };
  assert.deepEqual(
    activeMembers([
      { ...base, id: 'a', membershipStatus: 'active' },
      { ...base, id: 'r', membershipStatus: 'removed' },
    ]).map((x) => x.id),
    ['a'],
  );
});
test('anonymous invite login preserves the public invite route', () =>
  assert.equal(
    inviteReturnUrl('safe-token'),
    '/split/login?returnUrl=%2Fsplit%2Finvite%2Fsafe-token',
  ));
