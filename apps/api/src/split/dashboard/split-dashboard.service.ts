import { Injectable, NotFoundException, OnModuleDestroy, UnprocessableEntityException } from '@nestjs/common';
import crypto from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { createIdempotencyCommand, claimIdempotency, saveIdempotencyResponse } from '../persistence/split-idempotency.js';
import { createPostgresPool } from '../../database/postgres.js';

export type SplitBudgetAdjustmentKind = 'income' | 'expense';

interface AdjustmentRow extends QueryResultRow {
  id: string;
  kind: SplitBudgetAdjustmentKind;
  amount_minor: string | number;
  note: string | null;
  effective_date: string | Date;
  created_at: Date | string;
  updated_at: Date | string;
}

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const moneyRangeError = () => {
  throw new UnprocessableEntityException({
    error: { code: 'SPLIT_AMOUNT_RANGE_EXCEEDED', message: 'This total exceeds the supported exact-money range.' },
  });
};
function safeMinor(value: string | number | bigint) {
  let exact: bigint;
  try { exact = BigInt(value); } catch { return moneyRangeError(); }
  if (exact > BigInt(Number.MAX_SAFE_INTEGER) || exact < BigInt(Number.MIN_SAFE_INTEGER)) return moneyRangeError();
  return Number(exact);
}
function addMinor(left: number, right: number) {
  return safeMinor(BigInt(left) + BigInt(right));
}
const dateOnly = (value: string | Date) => {
  if (typeof value === 'string') return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};
