import { Inject, Injectable } from '@nestjs/common';
import type { SplitCurrentUser } from '../auth/split-auth.types.js';
import type {
  SplitGroup,
  SplitGroupAccess,
  SplitGroupStatus,
} from '../persistence/split-domain.types.js';
import {
  SPLIT_DOMAIN_RUNTIME,
  SPLIT_REPOSITORY,
  type SplitDomainRuntime,
  type SplitRepository,
} from '../persistence/split.repository.js';
import { splitConflict, splitForbidden, splitInvalid, splitNotFound } from '../split-errors.js';
import { validateGroupInput } from './split-group.validation.js';

@Injectable()
export class SplitGroupsService {
  constructor(
    @Inject(SPLIT_REPOSITORY) private readonly repository: SplitRepository,
    @Inject(SPLIT_DOMAIN_RUNTIME) private readonly runtime: SplitDomainRuntime,
  ) {}

  async create(user: Pick<SplitCurrentUser, 'id' | 'displayName'>, body: unknown) {
    const input = validateGroupInput(body);
    const now = this.runtime.now();
    const group: SplitGroup = {
      id: this.runtime.uuid(),
      name: input.name!,
      type: input.type!,
      baseCurrency: input.baseCurrency ?? 'MYR',
      simplifyDebts: input.simplifyDebts ?? true,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      status: 'active',
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
    };
    return this.repository.createGroup({
      group,
      owner: {
        id: this.runtime.uuid(),
        groupId: group.id,
        userId: user.id,
        displayName: user.displayName,
        role: 'owner',
        membershipStatus: 'active',
        joinedAt: now,
        linkedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  list(userId: string, status: string | undefined) {
    const resolved: SplitGroupStatus =
      status === undefined
        ? 'active'
        : status === 'active' || status === 'archived'
          ? status
          : splitInvalid({ status: ['Unsupported group status.'] });
    return this.repository.listGroups(userId, resolved);
  }

  async get(userId: string, groupId: string) {
    return (await this.access(userId, groupId)).group;
  }

  async update(userId: string, groupId: string, body: unknown) {
    const access = await this.owner(userId, groupId);
    this.requireActive(access);
    const input = validateGroupInput(body, true);
    if (Object.keys(input).length === 0)
      splitInvalid({ request: ['At least one editable field is required.'] });
    const updated = { ...access.group, ...input, updatedAt: this.runtime.now() };
    if (
      input.baseCurrency !== undefined &&
      input.baseCurrency !== access.group.baseCurrency &&
      (await this.repository.hasActiveExpenses(groupId))
    )
      splitConflict(
        'SPLIT_BASE_CURRENCY_LOCKED',
        'Base currency cannot change after the Group has financial history.',
      );
    if (updated.startDate && updated.endDate && updated.startDate > updated.endDate)
      splitConflict('SPLIT_GROUP_DATE_RANGE_INVALID', 'End date must be on or after start date.');
    return this.repository.updateGroup(updated, userId);
  }

  async archive(userId: string, groupId: string) {
    const access = await this.owner(userId, groupId);
    this.requireActive(access);
    return this.repository.setGroupStatus(groupId, 'archived', userId, this.runtime.now());
  }

  async reopen(userId: string, groupId: string) {
    const access = await this.owner(userId, groupId);
    if (access.group.status !== 'archived')
      splitConflict('SPLIT_GROUP_ALREADY_ACTIVE', 'Group is already active.');
    return this.repository.setGroupStatus(groupId, 'active', userId, this.runtime.now());
  }

  async access(userId: string, groupId: string) {
    return (
      (await this.repository.findGroupAccess(groupId, userId)) ??
      splitNotFound('SPLIT_GROUP_NOT_FOUND', 'Group not found.')
    );
  }
  async owner(userId: string, groupId: string) {
    const access = await this.access(userId, groupId);
    if (access.membership.role !== 'owner')
      splitForbidden('SPLIT_GROUP_FORBIDDEN', 'Owner permission is required.');
    return access;
  }
  requireActive(access: SplitGroupAccess) {
    if (access.group.status !== 'active')
      splitConflict('SPLIT_GROUP_ARCHIVED', 'Archived groups cannot be changed.');
  }
}
