import type { SplitMembershipStatus } from '../persistence/split-domain.types.js';
export type SplitExistingMembership =
  { id: string; membershipStatus: SplitMembershipStatus } | undefined;
export function splitClaimMembershipPlan(
  existing: SplitExistingMembership,
  targetedGuest: boolean,
) {
  if (existing && (targetedGuest || existing.membershipStatus === 'active'))
    return { kind: 'conflict' as const };
  if (existing) return { kind: 'reactivate' as const, memberId: existing.id };
  return { kind: 'create' as const };
}
