import type { SplitCurrency, SplitGroupType } from '../persistence/split-domain.types.js';
import { splitInvalid } from '../split-errors.js';
const types = new Set<SplitGroupType>([
  'travel',
  'daily',
  'home',
  'couple',
  'food',
  'project',
  'other',
]);
const currencies = new Set<SplitCurrency>(['MYR', 'USD', 'SGD', 'CNY', 'TWD', 'JPY', 'HKD']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export function validateGroupInput(value: unknown, partial = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    splitInvalid({ request: ['A JSON object is required.'] });
  const body = value as Record<string, unknown>;
  const allowed = ['name', 'type', 'baseCurrency', 'startDate', 'endDate', 'simplifyDebts'];
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    splitInvalid({ request: ['Unexpected field.'] });
  const result: Record<string, unknown> = {};
  const fields: Record<string, string[]> = {};
  if (!partial || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 100) fields.name = ['Name must be between 1 and 100 characters.'];
    else result.name = name;
  }
  if (!partial || body.type !== undefined) {
    if (typeof body.type !== 'string' || !types.has(body.type as SplitGroupType))
      fields.type = ['Unsupported group type.'];
    else result.type = body.type;
  }
  if (!partial || body.baseCurrency !== undefined) {
    const currency = typeof body.baseCurrency === 'string' ? body.baseCurrency : 'MYR';
    if (!currencies.has(currency as SplitCurrency)) fields.baseCurrency = ['Unsupported currency.'];
    else result.baseCurrency = currency;
  }
  for (const key of ['startDate', 'endDate'] as const)
    if (body[key] !== undefined) {
      if (
        body[key] !== null &&
        (typeof body[key] !== 'string' || !datePattern.test(body[key] as string))
      )
        fields[key] = ['Use YYYY-MM-DD.'];
      else result[key] = body[key];
    }
  if (body.simplifyDebts !== undefined) {
    if (typeof body.simplifyDebts !== 'boolean') fields.simplifyDebts = ['Must be true or false.'];
    else result.simplifyDebts = body.simplifyDebts;
  }
  const start = (result.startDate ?? body.startDate) as string | null | undefined;
  const end = (result.endDate ?? body.endDate) as string | null | undefined;
  if (start && end && start > end) fields.endDate = ['End date must be on or after start date.'];
  if (Object.keys(fields).length) splitInvalid(fields);
  return result as {
    name?: string;
    type?: SplitGroupType;
    baseCurrency?: SplitCurrency;
    startDate?: string | null;
    endDate?: string | null;
    simplifyDebts?: boolean;
  };
}
