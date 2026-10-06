import {
  allocateEqual,
  allocateExact,
  allocatePercentage,
  allocateShares,
  validatePaymentTotal,
  type SplitAllocation,
} from '../domain/allocation.js';
import {
  assertMinorAmount,
  convertMinorAmount,
  currencyPrecision,
  type SplitMoneyCurrency,
} from '../domain/money.js';
import type { SplitExpenseCategory } from './split-expense.types.js';
import { splitDomainInvalid, splitInvalid } from '../split-errors.js';
const categories = new Set<SplitExpenseCategory>([
  'food',
  'transport',
  'accommodation',
  'shopping',
  'entertainment',
  'travel',
  'home',
  'bills',
  'grocery',
  'health',
  'gift',
  'other',
]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
type Pair = { memberId: string; amountMinor: number };
export interface ValidExpenseInput {
  description: string;
  categoryKey: SplitExpenseCategory;
  splitMethod: 'equal' | 'exact' | 'percentage' | 'shares';
  amountMinor: number;
  currency: SplitMoneyCurrency;
  exchangeRate: string;
  baseAmountMinor: number;
  expenseDate: string;
  note: string | null;
  payments: Pair[];
  allocations: SplitAllocation[];
}
const fail = (field: string, message: string): never => splitInvalid({ [field]: [message] });
function pairs(value: unknown, field: string, key: 'amountMinor' | 'basisPoints' | 'shares') {
  if (!Array.isArray(value) || !value.length) fail(field, 'At least one entry is required.');
  const values = value as unknown[];
  return values.map((raw: unknown, index: number) => {
    if (!raw || typeof raw !== 'object') return fail(field, `Entry ${index + 1} is invalid.`);
    const item = raw as Record<string, unknown>,
      memberId = typeof item['memberId'] === 'string' ? item['memberId'] : '';
    const number = item[key];
    if (!memberId || typeof number !== 'number' || !Number.isSafeInteger(number))
      return fail(field, `Entry ${index + 1} is invalid.`);
    return { memberId, [key]: number } as { memberId: string } & Record<typeof key, number>;
  });
}
export function validateExpenseInput(
  value: unknown,
  baseCurrency: SplitMoneyCurrency,
): ValidExpenseInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('request', 'A JSON object is required.');
  const b = value as Record<string, unknown>;
  const description = typeof b['description'] === 'string' ? b['description'].trim() : '';
  if (!description || description.length > 200)
    fail('description', 'Description must be between 1 and 200 characters.');
  if (
    typeof b['categoryKey'] !== 'string' ||
    !categories.has(b['categoryKey'] as SplitExpenseCategory)
  )
    fail('categoryKey', 'Unsupported category.');
  try {
    assertMinorAmount(b['amountMinor']);
  } catch {
    return splitDomainInvalid(
      'SPLIT_EXPENSE_AMOUNT_INVALID',
      'Amount must be a positive safe integer in minor units.',
      'amountMinor',
    );
  }
  const amountMinor = b['amountMinor'];
  const currencyValue = b['currency'];
  if (typeof currencyValue !== 'string') fail('currency', 'Unsupported currency.');
  const currencyText = currencyValue as string;
  try {
    currencyPrecision(currencyText);
  } catch {
    return splitDomainInvalid('SPLIT_CURRENCY_INVALID', 'Unsupported currency.', 'currency');
  }
  const currency = currencyText as SplitMoneyCurrency;
  let exchangeRate = '1',
    baseAmountMinor = amountMinor;
  if (currency !== baseCurrency) {
    if (typeof b['exchangeRate'] !== 'string')
      fail('exchangeRate', 'A decimal exchange rate is required for foreign currency.');
    exchangeRate = b['exchangeRate'] as string;
    try {
      baseAmountMinor = convertMinorAmount(amountMinor, currency, baseCurrency, exchangeRate);
    } catch {
      return splitDomainInvalid(
        'SPLIT_CURRENCY_INVALID',
        'Exchange rate must be a positive decimal with at most 12 places.',
        'exchangeRate',
      );
    }
  }
  const expenseDate = typeof b['expenseDate'] === 'string' ? b['expenseDate'] : '';
  if (!datePattern.test(expenseDate)) fail('expenseDate', 'Use YYYY-MM-DD.');
  const note =
    b['note'] === null || b['note'] === undefined
      ? null
      : typeof b['note'] === 'string'
        ? b['note'].trim()
        : fail('note', 'Note must be text or null.');
  const paymentPairs = pairs(b['payments'], 'payments', 'amountMinor').map(
    (x) => [x.memberId, x.amountMinor] as const,
  );
  try {
    validatePaymentTotal(amountMinor, paymentPairs);
  } catch {
    return splitDomainInvalid(
      'SPLIT_PAYMENT_TOTAL_INVALID',
      'Payment amounts must independently equal the Expense total.',
      'payments',
    );
  }
  const split = b['split'];
  if (!split || typeof split !== 'object' || Array.isArray(split))
    fail('split', 'A split definition is required.');
  const s = split as Record<string, unknown>;
  let allocations: SplitAllocation[];
  try {
    switch (s['method']) {
      case 'equal':
        if (
          !Array.isArray(s['participants']) ||
          s['participants'].some((x) => typeof x !== 'string')
        )
          throw new Error();
        allocations = allocateEqual(amountMinor, s['participants'] as string[]);
        break;
      case 'exact': {
        const p = pairs(s['allocations'], 'split', 'amountMinor');
        allocations = allocateExact(
          amountMinor,
          p.map((x) => [x.memberId, x.amountMinor]),
        );
        break;
      }
      case 'percentage': {
        const p = pairs(s['allocations'], 'split', 'basisPoints');
        allocations = allocatePercentage(
          amountMinor,
          p.map((x) => [x.memberId, x.basisPoints]),
        );
        break;
      }
      case 'shares': {
        const p = pairs(s['allocations'], 'split', 'shares');
        allocations = allocateShares(
          amountMinor,
          p.map((x) => [x.memberId, x.shares]),
        );
        break;
      }
      default:
        return fail('split', 'Unsupported split method.');
    }
  } catch {
    return splitDomainInvalid(
      'SPLIT_ALLOCATION_INVALID',
      'Split allocation is invalid or does not equal the Expense total.',
      'split',
    );
  }
  return {
    description,
    categoryKey: b['categoryKey'] as SplitExpenseCategory,
    splitMethod: s['method'] as ValidExpenseInput['splitMethod'],
    amountMinor,
    currency,
    exchangeRate,
    baseAmountMinor,
    expenseDate,
    note,
    payments: paymentPairs.map(([memberId, amountMinor]) => ({ memberId, amountMinor })),
    allocations,
  };
}
