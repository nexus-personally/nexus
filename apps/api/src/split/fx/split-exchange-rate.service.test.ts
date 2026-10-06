import assert from 'node:assert/strict';
import test from 'node:test';
import { SplitExchangeRateService } from './split-exchange-rate.service.js';

test('same-currency quotes are exact identity rates without calling provider', async () => {
  let called = false;
  const service = new SplitExchangeRateService({ getRate: async () => { called = true; throw new Error(); } } as never);
  const quote = await service.getRate('JPY', 'JPY', '2026-10-06');
  assert.equal(quote.rate, '1');
  assert.equal(quote.provider, 'identity');
  assert.equal(called, false);
});

test('foreign date-aware quote is cached and preserves provider decimal string', async () => {
  let calls = 0;
  const service = new SplitExchangeRateService({ getRate: async (from:string,to:string,date:string) => {
    calls += 1; return { fromCurrency:from,toCurrency:to,date,rate:'0.582012345678',provider:'frankfurter' };
  } } as never);
  const first = await service.getRate('CNY', 'MYR', '2026-10-05');
  const second = await service.getRate('CNY', 'MYR', '2026-10-05');
  assert.equal(first.rate, '0.582012345678');
  assert.equal(second.rate, first.rate);
  assert.equal(calls, 1);
});
