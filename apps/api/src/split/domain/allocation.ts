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
function weighted(total: number, entries: readonly WeightedEntry[], denominator: bigint) {
  assertMinorAmount(total);
  validateEntries(entries);
  if (denominator <= 0n) throw new Error('SPLIT_ALLOCATION_INVALID');
  const allocations = entries.map(([memberId, weight]) => ({
    memberId,
    amountMinor: Number((BigInt(total) * BigInt(weight)) / denominator),
  }));
  let remainder = BigInt(total) - allocations.reduce((sum, item) => sum + BigInt(item.amountMinor), 0n);
  for (let index = 0; remainder > 0n; index = (index + 1) % allocations.length, remainder--)
    allocations[index]!.amountMinor++;
  return allocations;
}
export function allocateEqual(total: number, participants: readonly string[]) {
  return weighted(
    total,
    participants.map((id) => [id, 1] as const),
    BigInt(participants.length),
  );
}
export function allocateExact(total: number, entries: readonly WeightedEntry[]) {
  assertMinorAmount(total);
  validateEntries(entries);
  if (entries.reduce((sum, [, amount]) => sum + BigInt(amount), 0n) !== BigInt(total))
    throw new Error('SPLIT_ALLOCATION_INVALID');
  return entries.map(([memberId, amountMinor]) => ({ memberId, amountMinor }));
}
export function allocatePercentage(total: number, entries: readonly WeightedEntry[]) {
  if (entries.reduce((sum, [, basisPoints]) => sum + BigInt(basisPoints), 0n) !== 10000n)
    throw new Error('SPLIT_ALLOCATION_INVALID');
  return weighted(total, entries, 10000n);
}
export function allocateShares(total: number, entries: readonly WeightedEntry[]) {
  validateEntries(entries);
  return weighted(
    total,
    entries,
    entries.reduce((sum, [, shares]) => sum + BigInt(shares), 0n),
  );
}
export function validatePaymentTotal(total: number, payments: readonly WeightedEntry[]) {
  assertMinorAmount(total);
  validateEntries(payments);
  if (payments.reduce((sum, [, amount]) => sum + BigInt(amount), 0n) !== BigInt(total))
    throw new Error('SPLIT_PAYMENT_TOTAL_INVALID');
}
