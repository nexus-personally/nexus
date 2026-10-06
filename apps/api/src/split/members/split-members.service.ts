import { Inject, Injectable } from '@nestjs/common';
import {
  SPLIT_DOMAIN_RUNTIME,
  SPLIT_REPOSITORY,
  type SplitDomainRuntime,
  type SplitRepository,
} from '../persistence/split.repository.js';
import { splitConflict, splitInvalid, splitNotFound } from '../split-errors.js';
import { SplitGroupsService } from '../groups/split-groups.service.js';

@Injectable()
export class SplitMembersService {
  constructor(
    private readonly groups: SplitGroupsService,
    @Inject(SPLIT_REPOSITORY) private readonly repository: SplitRepository,
    @Inject(SPLIT_DOMAIN_RUNTIME) private readonly runtime: SplitDomainRuntime,
  ) {}
  async list(userId: string, groupId: string) {
    await this.groups.access(userId, groupId);
    return this.repository.listMembers(groupId);
  }
  async createGuest(userId: string, groupId: string, body: unknown) {
    const access = await this.groups.owner(userId, groupId);
    this.groups.requireActive(access);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((k) => k !== 'displayName')
    )
      splitInvalid({ request: ['Only displayName is accepted.'] });
    const displayName =
      typeof (body as { displayName?: unknown }).displayName === 'string'
        ? (body as { displayName: string }).displayName.trim()
        : '';
    if (!displayName || displayName.length > 100)
      splitInvalid({ displayName: ['Display name must be between 1 and 100 characters.'] });
    const now = this.runtime.now();
    return this.repository.createGuest(
      {
        id: this.runtime.uuid(),
        groupId,
        userId: null,
        displayName,
        role: 'member',
        membershipStatus: 'active',
        joinedAt: now,
        linkedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      userId,
    );
  }
  async remove(userId: string, groupId: string, memberId: string) {
    const access = await this.groups.owner(userId, groupId);
    this.groups.requireActive(access);
    const found = await this.repository.findMember(groupId, memberId);
    if (!found) return splitNotFound('SPLIT_MEMBER_NOT_FOUND', 'Member not found.');
    const target = found;
    if (target.role === 'owner')
      splitConflict('SPLIT_OWNER_REMOVAL_FORBIDDEN', 'The group owner cannot be removed.');
    if (target.membershipStatus !== 'active')
      splitConflict('SPLIT_MEMBER_NOT_ACTIVE', 'Member is not active.');
    return this.repository.removeMember(groupId, memberId, userId, this.runtime.now());
  }
}
