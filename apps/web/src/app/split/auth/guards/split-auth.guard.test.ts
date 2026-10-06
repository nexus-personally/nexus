import assert from 'node:assert/strict';
import test from 'node:test';
import { safeSplitReturnUrl, splitRouteAccess } from './split-route-access';

test('unauthenticated Split groups access redirects to login with returnUrl', () => {
  assert.equal(
    splitRouteAccess(false, '/split/groups'),
    '/split/login?returnUrl=%2Fsplit%2Fgroups',
  );
});

test('authenticated Split groups access is allowed', () => {
  assert.equal(splitRouteAccess(true, '/split/groups'), true);
});

test('returnUrl rejects destinations outside Split', () => {
  assert.equal(safeSplitReturnUrl('https://evil.example'), '/split/groups');
  assert.equal(safeSplitReturnUrl('//evil.example'), '/split/groups');
  assert.equal(safeSplitReturnUrl('/resume'), '/split/groups');
});
