import { Injectable } from '@nestjs/common';
import type { SplitMoneyCurrency } from '../domain/money.js';
import { SPLIT_CURRENCIES } from '../domain/money.js';
import { splitDomainInvalid } from '../split-errors.js';

export interface SplitExchangeRateQuote {
  fromCurrency: SplitMoneyCurrency;
  toCurrency: SplitMoneyCurrency;
  date: string;
  rate: string;
  provider: 'identity' | 'frankfurter';
}

export interface SplitExchangeRateProvider {
  getRate(from: SplitMoneyCurrency, to: SplitMoneyCurrency, date: string): Promise<SplitExchangeRateQuote>;
}

const currency = (value: string): SplitMoneyCurrency => {
  const normalized = value.trim().toUpperCase();
  if (!(normalized in SPLIT_CURRENCIES))
    splitDomainInvalid('SPLIT_FX_CURRENCY_INVALID', 'Unsupported exchange-rate currency.', 'currency');
  return normalized as SplitMoneyCurrency;
};

const expenseDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
    splitDomainInvalid('SPLIT_FX_DATE_INVALID', 'Use a valid YYYY-MM-DD exchange-rate date.', 'date');
  return value;
};

@Injectable()
export class FrankfurterSplitExchangeRateProvider implements SplitExchangeRateProvider {
  async getRate(from: SplitMoneyCurrency, to: SplitMoneyCurrency, date: string) {
    const base = (process.env.SPLIT_FX_BASE_URL || 'https://api.frankfurter.dev/v2').replace(/\/$/, '');
    const url = `${base}/rate/${from.toLowerCase()}/${to.toLowerCase()}?date=${encodeURIComponent(date)}`;
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(6_000) });
    if (!response.ok) throw new Error(`fx_provider_${response.status}`);
    const raw = await response.text();
    const rate = raw.match(/"rate"\s*:\s*(\d+(?:\.\d+)?)/)?.[1];
    const resolvedDate = raw.match(/"date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1] ?? date;
    if (!rate || !/^\d+(?:\.\d{1,12})?$/.test(rate) || Number(rate) <= 0)
      throw new Error('fx_provider_invalid_response');
    return { fromCurrency: from, toCurrency: to, date: resolvedDate, rate, provider: 'frankfurter' as const };
  }
}

@Injectable()
export class SplitExchangeRateService {
  private readonly cache = new Map<string, { expiresAt: number; quote: SplitExchangeRateQuote }>();
  constructor(private readonly provider: FrankfurterSplitExchangeRateProvider) {}

  async getRate(fromValue: string, toValue: string, dateValue: string) {
    const from = currency(fromValue), to = currency(toValue), date = expenseDate(dateValue);
    if (from === to) return { fromCurrency: from, toCurrency: to, date, rate: '1', provider: 'identity' as const };
    if ((process.env.SPLIT_FX_PROVIDER || 'frankfurter').toLowerCase() === 'disabled')
      splitDomainInvalid('SPLIT_FX_UNAVAILABLE', 'Automatic rates are unavailable. Enter a rate manually.', 'exchangeRate');
    const key = `${from}:${to}:${date}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.quote;
    try {
      const quote = await this.provider.getRate(from, to, date);
      const ttl = Math.max(60, Number(process.env.SPLIT_FX_CACHE_SECONDS) || 21_600) * 1_000;
      this.cache.set(key, { quote, expiresAt: Date.now() + ttl });
      return quote;
    } catch {
      return splitDomainInvalid('SPLIT_FX_UNAVAILABLE', 'A suggested rate is unavailable. Enter a rate manually.', 'exchangeRate');
    }
  }
}
