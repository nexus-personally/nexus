export type SplitPaymentMethod = 'cash' | 'duitnow' | 'bank_transfer' | 'ewallet' | 'other';
export interface SplitSettlement {
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  currency: string;
  paymentMethod: SplitPaymentMethod;
  settlementDate: string;
  note: string | null;
  createdByUserId: string;
  createdAt: Date;
}
export interface SplitSettlementWrite {
  settlement: SplitSettlement;
  activityId: string;
}
