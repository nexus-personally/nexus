import type { Result } from './engine'

/** Only real, present players exchange account credit; computer seats never mint it. */
export function settlementDeltas(result: Result | null, eligible: boolean[]): number[] {
  const deltas = eligible.map(() => 0)
  const winner = result?.winner
  if (!result || winner === null || winner === undefined || !eligible[winner]) return deltas
  for (let seat = 0; seat < eligible.length; seat++) {
    if (seat === winner || !eligible[seat]) continue
    const paid = Math.min(0, result.payments[seat] ?? 0)
    deltas[seat] = paid
    deltas[winner] -= paid
  }
  return deltas
}
