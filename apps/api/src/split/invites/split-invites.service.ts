import { Inject, Injectable } from '@nestjs/common';
import type { SplitCurrentUser } from '../auth/split-auth.types.js';
import { splitTokenHash } from '../auth/session/split-session.js';
import { SplitGroupsService } from '../groups/split-groups.service.js';
import {
  SPLIT_DOMAIN_RUNTIME,
  SPLIT_REPOSITORY,
  type SplitDomainRuntime,
  type SplitRepository,
} from '../persistence/split.repository.js';
import { splitConflict, splitInvalid, splitNotFound } from '../split-errors.js';
const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const publicInvite = (i: Awaited<ReturnType<SplitRepository['createInvite']>>) => ({
  id: i.id,
  groupId: i.groupId,
  targetMemberId: i.targetMemberId,
  createdByUserId: i.createdByUserId,
  expiresAt: i.expiresAt,
  claimedAt: i.claimedAt,
  claimedByUserId: i.claimedByUserId,
  revokedAt: i.revokedAt,
  createdAt: i.createdAt,
});
@Injectable()
export class SplitInvitesService {
  constructor(
    private readonly groups: SplitGroupsService,
    @Inject(SPLIT_REPOSITORY) private readonly repository: SplitRepository,
    @Inject(SPLIT_DOMAIN_RUNTIME) private readonly runtime: SplitDomainRuntime,
  ) {}
  async create(userId: string, groupId: string, body: unknown) {
    const access = await this.groups.owner(userId, groupId);
    this.groups.requireActive(access);
    const value = body ?? {};
    if (typeof value !== 'object' || Array.isArray(value))
      splitInvalid({ request: ['Only targetMemberId is accepted.'] });
    if (Object.keys(value).some((k) => k !== 'targetMemberId'))
      splitInvalid({ request: ['Only targetMemberId is accepted.'] });
    const target = (value as { targetMemberId?: unknown }).targetMemberId;
    if (target !== undefined && target !== null && typeof target !== 'string')
      splitInvalid({ targetMemberId: ['Must be a member ID or null.'] });
    if (typeof target === 'string') {
      const m = await this.repository.findMember(groupId, target);
      if (!m || m.userId || m.membershipStatus !== 'active')
        splitConflict(
          'SPLIT_INVITE_TARGET_INVALID',
          'Invite target must be an active guest in this group.',
        );
    }
    const now = this.runtime.now(),
      token = this.runtime.token();
    const saved = await this.repository.createInvite(
      {
        id: this.runtime.uuid(),
        groupId,
        targetMemberId: typeof target === 'string' ? target : null,
        tokenHash: splitTokenHash(token),
        createdByUserId: userId,
        expiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS),
        claimedAt: null,
        claimedByUserId: null,
        revokedAt: null,
        createdAt: now,
      },
      userId,
    );
    return { ...publicInvite(saved), token };
  }
  async list(userId: string, groupId: string) {
    await this.groups.owner(userId, groupId);
    return (await this.repository.listInvites(groupId)).map(publicInvite);
  }
  async revoke(userId: string, groupId: string, inviteId: string) {
    const access = await this.groups.owner(userId, groupId);
    this.groups.requireActive(access);
    const result = await this.repository.revokeInvite(
      groupId,
      inviteId,
      userId,
      this.runtime.now(),
    );
    return result
      ? publicInvite(result)
      : splitNotFound('SPLIT_INVITE_NOT_FOUND', 'Invite not found.');
  }
  async preview(token: string) {
    const result = await this.repository.previewInvite(splitTokenHash(token), this.runtime.now());
    if (result.state !== 'valid') {
      const codes = {
        not_found: ['SPLIT_INVITE_NOT_FOUND', 'Invite not found.'],
        expired: ['SPLIT_INVITE_EXPIRED', 'Invite has expired.'],
        revoked: ['SPLIT_INVITE_REVOKED', 'Invite has been revoked.'],
        claimed: ['SPLIT_INVITE_ALREADY_CLAIMED', 'Invite was already claimed.'],
      } as const;
      const [code, message] = codes[result.state];
      return splitNotFound(code, message);
    }
    return result.preview;
  }
  async claim(user: Pick<SplitCurrentUser, 'id' | 'displayName'>, token: string) {
    const result = await this.repository.claimInvite({
      tokenHash: splitTokenHash(token),
      userId: user.id,
      displayName: user.displayName,
      memberId: this.runtime.uuid(),
      activityIds: [this.runtime.uuid(), this.runtime.uuid()],
      now: this.runtime.now(),
    });
    if (result.status === 'claimed') return result;
    const errors: Record<Exclude<typeof result.status, 'claimed'>, [string, string]> = {
      not_found: ['SPLIT_INVITE_NOT_FOUND', 'Invite not found.'],
      expired: ['SPLIT_INVITE_EXPIRED', 'Invite has expired.'],
      revoked: ['SPLIT_INVITE_REVOKED', 'Invite has been revoked.'],
      already_claimed: ['SPLIT_INVITE_ALREADY_CLAIMED', 'Invite was already claimed.'],
      member_exists: ['SPLIT_MEMBER_ALREADY_EXISTS', 'You are already a member of this group.'],
      target_invalid: ['SPLIT_INVITE_TARGET_INVALID', 'The target guest is no longer available.'],
      group_archived: ['SPLIT_GROUP_ARCHIVED', 'Archived groups cannot accept invites.'],
    };
    const [code, message] = errors[result.status];
    return result.status === 'not_found'
      ? splitNotFound(code, message)
      : splitConflict(code, message);
  }
}
