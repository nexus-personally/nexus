import type { SplitCurrency } from '../persistence/split-domain.types.js';
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
export interface SplitExpense {
  id: string;
  groupId: string;
  description: string;
  categoryKey: SplitExpenseCategory;
  splitMethod: 'equal' | 'exact' | 'percentage' | 'shares';
  originalAmountMinor: number;
  originalCurrency: SplitCurrency;
  baseAmountMinor: number;
  baseCurrency: SplitCurrency;
  exchangeRate: string;
  expenseDate: string;
  note: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedByUserId: string | null;
  payments: SplitExpensePayment[];
  splits: SplitExpenseShare[];
}
export interface SplitExpensePayment {
  id: string;
  expenseId: string;
  groupId: string;
  memberId: string;
  amountMinor: number;
  createdAt: Date;
}
export interface SplitExpenseShare {
  id: string;
  expenseId: string;
  groupId: string;
  memberId: string;
  amountMinor: number;
  createdAt: Date;
}
export interface SplitExpenseWrite {
  expense: SplitExpense;
  activityId: string;
  actorUserId: string;
}
