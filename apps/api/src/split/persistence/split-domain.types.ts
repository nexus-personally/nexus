export type SplitGroupType = 'travel' | 'daily' | 'home' | 'couple' | 'food' | 'project' | 'other';
export type SplitCurrency = 'MYR' | 'USD' | 'SGD' | 'CNY' | 'TWD' | 'JPY' | 'HKD';
export type SplitGroupStatus = 'active' | 'archived';
export interface SplitActivity {
  id: string; groupId: string; actorUserId: string | null; actionType: string;
  entityType: string; entityId: string | null; metadata: Record<string, unknown>;
  createdAt: Date;
}
export type SplitMemberRole = 'owner' | 'member';
export type SplitMembershipStatus = 'active' | 'left' | 'removed';

export interface SplitGroup {
  id: string;
  name: string;
  type: SplitGroupType;
  baseCurrency: SplitCurrency;
  simplifyDebts: boolean;
  startDate: string | null;
  endDate: string | null;
  status: SplitGroupStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface SplitGroupSummary extends SplitGroup {
  memberCount: number;
  currentUserRole: SplitMemberRole;
}
export interface SplitMember {
  id: string;
  groupId: string;
  userId: string | null;
  displayName: string;
  role: SplitMemberRole;
  membershipStatus: SplitMembershipStatus;
  joinedAt: Date;
  linkedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface SplitInvite {
  id: string;
  groupId: string;
  targetMemberId: string | null;
  tokenHash: string;
  createdByUserId: string;
  expiresAt: Date;
  claimedAt: Date | null;
  claimedByUserId: string | null;
  revokedAt: Date | null;
  createdAt: Date;
}
export interface SplitGroupAccess {
  group: SplitGroup;
  membership: SplitMember;
}
export interface SplitInvitePreview {
  groupName: string;
  groupType: SplitGroupType;
  targetDisplayName: string | null;
  expiresAt: Date;
}
export type SplitClaimResult =
  | { status: 'claimed'; groupId: string; memberId: string }
  | {
      status:
        | 'not_found'
        | 'expired'
        | 'revoked'
        | 'already_claimed'
        | 'member_exists'
        | 'target_invalid'
        | 'group_archived';
    };
