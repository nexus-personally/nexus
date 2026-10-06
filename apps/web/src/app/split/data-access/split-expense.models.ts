import type { SplitCurrency } from './split.models';

export type SplitExpenseCategory =
  | 'food'
  | 'transport'
  | 'accommodation'
  | 'shopping'
  | 'entertainment'
  | 'travel'
  | 'home'
  | 'bills'
  | 'grocery'
  | 'health'
  | 'gift'
  | 'other';
export type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares';
export interface SplitExpenseLine {
  memberId: string;
  amountMinor: number;
}
export interface SplitExpense {
  id: string;
  groupId: string;
  description: string;
  categoryKey: SplitExpenseCategory;
  splitMethod: SplitMethod;
  originalAmountMinor: number;
  originalCurrency: SplitCurrency;
  baseAmountMinor: number;
  baseCurrency: SplitCurrency;
  exchangeRate: string;
  expenseDate: string;
  note: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  payments: Array<SplitExpenseLine & { id: string }>;
  splits: Array<SplitExpenseLine & { id: string }>;
}
export interface SplitExpenseDraft {
  description: string;
  categoryKey: SplitExpenseCategory;
  amount: string;
  currency: SplitCurrency;
  baseCurrency: SplitCurrency;
  exchangeRate: string;
  expenseDate: string;
  note: string;
  payments: { memberId: string; amount: string }[];
  participantIds: string[];
  method: SplitMethod;
  allocations: Record<string, string>;
}
export interface SplitDebt {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}
export interface SplitBalances {
  baseCurrency: SplitCurrency;
  currentUserBalance: number;
  memberBalances: Array<{
    memberId: string;
    displayName: string;
    membershipStatus: 'active' | 'left' | 'removed';
    isGuest: boolean;
    amountMinor: number;
  }>;
  directDebts: SplitDebt[];
  simplifiedDebts: SplitDebt[];
  simplifyDebtsEnabled: boolean;
}
export interface SplitSettlement {
  id: string; groupId: string; fromMemberId: string; toMemberId: string; amountMinor: number;
  currency: SplitCurrency; paymentMethod: 'cash'|'duitnow'|'bank_transfer'|'ewallet'|'other';
  settlementDate: string; note: string|null; createdByUserId: string; createdAt: string;
}
export interface SplitActivity { id:string;actorUserId:string|null;actionType:string;entityType:string;entityId:string|null;metadata:Record<string,unknown>;createdAt:string; }
export interface SplitExchangeRateQuote { fromCurrency:SplitCurrency;toCurrency:SplitCurrency;date:string;rate:string;provider:'identity'|'frankfurter'; }
export function activityText(item:SplitActivity,actorName:string){const name=actorName||'Someone';const description=typeof item.metadata['description']==='string'?item.metadata['description']:'';switch(item.actionType){case'EXPENSE_CREATED':return `${name} added ${description||'an expense'}`;case'EXPENSE_UPDATED':return `${name} edited ${description||'an expense'}`;case'EXPENSE_DELETED':return `${name} deleted ${description||'an expense'}`;case'SETTLEMENT_CREATED':return `${name} recorded a payment`;case'MEMBER_JOINED':return `${name} joined the group`;case'MEMBER_ADDED':return `${name} added a member`;case'MEMBER_REMOVED':return `${name} removed a member`;case'GROUP_CREATED':return `${name} created the group`;case'GROUP_UPDATED':return `${name} updated the group`;case'GROUP_ARCHIVED':return `${name} archived the group`;case'GROUP_REOPENED':return `${name} reopened the group`;case'INVITE_CREATED':return `${name} created an invite`;case'INVITE_REVOKED':return `${name} revoked an invite`;case'INVITE_CLAIMED':return `${name} claimed an invite`;default:return `${name} updated the group`;}}

export const splitExpenseCategories: Array<[SplitExpenseCategory, string, string]> = [
  ['food', 'Food', '🍽'],
  ['transport', 'Transport', '🚕'],
  ['accommodation', 'Accommodation', '⌂'],
  ['shopping', 'Shopping', '◫'],
  ['entertainment', 'Entertainment', '★'],
  ['travel', 'Travel', '✈'],
  ['home', 'Home', '⌂'],
  ['bills', 'Bills', '▤'],
  ['grocery', 'Grocery', '◉'],
  ['health', 'Health', '＋'],
  ['gift', 'Gift', '◇'],
  ['other', 'Other', '○'],
];
export const splitExpenseCategory = Object.fromEntries(
  splitExpenseCategories.map(([key, label, icon]) => [key, { label, icon }]),
) as Record<SplitExpenseCategory, { label: string; icon: string }>;

const precision: Record<SplitCurrency, number> = {
  MYR: 2,
  USD: 2,
  SGD: 2,
  CNY: 2,
  TWD: 2,
  HKD: 2,
  JPY: 0,
};

export function parseExpenseAmount(value: string, currency: SplitCurrency): number | null {
  const digits = precision[currency];
  const match = value.trim().match(digits ? new RegExp(`^(\\d+)(?:\\.(\\d{1,${digits}}))?$`) : /^(\d+)$/);
  if (!match) return null;
  const major = BigInt(match[1]!);
  const fraction = (match[2] ?? '').padEnd(digits, '0');
  const result = major * 10n ** BigInt(digits) + BigInt(fraction || '0');
  return result > 0n && result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : null;
}

export function formatExpenseAmount(amountMinor: number, currency: SplitCurrency): string {
  const digits = precision[currency];
  if (!digits) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amountMinor);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amountMinor / 10 ** digits);
}

