import type { Result } from './engine'

/** Only real, present players exchange account credit; nobody can pay below zero. */
export function settlementDeltas(result: Result | null, eligible: boolean[], balances: number[] = eligible.map(() => Number.MAX_SAFE_INTEGER)): number[] {
  const deltas = eligible.map(() => 0)
  const winner = result?.winner
  if (!result || winner === null || winner === undefined || !eligible[winner]) return deltas
  for (let seat = 0; seat < eligible.length; seat++) {
    if (seat === winner || !eligible[seat]) continue
    const owed = Math.max(0, -(result.payments[seat] ?? 0))
    const paid = Math.min(owed, Math.max(0, Math.floor(balances[seat] ?? 0)))
    deltas[seat] = -paid
    deltas[winner] += paid
  }
  return deltas
}
