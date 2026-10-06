export interface MemberBalance {
  memberId: string;
  amountMinor: number;
}
export interface Debt {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}
export interface BalanceExpense {
  payments: Array<readonly [memberId: string, amountMinor: number]>;
  splits: Array<readonly [memberId: string, amountMinor: number]>;
}
export interface BalanceSettlement {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}

export function applySettlements(balances: MemberBalance[], settlements: BalanceSettlement[]) {
  const values = new Map(balances.map((row) => [row.memberId, row.amountMinor]));
  for (const settlement of settlements) {
    values.set(settlement.fromMemberId, (values.get(settlement.fromMemberId) ?? 0) + settlement.amountMinor);
    values.set(settlement.toMemberId, (values.get(settlement.toMemberId) ?? 0) - settlement.amountMinor);
  }
  return balances.map((row) => ({ ...row, amountMinor: values.get(row.memberId) ?? 0 }));
}

export function simplifyBalances(balances: MemberBalance[]): Debt[] {
  const credits = balances.filter((row) => row.amountMinor > 0).map((row) => ({ ...row }));
  const debts = balances.filter((row) => row.amountMinor < 0).map((row) => ({ ...row, amountMinor: -row.amountMinor }));
  const result: Debt[] = [];
  let creditIndex = 0;
  let debtIndex = 0;
  while (creditIndex < credits.length && debtIndex < debts.length) {
    const credit = credits[creditIndex]!;
    const debt = debts[debtIndex]!;
    const amountMinor = Math.min(credit.amountMinor, debt.amountMinor);
    if (amountMinor > 0)
      result.push({ fromMemberId: debt.memberId, toMemberId: credit.memberId, amountMinor });
    credit.amountMinor -= amountMinor;
    debt.amountMinor -= amountMinor;
    if (!credit.amountMinor) creditIndex += 1;
    if (!debt.amountMinor) debtIndex += 1;
  }
  return result;
}

export function calculateBalances(memberIds: string[], expenses: BalanceExpense[]) {
  const balances = new Map(memberIds.map((memberId) => [memberId, 0]));
  const pairwise = new Map<string, number>();
  for (const expense of expenses) {
    const expenseBalances = new Map(memberIds.map((memberId) => [memberId, 0]));
    for (const [memberId, amount] of expense.payments) {
      balances.set(memberId, (balances.get(memberId) ?? 0) + amount);
      expenseBalances.set(memberId, (expenseBalances.get(memberId) ?? 0) + amount);
    }
    for (const [memberId, amount] of expense.splits) {
      balances.set(memberId, (balances.get(memberId) ?? 0) - amount);
      expenseBalances.set(memberId, (expenseBalances.get(memberId) ?? 0) - amount);
    }
    for (const debt of simplifyBalances(memberIds.map((memberId) => ({ memberId, amountMinor: expenseBalances.get(memberId) ?? 0 })))) {
      const forward = `${debt.fromMemberId}\0${debt.toMemberId}`;
      const reverse = `${debt.toMemberId}\0${debt.fromMemberId}`;
      const opposite = pairwise.get(reverse) ?? 0;
      if (opposite >= debt.amountMinor) {
        pairwise.set(reverse, opposite - debt.amountMinor);
      } else {
        pairwise.delete(reverse);
        pairwise.set(forward, (pairwise.get(forward) ?? 0) + debt.amountMinor - opposite);
      }
    }
  }
  const memberBalances = memberIds.map((memberId) => ({ memberId, amountMinor: balances.get(memberId) ?? 0 }));
  const directDebts: Debt[] = [];
  for (const [key, amountMinor] of pairwise) {
    if (!amountMinor) continue;
    const [fromMemberId, toMemberId] = key.split('\0');
    directDebts.push({ fromMemberId: fromMemberId!, toMemberId: toMemberId!, amountMinor });
  }
  return { memberBalances, directDebts };
}
