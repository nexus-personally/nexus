import assert from 'node:assert/strict';
import test from 'node:test';
import { SplitGroupsService } from './groups/split-groups.service.js';
import { SplitMembersService } from './members/split-members.service.js';
import { SplitInvitesService } from './invites/split-invites.service.js';
import { splitTokenHash } from './auth/session/split-session.js';
import type {
  SplitGroupAccess,
  SplitInvite,
  SplitMember,
} from './persistence/split-domain.types.js';

const now = new Date('2026-10-06T00:00:00Z');
let sequence = 0;
const runtime = { now: () => now, uuid: () => `id-${++sequence}`, token: () => 'raw-secret-token' };
const ownerAccess = (status: 'active' | 'archived' = 'active'): SplitGroupAccess => ({
  group: {
    id: 'g1',
    name: 'Trip',
    type: 'travel',
    baseCurrency: 'MYR',
    simplifyDebts: true,
    startDate: null,
    endDate: null,
    status,
    createdByUserId: 'owner',
    createdAt: now,
    updatedAt: now,
  },
  membership: {
    id: 'owner-member',
    groupId: 'g1',
    userId: 'owner',
    displayName: 'Owner',
    role: 'owner',
    membershipStatus: 'active',
    joinedAt: now,
    linkedAt: now,
    createdAt: now,
    updatedAt: now,
  },
});
const memberAccess = (): SplitGroupAccess => ({
  ...ownerAccess(),
  membership: { ...ownerAccess().membership, id: 'member', userId: 'user', role: 'member' },
});
const exceptionCode = async (work: () => Promise<unknown>) => {
  try {
    await work();
    assert.fail('expected exception');
  } catch (error) {
    return (error as { getResponse(): { error: { code: string } } }).getResponse().error.code;
  }
};

test('group reads are membership scoped and owner-only mutations reject members', async () => {
  const repository = {
    findGroupAccess: async (_g: string, u: string) =>
      u === 'missing' ? undefined : u === 'user' ? memberAccess() : ownerAccess(),
    listGroups: async () => [ownerAccess().group],
  };
  const groups = new SplitGroupsService(repository as never, runtime);
  assert.equal((await groups.get('owner', 'g1')).id, 'g1');
  assert.equal(await exceptionCode(() => groups.get('missing', 'g1')), 'SPLIT_GROUP_NOT_FOUND');
  assert.equal(await exceptionCode(() => groups.archive('user', 'g1')), 'SPLIT_GROUP_FORBIDDEN');
});

test('group validation rejects invalid dates and unsupported currency', async () => {
  const groups = new SplitGroupsService(
    { createGroup: async () => assert.fail() } as never,
    runtime,
  );
  assert.equal(
    await exceptionCode(() =>
      groups.create(
        { id: 'owner', displayName: 'Owner' },
        { name: 'Trip', type: 'travel', baseCurrency: 'EUR' },
      ),
    ),
    'VALIDATION_FAILED',
  );
  assert.equal(
    await exceptionCode(() =>
      groups.create(
        { id: 'owner', displayName: 'Owner' },
        { name: 'Trip', type: 'travel', startDate: '2026-10-10', endDate: '2026-10-01' },
      ),
    ),
    'VALIDATION_FAILED',
  );
});

test('owner updates, archives and reopens a group while activity stays repository-transactional', async () => {
  const calls: string[] = [];
  const repository = {
    findGroupAccess: async () => ownerAccess(),
    updateGroup: async (g: unknown) => {
      calls.push('update');
      return g;
    },
    setGroupStatus: async (_g: string, s: string) => {
      calls.push(s);
      return { ...ownerAccess().group, status: s };
    },
  };
  const groups = new SplitGroupsService(repository as never, runtime);
  assert.equal((await groups.update('owner', 'g1', { name: 'New name' })).name, 'New name');
  assert.equal((await groups.archive('owner', 'g1')).status, 'archived');
  const archivedRepository = {
    ...repository,
    findGroupAccess: async () => ownerAccess('archived'),
  };
  assert.equal(
    (await new SplitGroupsService(archivedRepository as never, runtime).reopen('owner', 'g1'))
      .status,
    'active',
  );
  assert.deepEqual(calls, ['update', 'archived', 'active']);
});

test('guest creation derives safe member fields and archived groups are immutable', async () => {
  let created: SplitMember | undefined;
  const repository = {
    createGuest: async (m: SplitMember) => {
      created = m;
      return m;
    },
  };
  const groups = {
    owner: async () => ownerAccess(),
    requireActive: SplitGroupsService.prototype.requireActive,
  };
  const members = new SplitMembersService(groups as never, repository as never, runtime);
  await members.createGuest('owner', 'g1', { displayName: ' Guest ' });
  assert.equal(created?.displayName, 'Guest');
  assert.equal(created?.userId, null);
  assert.equal(created?.role, 'member');
  const archived = new SplitMembersService(
    {
      owner: async () => ownerAccess('archived'),
      requireActive: SplitGroupsService.prototype.requireActive,
    } as never,
    repository as never,
    runtime,
  );
  assert.equal(
    await exceptionCode(() => archived.createGuest('owner', 'g1', { displayName: 'G' })),
    'SPLIT_GROUP_ARCHIVED',
  );
});

test('member removal is group scoped and protects the owner', async () => {
  const owner = ownerAccess().membership;
  const repository = {
    findMember: async (g: string, m: string) =>
      g === 'g1' && m === 'owner-member' ? owner : undefined,
  };
  const members = new SplitMembersService(
    { owner: async () => ownerAccess(), requireActive: () => {} } as never,
    repository as never,
    runtime,
  );
  assert.equal(
    await exceptionCode(() => members.remove('owner', 'g1', 'owner-member')),
    'SPLIT_OWNER_REMOVAL_FORBIDDEN',
  );
  assert.equal(
    await exceptionCode(() => members.remove('owner', 'g1', 'foreign')),
    'SPLIT_MEMBER_NOT_FOUND',
  );
});

