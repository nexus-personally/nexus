export const SPLIT_CURRENCIES = { MYR: 2, USD: 2, SGD: 2, CNY: 2, TWD: 2, JPY: 0, HKD: 2 } as const;
export type SplitMoneyCurrency = keyof typeof SPLIT_CURRENCIES;
export function currencyPrecision(currency: string) {
  if (!(currency in SPLIT_CURRENCIES)) throw new Error('SPLIT_CURRENCY_INVALID');
  return SPLIT_CURRENCIES[currency as SplitMoneyCurrency];
}
export function assertMinorAmount(value: unknown, allowZero = false): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    (allowZero ? value < 0 : value <= 0)
  )
    throw new Error('SPLIT_EXPENSE_AMOUNT_INVALID');
}
export function parseMinorAmount(value: string, currency: string) {
  const precision = currencyPrecision(currency);
  const pattern = precision === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${precision}})?$`);
  if (!pattern.test(value)) throw new Error('SPLIT_EXPENSE_AMOUNT_INVALID');
  const [whole, fraction = ''] = value.split('.');
  const result = Number(whole) * 10 ** precision + Number(fraction.padEnd(precision, '0'));
  assertMinorAmount(result);
  return result;
}
export function convertMinorAmount(amountMinor: number, from: string, to: string, rate: string) {
  assertMinorAmount(amountMinor);
  const fromPrecision = currencyPrecision(from),
    toPrecision = currencyPrecision(to);
  if (!/^\d+(?:\.\d{1,12})?$/.test(rate) || Number(rate) <= 0)
    throw new Error('SPLIT_CURRENCY_INVALID');
  const [whole, fraction = ''] = rate.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole!) * scale + BigInt(fraction || '0');
  const up = 10n ** BigInt(Math.max(0, toPrecision - fromPrecision));
  const divisor = scale * 10n ** BigInt(Math.max(0, fromPrecision - toPrecision));
  const result = Number((BigInt(amountMinor) * numerator * up + divisor / 2n) / divisor);
  assertMinorAmount(result);
  return result;
}