const adjustment = (row: AdjustmentRow) => ({
  id: row.id,
  kind: row.kind,
  amountMinor: safeMinor(row.amount_minor),
  note: row.note,
  effectiveDate: dateOnly(row.effective_date),
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

function validateMonth(month: string | undefined) {
  if (!month || !monthPattern.test(month)) {
    throw new UnprocessableEntityException({
      error: { code: 'VALIDATION_FAILED', message: 'Month must use YYYY-MM.' },
    });
  }
  return month;
}

function validateAdjustment(value: unknown) {
  const body = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const allowed = ['kind', 'amountMinor', 'note', 'effectiveDate'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) invalidAdjustment();
  const kind = body.kind;
  const amountMinor = body.amountMinor;
  const note = typeof body.note === 'string' ? body.note.trim() || null : null;
  const effectiveDate = body.effectiveDate;
  if (
    (kind !== 'income' && kind !== 'expense') ||
    !Number.isSafeInteger(amountMinor) ||
    Number(amountMinor) <= 0 ||
    typeof effectiveDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ||
    (note?.length ?? 0) > 500
  ) invalidAdjustment();
  return { kind, amountMinor: Number(amountMinor), note, effectiveDate } as const;
}

function invalidAdjustment(): never {
  throw new UnprocessableEntityException({
    error: { code: 'VALIDATION_FAILED', message: 'Enter a valid adjustment.' },
  });
}

@Injectable()
export class SplitDashboardService implements OnModuleDestroy {
  private readonly pool = createPostgresPool();

  async onModuleDestroy() {
    await this.pool.end();
  }

  async summary(userId: string, requestedMonth: string | undefined) {
    const month = validateMonth(requestedMonth);
    const start = `${month}-01`;
    const result = await this.pool.query<AdjustmentRow & {
      monthly_budget_minor: string | number | null;
      income_minor: string | number;
      manual_expense_minor: string | number;
      }>(
      `select u.monthly_budget_minor,
        coalesce((select sum(a.amount_minor) from split_budget_adjustments a where a.user_id=u.id and a.kind='income' and a.effective_date >= $2::date and a.effective_date < ($2::date + interval '1 month')),0) income_minor,
        coalesce((select sum(a.amount_minor) from split_budget_adjustments a where a.user_id=u.id and a.kind='expense' and a.effective_date >= $2::date and a.effective_date < ($2::date + interval '1 month')),0) manual_expense_minor
       from split_users u where u.id=$1`,
      [userId, start],
    );
    const values = result.rows[0];
    if (!values) throw new NotFoundException({ error: { code: 'SPLIT_USER_NOT_FOUND', message: 'User not found.' } });
    const groupExpenses = await this.pool.query<{ currency: string; amount_minor: string | number }>(
      `with base_lines as (
         select e.id, e.base_currency, e.base_amount_minor,
                floor(es.amount_minor::numeric * e.base_amount_minor::numeric / e.original_amount_minor::numeric) base_floor,
                row_number() over (partition by e.id order by es.created_at, es.id) line_number
           from split_expense_splits es
           join split_expenses e on e.id=es.expense_id and e.group_id=es.group_id
           join split_group_members gm on gm.id=es.group_member_id and gm.group_id=es.group_id
          where gm.user_id=$1 and e.deleted_at is null
            and e.expense_date >= $2::date and e.expense_date < ($2::date + interval '1 month')
       ), line_totals as (
         select *, sum(base_floor) over (partition by id) floor_total from base_lines
       ), allocated as (
         select base_currency,
                base_floor + case when line_number <= base_amount_minor::numeric - floor_total then 1 else 0 end amount_minor
           from line_totals
       )
       select base_currency currency, sum(amount_minor) amount_minor
         from allocated group by base_currency order by base_currency`,
      [userId, start],
    );
    const adjustments = await this.pool.query<AdjustmentRow>(
      `select * from split_budget_adjustments where user_id=$1 and effective_date >= $2::date and effective_date < ($2::date + interval '1 month') order by effective_date desc,created_at desc`,
      [userId, start],
    );
    const monthlyBudgetMinor = values.monthly_budget_minor === null ? null : safeMinor(values.monthly_budget_minor);
    const incomeMinor = safeMinor(values.income_minor);
    const manualExpenseMinor = safeMinor(values.manual_expense_minor);
    const groupExpenseByCurrency = groupExpenses.rows.map((row) => ({
      currency: row.currency,
      amountMinor: safeMinor(row.amount_minor),
    }));
    const groupExpenseMinor = groupExpenseByCurrency.find((row) => row.currency === 'MYR')?.amountMinor ?? 0;
    const availableMinor = addMinor(monthlyBudgetMinor ?? 0, incomeMinor);
    const spentMinor = addMinor(manualExpenseMinor, groupExpenseMinor);
    return {
      month,
      currency: 'MYR',
      monthlyBudgetMinor,
      incomeMinor,
      manualExpenseMinor,
      groupExpenseMinor,
      groupExpenseByCurrency,
      availableMinor,
      spentMinor,
      remainingMinor: safeMinor(BigInt(availableMinor) - BigInt(spentMinor)),
      adjustments: adjustments.rows.map(adjustment),
    };
  }

  async createAdjustment(userId: string, body: unknown, idempotencyKey: string | undefined) {
    const input = validateAdjustment(body);
    const idempotency = createIdempotencyCommand(userId, 'split.budget-adjustment.create', idempotencyKey, body);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const replay = await claimIdempotency(client, idempotency);
      if (replay !== null) {
        await client.query('commit');
        return replay as ReturnType<typeof adjustment>;
      }
      const result = await client.query<AdjustmentRow>(
        `insert into split_budget_adjustments (id,user_id,kind,amount_minor,note,effective_date) values ($1,$2,$3,$4,$5,$6) returning *`,
        [crypto.randomUUID(), userId, input.kind, input.amountMinor, input.note, input.effectiveDate],
      );
      const response = adjustment(result.rows[0]!);
      await saveIdempotencyResponse(client, idempotency, response);
      await client.query('commit');
      return response;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateAdjustment(userId: string, adjustmentId: string, body: unknown) {
    const input = validateAdjustment(body);
    const result = await this.pool.query<AdjustmentRow>(
      `update split_budget_adjustments set kind=$3,amount_minor=$4,note=$5,effective_date=$6,updated_at=now() where id=$1 and user_id=$2 returning *`,
      [adjustmentId, userId, input.kind, input.amountMinor, input.note, input.effectiveDate],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: { code: 'SPLIT_ADJUSTMENT_NOT_FOUND', message: 'Adjustment not found.' } });
    return adjustment(result.rows[0]);
  }

  async deleteAdjustment(userId: string, adjustmentId: string) {
    const result = await this.pool.query(
      'delete from split_budget_adjustments where id=$1 and user_id=$2',
      [adjustmentId, userId],
    );
    if (!result.rowCount) throw new NotFoundException({ error: { code: 'SPLIT_ADJUSTMENT_NOT_FOUND', message: 'Adjustment not found.' } });
  }
}
