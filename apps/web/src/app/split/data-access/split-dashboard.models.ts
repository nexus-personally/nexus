export type SplitBudgetAdjustmentKind = 'income' | 'expense';

export interface SplitBudgetAdjustment {
  id: string;
  kind: SplitBudgetAdjustmentKind;
  amountMinor: number;
  note: string | null;
  effectiveDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface SplitDashboardSummary {
  month: string;
  currency: 'MYR';
  monthlyBudgetMinor: number | null;
  incomeMinor: number;
  manualExpenseMinor: number;
  groupExpenseMinor: number;
  /** Group expense shares in each Group's base currency; non-MYR amounts are not FX-converted. */
  groupExpenseByCurrency: Array<{ currency: string; amountMinor: number }>;
  cardDebtMinor: number;
  creditCards: SplitCreditCard[];
  availableMinor: number;
  spentMinor: number;
  remainingMinor: number;
  adjustments: SplitBudgetAdjustment[];
}

export interface SplitBudgetAdjustmentInput {
  kind: SplitBudgetAdjustmentKind;
  amountMinor: number;
  note: string | null;
  effectiveDate: string;
}

export interface SplitCreditCard {
  id: string;
  name: string;
  amountMinor: number;
  createdAt: string;
  updatedAt: string;
}

export interface SplitCreditCardInput {
  name: string;
  amountMinor: number;
}

export function splitRemainingPercent(remainingMinor: number, availableMinor: number) {
  if (availableMinor <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((remainingMinor / availableMinor) * 100)));
}

export function splitAmountSizeClass(minor: number) {
  const amount = Math.abs(minor);
  if (amount < 1_000_000) return 'amount-large';
  if (amount < 10_000_000) return 'amount-medium';
  if (amount < 1_000_000_000) return 'amount-small';
  return 'amount-compact';
}
