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
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  currency: SplitCurrency;
  paymentMethod: 'cash' | 'duitnow' | 'bank_transfer' | 'ewallet' | 'other';
  settlementDate: string;
  note: string | null;
  createdByUserId: string;
  createdAt: string;
}
export interface SplitActivity {
  id: string;
  actorUserId: string | null;
  actionType: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
export interface SplitExchangeRateQuote {
  fromCurrency: SplitCurrency;
  toCurrency: SplitCurrency;
  date: string;
  rate: string;
  provider: 'identity' | 'frankfurter';
}
export function activityText(item: SplitActivity, actorName: string) {
  const name = actorName || '某位成员';
  const description =
    typeof item.metadata['description'] === 'string' ? item.metadata['description'] : '';
  switch (item.actionType) {
    case 'EXPENSE_CREATED':
      return description ? `${name} 添加了「${description}」` : `${name} 添加了一笔费用`;
    case 'EXPENSE_UPDATED':
      return description ? `${name} 编辑了「${description}」` : `${name} 编辑了一笔费用`;
    case 'EXPENSE_DELETED':
      return description ? `${name} 删除了「${description}」` : `${name} 删除了一笔费用`;
    case 'SETTLEMENT_CREATED':
      return `${name} 记录了一笔付款`;
    case 'MEMBER_JOINED':
      return `${name} 加入了群组`;
    case 'MEMBER_ADDED':
      return `${name} 添加了一位成员`;
    case 'MEMBER_REMOVED':
      return `${name} 移除了一位成员`;
    case 'GROUP_CREATED':
      return `${name} 创建了群组`;
    case 'GROUP_UPDATED':
      return `${name} 更新了群组`;
    case 'GROUP_ARCHIVED':
      return `${name} 归档了群组`;
    case 'GROUP_REOPENED':
      return `${name} 重新开启了群组`;
    case 'INVITE_CREATED':
      return `${name} 创建了邀请`;
    case 'INVITE_REVOKED':
      return `${name} 撤销了邀请`;
    case 'INVITE_CLAIMED':
      return `${name} 接受了邀请`;
    default:
      return `${name} 更新了群组`;
  }
}

export const splitExpenseCategories: Array<[SplitExpenseCategory, string, string]> = [
  ['food', '餐饮', '🍽'],
  ['transport', '交通', '🚕'],
  ['accommodation', '住宿', '⌂'],
  ['shopping', '购物', '◫'],
  ['entertainment', '娱乐', '★'],
  ['travel', '旅行', '✈'],
  ['home', '家庭', '⌂'],
  ['bills', '账单', '▤'],
  ['grocery', '杂货', '◉'],
  ['health', '医疗健康', '＋'],
  ['gift', '礼物', '◇'],
  ['other', '其他', '○'],
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
  const match = value
    .trim()
    .match(digits ? new RegExp(`^(\\d+)(?:\\.(\\d{1,${digits}}))?$`) : /^(\d+)$/);
  if (!match) return null;
  const major = BigInt(match[1]!);
  const fraction = (match[2] ?? '').padEnd(digits, '0');
  const result = major * 10n ** BigInt(digits) + BigInt(fraction || '0');
  return result > 0n && result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : null;
}

export function formatExpenseAmount(amountMinor: number, currency: SplitCurrency): string {
  const digits = precision[currency];
  if (!digits)
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amountMinor);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amountMinor / 10 ** digits);
}

