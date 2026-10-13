import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { splitLandingDestination } from './auth/guards/split-route-access';
import { activeMembers, inviteReturnUrl, validateGroupDraft } from './data-access/split.models';
import { splitAmountSizeClass, splitRemainingPercent } from './data-access/split-dashboard.models';
test('/split sends authenticated users to home and anonymous users to login', () => {
  assert.equal(splitLandingDestination(true), '/split/home');
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

test('home balance progress represents money remaining and amount text scales by length', () => {
  assert.equal(splitRemainingPercent(14_000_00, 14_000_00), 100);
  assert.equal(splitRemainingPercent(3_000_00, 6_000_00), 50);
  assert.equal(splitRemainingPercent(-200_00, 6_000_00), 0);
  assert.equal(splitAmountSizeClass(900_00), 'amount-large');
  assert.equal(splitAmountSizeClass(14_000_00), 'amount-medium');
  assert.equal(splitAmountSizeClass(1_400_000_00), 'amount-small');
});

test('mobile bottom sheets keep scrollable content above browser chrome and safe areas', () => {
  const styles = readFileSync(new URL('./ui/split-ui.scss', import.meta.url), 'utf8');
  assert.match(styles, /--split-browser-bottom-clearance:\s*clamp\(/);
  assert.match(
    styles,
    /padding-bottom:\s*calc\(max\([^;]*safe-area-inset-bottom[^;]*\)\s*\+\s*var\(--split-browser-bottom-clearance\)\)/,
  );
  assert.match(styles, /scroll-padding-bottom:\s*var\(--split-browser-bottom-clearance\)/);
});

test('dashboard amounts keep a single responsive line with reserved right-side space', () => {
  const styles = readFileSync(new URL('./pages/split-home.component.scss', import.meta.url), 'utf8');
  assert.match(styles, /\.balance-amount\s*\{[^}]*max-width:calc\(100%\s*-\s*24px\)/s);
  assert.match(styles, /\.balance-amount\s*\{[^}]*overflow:visible/s);
  assert.doesNotMatch(styles, /\.balance-amount\s*\{[^}]*overflow:hidden/s);
  assert.match(styles, /\.balance-amount\.amount-large\s*\{\s*font-size:clamp\(40px,9\.7vw,52px\)/);
  assert.match(styles, /\.balance-amount\.amount-medium\s*\{\s*font-size:clamp\(40px,9\.7vw,52px\)/);
});

