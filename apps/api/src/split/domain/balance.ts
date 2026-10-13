import { splitDomainInvalid } from '../split-errors.js';

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

const memberPair = (fromMemberId: string, toMemberId: string) => `${fromMemberId}\0${toMemberId}`;

/** Apply transfers to the expense-level debt graph, preserving direct-debt paths. */
export function applySettlementsToDebts(
  debts: Debt[],
  settlements: BalanceSettlement[],
  settledBalances: MemberBalance[],
): Debt[] {
  const amounts = new Map(debts.map((debt) => [memberPair(debt.fromMemberId, debt.toMemberId), debt.amountMinor]));

  for (const settlement of settlements) {
    let remaining = settlement.amountMinor;
    while (remaining > 0) {
      const path = findDebtPath(amounts, settlement.fromMemberId, settlement.toMemberId);
      if (!path) return simplifyBalances(settledBalances);
      const paid = Math.min(remaining, ...path.map((key) => amounts.get(key) ?? 0));
      for (const key of path) amounts.set(key, (amounts.get(key) ?? 0) - paid);
      remaining -= paid;
    }
  }

  return debts.flatMap((debt) => {
    const amountMinor = amounts.get(memberPair(debt.fromMemberId, debt.toMemberId)) ?? 0;
    return amountMinor > 0 ? [{ ...debt, amountMinor }] : [];
  });
}

function findDebtPath(amounts: Map<string, number>, fromMemberId: string, toMemberId: string) {
  const predecessor = new Map<string, string | null>([[fromMemberId, null]]);
  const queue = [fromMemberId];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    if (current === toMemberId) break;
    for (const [key, amount] of amounts) {
      if (amount <= 0) continue;
      const [from, to] = key.split('\0');
      if (from !== current || predecessor.has(to!)) continue;
      predecessor.set(to!, key);
      queue.push(to!);
    }
  }
  if (!predecessor.has(toMemberId)) return undefined;
  const path: string[] = [];
  for (let memberId = toMemberId; memberId !== fromMemberId;) {
    const key = predecessor.get(memberId);
    if (!key) return undefined;
    path.push(key);
    memberId = key.split('\0')[0]!;
  }
  return path;
}

function safeAdd(left: number, right: number) {
  const result = left + right;
  if (!Number.isSafeInteger(result))
    splitDomainInvalid('SPLIT_BALANCE_RANGE_EXCEEDED', 'This Group total exceeds the supported exact-money range.');
  return result;
}

export function toBaseLines(
  rows: Array<{ memberId: string; amountMinor: number }>,
  originalTotal: number,
  baseTotal: number,
): Array<readonly [string, number]> {
  if (!rows.length || originalTotal <= 0 || baseTotal < 0)
    splitDomainInvalid('SPLIT_BALANCE_DATA_INVALID', 'Expense allocations are invalid for exact currency conversion.');
  const result = rows.map((row) => [
    row.memberId,
    Number((BigInt(row.amountMinor) * BigInt(baseTotal)) / BigInt(originalTotal)),
  ] as [string, number]);
  let remainder = baseTotal - result.reduce((sum, [, amount]) => sum + amount, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % result.length) {
    result[index]![1] += 1;
    remainder -= 1;
  }
  return result;
}

export function applySettlements(balances: MemberBalance[], settlements: BalanceSettlement[]) {
  const values = new Map(balances.map((row) => [row.memberId, row.amountMinor]));
  for (const settlement of settlements) {
    values.set(settlement.fromMemberId, safeAdd(values.get(settlement.fromMemberId) ?? 0, settlement.amountMinor));
    values.set(settlement.toMemberId, safeAdd(values.get(settlement.toMemberId) ?? 0, -settlement.amountMinor));
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
      balances.set(memberId, safeAdd(balances.get(memberId) ?? 0, amount));
      expenseBalances.set(memberId, safeAdd(expenseBalances.get(memberId) ?? 0, amount));
    }
    for (const [memberId, amount] of expense.splits) {
      balances.set(memberId, safeAdd(balances.get(memberId) ?? 0, -amount));
      expenseBalances.set(memberId, safeAdd(expenseBalances.get(memberId) ?? 0, -amount));
    }
    for (const debt of simplifyBalances(memberIds.map((memberId) => ({ memberId, amountMinor: expenseBalances.get(memberId) ?? 0 })))) {
      const forward = `${debt.fromMemberId}\0${debt.toMemberId}`;
      const reverse = `${debt.toMemberId}\0${debt.fromMemberId}`;
      const opposite = pairwise.get(reverse) ?? 0;
      if (opposite >= debt.amountMinor) {
        pairwise.set(reverse, opposite - debt.amountMinor);
      } else {
        pairwise.delete(reverse);
        pairwise.set(forward, safeAdd(pairwise.get(forward) ?? 0, debt.amountMinor - opposite));
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