test('members can list but cannot create guests', async () => {
  const groups = new SplitGroupsService(
    { findGroupAccess: async () => memberAccess() } as never,
    runtime,
  );
  const members = new SplitMembersService(
    groups,
    { listMembers: async () => [memberAccess().membership] } as never,
    runtime,
  );
  assert.equal((await members.list('user', 'g1')).length, 1);
  assert.equal(
    await exceptionCode(() => members.createGuest('user', 'g1', { displayName: 'Guest' })),
    'SPLIT_GROUP_FORBIDDEN',
  );
});

test('invite creation stores only a hash and returns raw token once', async () => {
  let stored: SplitInvite | undefined;
  const repository = {
    createInvite: async (i: SplitInvite) => {
      stored = i;
      return i;
    },
    findMember: async () => undefined,
  };
  const invites = new SplitInvitesService(
    { owner: async () => ownerAccess(), requireActive: () => {} } as never,
    repository as never,
    runtime,
  );
  const result = await invites.create('owner', 'g1', {});
  assert.equal(result.token, 'raw-secret-token');
  assert.equal(stored?.tokenHash, splitTokenHash('raw-secret-token'));
  assert.notEqual(stored?.tokenHash, result.token);
  assert.equal(result.expiresAt.getTime() - now.getTime(), 7 * 24 * 60 * 60 * 1000);
});

test('invite listings never expose token hashes and preview returns safe data', async () => {
  const invite: SplitInvite = {
    id: 'i1',
    groupId: 'g1',
    targetMemberId: null,
    tokenHash: 'secret-hash',
    createdByUserId: 'owner',
    expiresAt: new Date(now.getTime() + 1000),
    claimedAt: null,
    claimedByUserId: null,
    revokedAt: null,
    createdAt: now,
  };
  const repository = {
    listInvites: async () => [invite],
    previewInvite: async () => ({
      state: 'valid' as const,
      preview: {
        groupName: 'Trip',
        groupType: 'travel' as const,
        targetDisplayName: null,
        expiresAt: invite.expiresAt,
      },
    }),
  };
  const service = new SplitInvitesService(
    { owner: async () => ownerAccess(), requireActive: () => {} } as never,
    repository as never,
    runtime,
  );
  const listed = await service.list('owner', 'g1');
  assert.equal('tokenHash' in listed[0]!, false);
  assert.deepEqual(Object.keys(await service.preview('raw')).sort(), [
    'expiresAt',
    'groupName',
    'groupType',
    'targetDisplayName',
  ]);
});

test('claim maps duplicate, expired, revoked, claimed, invalid target and archived states', async () => {
  for (const [status, code] of [
    ['member_exists', 'SPLIT_MEMBER_ALREADY_EXISTS'],
    ['expired', 'SPLIT_INVITE_EXPIRED'],
    ['revoked', 'SPLIT_INVITE_REVOKED'],
    ['already_claimed', 'SPLIT_INVITE_ALREADY_CLAIMED'],
    ['target_invalid', 'SPLIT_INVITE_TARGET_INVALID'],
    ['group_archived', 'SPLIT_GROUP_ARCHIVED'],
  ] as const) {
    const service = new SplitInvitesService(
      {} as never,
      { claimInvite: async () => ({ status }) } as never,
      runtime,
    );
    assert.equal(
      await exceptionCode(() => service.claim({ id: 'u2', displayName: 'Joiner' }, 'raw')),
      code,
    );
  }
});

test('successful claim returns the persistent member identity', async () => {
  const service = new SplitInvitesService(
    {} as never,
    {
      claimInvite: async () => ({ status: 'claimed', groupId: 'g1', memberId: 'guest-id' }),
    } as never,
    runtime,
  );
  assert.deepEqual(await service.claim({ id: 'u2', displayName: 'Joiner' }, 'raw'), {
    status: 'claimed',
    groupId: 'g1',
    memberId: 'guest-id',
  });
});

test('only owners can create invites and revocation is a soft timestamp mutation', async () => {
  const memberGroups = new SplitGroupsService(
    { findGroupAccess: async () => memberAccess() } as never,
    runtime,
  );
  const denied = new SplitInvitesService(memberGroups, {} as never, runtime);
  assert.equal(await exceptionCode(() => denied.create('user', 'g1', {})), 'SPLIT_GROUP_FORBIDDEN');
  const invite: SplitInvite = {
    id: 'i1',
    groupId: 'g1',
    targetMemberId: null,
    tokenHash: 'hash',
    createdByUserId: 'owner',
    expiresAt: new Date(now.getTime() + 1000),
    claimedAt: null,
    claimedByUserId: null,
    revokedAt: now,
    createdAt: now,
  };
  const allowed = new SplitInvitesService(
    { owner: async () => ownerAccess(), requireActive: () => {} } as never,
    { revokeInvite: async () => invite } as never,
    runtime,
  );
  const result = await allowed.revoke('owner', 'g1', 'i1');
  assert.equal(result.revokedAt, now);
  assert.equal('tokenHash' in result, false);
});

test('removed membership loses group access', async () => {
  const groups = new SplitGroupsService(
    { findGroupAccess: async () => undefined } as never,
    runtime,
  );
  assert.equal(
    await exceptionCode(() => groups.get('removed-user', 'g1')),
    'SPLIT_GROUP_NOT_FOUND',
  );
});