export function convertExpenseAmount(
  amountMinor: number,
  from: SplitCurrency,
  to: SplitCurrency,
  rate: string,
): number | null {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !/^\d+(?:\.\d{1,12})?$/.test(rate))
    return null;
  const [whole, fraction = ''] = rate.split('.');
  const scale = 10n ** BigInt(fraction.length),
    numerator = BigInt(whole!) * scale + BigInt(fraction || '0');
  const fromDigits = precision[from],
    toDigits = precision[to];
  const up = 10n ** BigInt(Math.max(0, toDigits - fromDigits));
  const divisor = scale * 10n ** BigInt(Math.max(0, fromDigits - toDigits));
  const value = (BigInt(amountMinor) * numerator * up + divisor / 2n) / divisor;
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
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
  if (draft.method === 'equal')
    return weighted(
      amount,
      draft.participantIds.map((id) => [id, 1]),
    );
  if (draft.method === 'exact')
    return draft.participantIds.map((memberId) => ({
      memberId,
      amountMinor: parseExpenseAmount(draft.allocations[memberId] ?? '', draft.currency) ?? 0,
    }));
  if (draft.method === 'percentage') {
    const values = draft.participantIds.map(
      (id) => [id, percentageBasisPoints(draft.allocations[id] ?? '')] as [string, number],
    );
    return values.reduce((sum, [, value]) => sum + value, 0) === 10_000
      ? weighted(amount, values)
      : [];
  }
  const values = draft.participantIds.map(
    (id) => [id, positiveInteger(draft.allocations[id] ?? '')] as [string, number],
  );
  return values.every(([, value]) => value > 0) ? weighted(amount, values) : [];
}

export function validateExpenseDraft(draft: SplitExpenseDraft) {
  const errors: Record<string, string> = {};
  const amount = parseExpenseAmount(draft.amount, draft.currency);
  if (!draft.description.trim()) errors['description'] = '请输入费用名称。';
  if (!amount) errors['amount'] = `请输入有效的 ${draft.currency} 金额。`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.expenseDate)) errors['expenseDate'] = '请选择费用日期。';
  if (!draft.payments.length) errors['payments'] = '请选择付款人。';
  else if (
    amount &&
    draft.payments.reduce(
      (sum, row) => sum + (parseExpenseAmount(row.amount, draft.currency) ?? 0),
      0,
    ) !== amount
  )
    errors['payments'] =
      `付款总额必须为 ${draft.currency} ${formatExpenseAmount(amount, draft.currency)}。`;
  if (!draft.participantIds.length) errors['split'] = '请至少选择一位分摊成员。';
  const preview = allocationPreview(draft);
  if (
    amount &&
    (!preview.length || preview.reduce((sum, row) => sum + row.amountMinor, 0) !== amount)
  )
    errors['split'] =
      `分摊总额必须为 ${draft.currency} ${formatExpenseAmount(amount, draft.currency)}。`;
  if (draft.currency !== draft.baseCurrency && !/^\d+(?:\.\d{1,12})?$/.test(draft.exchangeRate))
    errors['exchangeRate'] = '请输入换算为群组基础货币的汇率。';
  return errors;
}

export function expensePayload(draft: SplitExpenseDraft) {
  const amountMinor = parseExpenseAmount(draft.amount, draft.currency)!;
  const allocations = allocationPreview(draft);
  const split =
    draft.method === 'equal'
      ? { method: 'equal' as const, participants: draft.participantIds }
      : draft.method === 'exact'
        ? { method: 'exact' as const, allocations }
        : draft.method === 'percentage'
          ? {
              method: 'percentage' as const,
              allocations: draft.participantIds.map((memberId) => ({
                memberId,
                basisPoints: percentageBasisPoints(draft.allocations[memberId] ?? ''),
              })),
            }
          : {
              method: 'shares' as const,
              allocations: draft.participantIds.map((memberId) => ({
                memberId,
                shares: positiveInteger(draft.allocations[memberId] ?? ''),
              })),
            };
  return {
    description: draft.description.trim(),
    categoryKey: draft.categoryKey,
    amountMinor,
    currency: draft.currency,
    ...(draft.exchangeRate ? { exchangeRate: draft.exchangeRate } : {}),
    expenseDate: draft.expenseDate,
    note: draft.note.trim() || null,
    payments: draft.payments.map((row) => ({
      memberId: row.memberId,
      amountMinor: parseExpenseAmount(row.amount, draft.currency)!,
    })),
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
