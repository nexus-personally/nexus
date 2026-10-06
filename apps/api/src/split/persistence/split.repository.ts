import type {
  SplitGroup,
  SplitGroupAccess,
  SplitGroupStatus,
  SplitGroupSummary,
  SplitInvite,
  SplitInvitePreview,
  SplitMember,
  SplitClaimResult,
  SplitActivity,
} from './split-domain.types.js';
import type { SplitExpense, SplitExpenseWrite } from '../expenses/split-expense.types.js';
import type { SplitSettlement, SplitSettlementWrite } from '../settlements/split-settlement.types.js';

export const SPLIT_REPOSITORY = Symbol('SPLIT_REPOSITORY');
export interface SplitDomainRuntime {
  now(): Date;
  uuid(): string;
  token(): string;
}
export const SPLIT_DOMAIN_RUNTIME = Symbol('SPLIT_DOMAIN_RUNTIME');
export interface SplitExpenseQuery {
  search?: string; category?: string; payerId?: string; memberId?: string; currency?: string;
  from?: string; to?: string; beforeCreatedAt?: Date; beforeId?: string; limit: number;
}

export interface SplitRepository {
  createGroup(input: { group: SplitGroup; owner: SplitMember }): Promise<SplitGroup>;
  listGroups(userId: string, status: SplitGroupStatus): Promise<SplitGroupSummary[]>;
  findGroupAccess(groupId: string, userId: string): Promise<SplitGroupAccess | undefined>;
  updateGroup(group: SplitGroup, actorUserId: string): Promise<SplitGroup>;
  setGroupStatus(
    groupId: string,
    status: SplitGroupStatus,
    actorUserId: string,
    at: Date,
  ): Promise<SplitGroup>;
  listMembers(groupId: string): Promise<SplitMember[]>;
  findMember(groupId: string, memberId: string): Promise<SplitMember | undefined>;
  createGuest(member: SplitMember, actorUserId: string): Promise<SplitMember>;
  removeMember(
    groupId: string,
    memberId: string,
    actorUserId: string,
    at: Date,
  ): Promise<SplitMember>;
  createInvite(invite: SplitInvite, actorUserId: string): Promise<SplitInvite>;
  listInvites(groupId: string): Promise<SplitInvite[]>;
  previewInvite(
    tokenHash: string,
    now: Date,
  ): Promise<
    | { state: 'valid'; preview: SplitInvitePreview }
    | { state: 'not_found' | 'expired' | 'revoked' | 'claimed' }
  >;
  revokeInvite(
    groupId: string,
    inviteId: string,
    actorUserId: string,
    at: Date,
  ): Promise<SplitInvite | undefined>;
  claimInvite(input: {
    tokenHash: string;
    userId: string;
    displayName: string;
    memberId: string;
    activityIds: string[];
    now: Date;
  }): Promise<SplitClaimResult>;
  hasActiveExpenses(groupId: string): Promise<boolean>;
  createExpense(write: SplitExpenseWrite): Promise<SplitExpense>;
  listExpenses(groupId: string): Promise<SplitExpense[]>;
  searchExpenses(groupId: string, query: SplitExpenseQuery): Promise<SplitExpense[]>;
  findExpense(groupId: string, expenseId: string): Promise<SplitExpense | undefined>;
  updateExpense(write: SplitExpenseWrite): Promise<SplitExpense>;
  deleteExpense(
    groupId: string,
    expenseId: string,
    actorUserId: string,
    activityId: string,
    at: Date,
  ): Promise<SplitExpense | undefined>;
  createSettlement(write: SplitSettlementWrite): Promise<SplitSettlement>;
  listSettlements(groupId: string): Promise<SplitSettlement[]>;
  listActivity(groupId: string, before: Date | null, limit: number): Promise<SplitActivity[]>;
}
