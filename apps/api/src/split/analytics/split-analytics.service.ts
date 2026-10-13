import { Injectable, OnModuleDestroy, UnprocessableEntityException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { createPostgresPool } from '../../database/postgres.js';
import { SplitGroupsService } from '../groups/split-groups.service.js';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function validMonth(value: string | undefined, fallback: string) {
  const month = value ?? fallback;
  if (!monthPattern.test(month)) {
    throw new UnprocessableEntityException({
      error: { code: 'VALIDATION_FAILED', message: 'Month must use YYYY-MM.' },
    });
  }
  return month;
}

function safeMinor(value: string | number) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new Error('Stored money exceeds the supported range.');
  return amount;
}

@Injectable()
export class SplitAnalyticsService implements OnModuleDestroy {
  private readonly pool = createPostgresPool();

  constructor(private readonly groups: SplitGroupsService) {}

  async onModuleDestroy() {
    await this.pool.end();
  }

  async get(
    userId: string,
    groupId: string,
    requestedMonth: string | undefined,
    requestedFrom: string | undefined,
    requestedTo: string | undefined,
  ) {
    const access = await this.groups.access(userId, groupId);
    const today = new Date();
    const currentMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
    const month = validMonth(requestedMonth, currentMonth);
    const from = validMonth(requestedFrom, month);
    const to = validMonth(requestedTo, month);
    if (from > to) {
      throw new UnprocessableEntityException({
        error: { code: 'VALIDATION_FAILED', message: 'Start month must be before end month.' },
      });
    }
    const rangeStart = new Date(`${from}-01T00:00:00Z`);
    const rangeEnd = new Date(`${to}-01T00:00:00Z`);
    const monthSpan =
      (rangeEnd.getUTCFullYear() - rangeStart.getUTCFullYear()) * 12 +
      rangeEnd.getUTCMonth() -
      rangeStart.getUTCMonth();
    if (monthSpan > 35) {
      throw new UnprocessableEntityException({
        error: { code: 'VALIDATION_FAILED', message: 'Month range cannot exceed 36 months.' },
      });
    }

    const [trendResult, categoryResult] = await Promise.all([
      this.pool.query<
        QueryResultRow & {
          month_value: string;
          total_minor: string | number;
          own_minor: string | number;
        }
      >(
        `with months as (
           select generate_series(
             $3::date - interval '2 months', $3::date, interval '1 month'
           )::date month_start
         ), relevant_expenses as (
           select e.id, e.base_amount_minor, date_trunc('month', e.expense_date)::date month_start
             from split_expenses e
            where e.group_id=$1 and e.deleted_at is null
              and e.expense_date >= ($3::date - interval '2 months')
              and e.expense_date < ($3::date + interval '1 month')
         ), base_lines as (
           select e.id, e.month_start, e.base_amount_minor, gm.user_id,
                  floor(es.amount_minor::numeric * e.base_amount_minor::numeric /
                        all_expenses.original_amount_minor::numeric) base_floor,
                  row_number() over (partition by e.id order by es.created_at, es.id) line_number
             from relevant_expenses e
             join split_expenses all_expenses on all_expenses.id=e.id
             join split_expense_splits es on es.expense_id=e.id and es.group_id=$1
             join split_group_members gm on gm.id=es.group_member_id and gm.group_id=$1
         ), line_totals as (
           select *, sum(base_floor) over (partition by id) floor_total from base_lines
         ), allocated as (
           select month_start, user_id,
                  base_floor + case when line_number <= base_amount_minor::numeric - floor_total then 1 else 0 end amount_minor
             from line_totals
         ), totals as (
           select month_start, sum(base_amount_minor) total_minor
             from relevant_expenses group by month_start
         ), own_shares as (
           select month_start, sum(amount_minor) own_minor
             from allocated where user_id=$2 group by month_start
         )
         select to_char(m.month_start, 'YYYY-MM') as month_value,
                coalesce(t.total_minor,0) total_minor, coalesce(o.own_minor,0) own_minor
           from months m
           left join totals t using (month_start)
           left join own_shares o using (month_start)
          order by m.month_start`,
        [groupId, userId, `${month}-01`],
      ),
      this.pool.query<QueryResultRow & { category_key: string; amount_minor: string | number }>(
        `select category_key, sum(base_amount_minor) amount_minor
           from split_expenses
          where group_id=$1 and deleted_at is null
            and expense_date >= $2::date
            and expense_date < ($3::date + interval '1 month')
          group by category_key order by amount_minor desc, category_key`,
        [groupId, `${from}-01`, `${to}-01`],
      ),
    ]);

    const trend = trendResult.rows.map((row) => ({
      month: row.month_value,
      totalMinor: safeMinor(row.total_minor),
      ownMinor: safeMinor(row.own_minor),
    }));
    return {
      currency: access.group.baseCurrency,
      trend,
      trendTotalMinor: trend.reduce((sum, item) => sum + item.totalMinor, 0),
      trendOwnMinor: trend.reduce((sum, item) => sum + item.ownMinor, 0),
      categoryFrom: from,
      categoryTo: to,
      categories: categoryResult.rows.map((row) => ({
        categoryKey: row.category_key,
        amountMinor: safeMinor(row.amount_minor),
      })),
    };
  }
}
