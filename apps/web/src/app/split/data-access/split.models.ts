export type SplitGroupType = 'travel' | 'daily' | 'home' | 'couple' | 'food' | 'project' | 'other';
export type SplitCurrency = 'MYR' | 'USD' | 'SGD' | 'CNY' | 'TWD' | 'JPY' | 'HKD';
export type SplitRole = 'owner' | 'member';
export interface SplitGroup {
  id: string;
  name: string;
  type: SplitGroupType;
  baseCurrency: SplitCurrency;
  simplifyDebts: boolean;
  startDate: string | null;
  endDate: string | null;
  status: 'active' | 'archived';
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  currentUserRole?: SplitRole;
}
export interface SplitMember {
  id: string;
  groupId: string;
  userId: string | null;
  displayName: string;
  role: SplitRole;
  membershipStatus: 'active' | 'left' | 'removed';
  joinedAt: string;
  linkedAt: string | null;
}
export interface SplitInvitePreview {
  groupName: string;
  groupType: SplitGroupType;
  targetDisplayName: string | null;
  expiresAt: string;
}
export interface SplitInviteCreated {
  id: string;
  groupId: string;
  targetMemberId: string | null;
  token: string;
  expiresAt: string;
}
export interface SplitGroupInput {
  name: string;
  type: SplitGroupType;
  baseCurrency: SplitCurrency;
  startDate: string | null;
  endDate: string | null;
  simplifyDebts?: boolean;
}
export const splitTypes: [SplitGroupType, string][] = [
  ['travel', 'Travel'],
  ['daily', 'Daily'],
  ['home', 'Home'],
  ['couple', 'Couple'],
  ['food', 'Food'],
  ['project', 'Project'],
  ['other', 'Other'],
];
export const splitCurrencies: [SplitCurrency, string][] = [
  ['MYR', 'Malaysian Ringgit'],
  ['USD', 'US Dollar'],
  ['SGD', 'Singapore Dollar'],
  ['CNY', 'Chinese Yuan'],
  ['TWD', 'New Taiwan Dollar'],
  ['JPY', 'Japanese Yen'],
  ['HKD', 'Hong Kong Dollar'],
];
export const splitTypeIcon: Record<SplitGroupType, string> = {
  travel: '✈',
  daily: '☀',
  home: '⌂',
  couple: '♥',
  food: '◇',
  project: '▣',
  other: '○',
};
export function validateGroupDraft(input: SplitGroupInput) {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors['name'] = 'Group name is required.';
  if (!splitTypes.some(([v]) => v === input.type))
    errors['type'] = 'Choose a supported group type.';
  if (!splitCurrencies.some(([v]) => v === input.baseCurrency))
    errors['baseCurrency'] = 'Choose a supported currency.';
  if (input.startDate && input.endDate && input.startDate > input.endDate)
    errors['endDate'] = 'End date must be on or after start date.';
  return errors;
}
export const activeMembers = (members: SplitMember[]) =>
  members.filter((member) => member.membershipStatus === 'active');
export const inviteReturnUrl = (token: string) =>
  `/split/login?returnUrl=${encodeURIComponent(`/split/invite/${token}`)}`;