export function convertExpenseAmount(amountMinor:number,from:SplitCurrency,to:SplitCurrency,rate:string):number|null {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !/^\d+(?:\.\d{1,12})?$/.test(rate)) return null;
  const [whole,fraction=''] = rate.split('.');
  const scale=10n**BigInt(fraction.length), numerator=BigInt(whole!)*scale+BigInt(fraction||'0');
  const fromDigits=precision[from],toDigits=precision[to];
  const up=10n**BigInt(Math.max(0,toDigits-fromDigits));
  const divisor=scale*10n**BigInt(Math.max(0,fromDigits-toDigits));
  const value=(BigInt(amountMinor)*numerator*up+divisor/2n)/divisor;
  return value<=BigInt(Number.MAX_SAFE_INTEGER)?Number(value):null;
}

function weighted(amount: number, values: Array<[string, number]>) {
  const total = values.reduce((sum, [, value]) => sum + value, 0);
  if (!values.length || total <= 0) return [];
  const rows = values.map(([memberId, value]) => ({
    memberId,
    amountMinor: Number((BigInt(amount) * BigInt(value)) / BigInt(total)),
  }));
  let remainder = amount - rows.reduce((sum, row) => sum + row.amountMinor, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % rows.length) {
    rows[index]!.amountMinor += 1;
    remainder -= 1;
  }
  return rows;
}

export function allocationPreview(draft: SplitExpenseDraft): SplitExpenseLine[] {
  const amount = parseExpenseAmount(draft.amount, draft.currency);
  if (!amount || !draft.participantIds.length) return [];
  if (draft.method === 'equal') return weighted(amount, draft.participantIds.map((id) => [id, 1]));
  if (draft.method === 'exact')
    return draft.participantIds.map((memberId) => ({
      memberId,
      amountMinor: parseExpenseAmount(draft.allocations[memberId] ?? '', draft.currency) ?? 0,
    }));
  if (draft.method === 'percentage') {
    const values = draft.participantIds.map((id) => [id, percentageBasisPoints(draft.allocations[id] ?? '')] as [string, number]);
    return values.reduce((sum, [, value]) => sum + value, 0) === 10_000 ? weighted(amount, values) : [];
  }
  const values = draft.participantIds.map((id) => [id, positiveInteger(draft.allocations[id] ?? '')] as [string, number]);
  return values.every(([, value]) => value > 0) ? weighted(amount, values) : [];
}

export function validateExpenseDraft(draft: SplitExpenseDraft) {
  const errors: Record<string, string> = {};
  const amount = parseExpenseAmount(draft.amount, draft.currency);
  if (!draft.description.trim()) errors['description'] = 'Description is required.';
  if (!amount) errors['amount'] = `Enter a valid ${draft.currency} amount.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.expenseDate)) errors['expenseDate'] = 'Choose an expense date.';
  if (!draft.payments.length) errors['payments'] = 'Choose who paid.';
  else if (amount && draft.payments.reduce((sum, row) => sum + (parseExpenseAmount(row.amount, draft.currency) ?? 0), 0) !== amount)
    errors['payments'] = `Payments must total ${draft.currency} ${formatExpenseAmount(amount, draft.currency)}.`;
  if (!draft.participantIds.length) errors['split'] = 'Choose at least one participant.';
  const preview = allocationPreview(draft);
  if (amount && (!preview.length || preview.reduce((sum, row) => sum + row.amountMinor, 0) !== amount))
    errors['split'] = `Split allocations must total ${draft.currency} ${formatExpenseAmount(amount, draft.currency)}.`;
  if (draft.currency !== draft.baseCurrency && !/^\d+(?:\.\d{1,12})?$/.test(draft.exchangeRate))
    errors['exchangeRate'] = 'Enter the rate to the Group base currency.';
  return errors;
}

export function expensePayload(draft: SplitExpenseDraft) {
  const amountMinor = parseExpenseAmount(draft.amount, draft.currency)!;
  const allocations = allocationPreview(draft);
  const split = draft.method === 'equal'
    ? { method: 'equal' as const, participants: draft.participantIds }
    : draft.method === 'exact'
      ? { method: 'exact' as const, allocations }
      : draft.method === 'percentage'
        ? { method: 'percentage' as const, allocations: draft.participantIds.map((memberId) => ({ memberId, basisPoints: percentageBasisPoints(draft.allocations[memberId] ?? '') })) }
        : { method: 'shares' as const, allocations: draft.participantIds.map((memberId) => ({ memberId, shares: positiveInteger(draft.allocations[memberId] ?? '') })) };
  return {
    description: draft.description.trim(),
    categoryKey: draft.categoryKey,
    amountMinor,
    currency: draft.currency,
    ...(draft.exchangeRate ? { exchangeRate: draft.exchangeRate } : {}),
    expenseDate: draft.expenseDate,
    note: draft.note.trim() || null,
    payments: draft.payments.map((row) => ({ memberId: row.memberId, amountMinor: parseExpenseAmount(row.amount, draft.currency)! })),
    split,
  };
}

export function canManageExpense(
  groupStatus: 'active' | 'archived',
  role: 'owner' | 'member' | undefined,
  currentUserId: string | undefined,
  createdByUserId: string,
) {
  return groupStatus === 'active' && (role === 'owner' || currentUserId === createdByUserId);
}

const positiveInteger = (value: string) => (/^[1-9]\d*$/.test(value.trim()) ? Number(value) : 0);
const percentageBasisPoints = (value: string) => {
  const match = value.trim().match(/^(\d{1,3})(?:\.(\d{1,2}))?$/);
  return match ? Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')) : 0;
};
