import { assertMinorAmount } from './money.js';
export interface SplitAllocation {
  memberId: string;
  amountMinor: number;
}
type WeightedEntry = readonly [memberId: string, weight: number];
function validateEntries(entries: readonly WeightedEntry[]) {
  if (
    !entries.length ||
    new Set(entries.map(([id]) => id)).size !== entries.length ||
    entries.some(([id, w]) => !id || !Number.isSafeInteger(w) || w <= 0)
  )
    throw new Error('SPLIT_ALLOCATION_INVALID');
}
function weighted(total: number, entries: readonly WeightedEntry[], denominator: number) {
  assertMinorAmount(total);
  validateEntries(entries);
  if (!Number.isSafeInteger(denominator) || denominator <= 0)
    throw new Error('SPLIT_ALLOCATION_INVALID');
  const allocations = entries.map(([memberId, weight]) => ({
    memberId,
    amountMinor: Number((BigInt(total) * BigInt(weight)) / BigInt(denominator)),
  }));
  let remainder = total - allocations.reduce((sum, item) => sum + item.amountMinor, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % allocations.length, remainder--)
    allocations[index]!.amountMinor++;
  return allocations;
}
export function allocateEqual(total: number, participants: readonly string[]) {
  return weighted(
    total,
    participants.map((id) => [id, 1] as const),
    participants.length,
  );
}
export function allocateExact(total: number, entries: readonly WeightedEntry[]) {
  assertMinorAmount(total);
  validateEntries(entries);
  if (entries.reduce((sum, [, amount]) => sum + amount, 0) !== total)
    throw new Error('SPLIT_ALLOCATION_INVALID');
  return entries.map(([memberId, amountMinor]) => ({ memberId, amountMinor }));
}
export function allocatePercentage(total: number, entries: readonly WeightedEntry[]) {
  if (entries.reduce((sum, [, basisPoints]) => sum + basisPoints, 0) !== 10000)
    throw new Error('SPLIT_ALLOCATION_INVALID');
  return weighted(total, entries, 10000);
}
export function allocateShares(total: number, entries: readonly WeightedEntry[]) {
  validateEntries(entries);
  return weighted(
    total,
    entries,
    entries.reduce((sum, [, shares]) => sum + shares, 0),
  );
}
export function validatePaymentTotal(total: number, payments: readonly WeightedEntry[]) {
  assertMinorAmount(total);
  validateEntries(payments);
  if (payments.reduce((sum, [, amount]) => sum + amount, 0) !== total)
    throw new Error('SPLIT_PAYMENT_TOTAL_INVALID');
}
