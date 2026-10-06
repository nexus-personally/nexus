import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { createPostgresPool } from '../../database/postgres.js';
import type {
  SplitClaimResult,
  SplitGroup,
  SplitGroupAccess,
  SplitGroupStatus,
  SplitGroupSummary,
  SplitInvite,
  SplitMember,
  SplitActivity,
} from './split-domain.types.js';
import type { SplitExpenseQuery, SplitRepository } from './split.repository.js';
import { splitClaimMembershipPlan } from '../members/split-membership-lifecycle.js';
import type { SplitExpense, SplitExpenseWrite } from '../expenses/split-expense.types.js';
import type { SplitSettlement, SplitSettlementWrite } from '../settlements/split-settlement.types.js';

interface GroupRow extends QueryResultRow {
  id: string;
  name: string;
  type: SplitGroup['type'];
  base_currency: SplitGroup['baseCurrency'];
  simplify_debts: boolean;
  start_date: string | null;
  end_date: string | null;
  status: SplitGroupStatus;
  created_by_user_id: string;
  created_at: Date | string;
  updated_at: Date | string;
}
interface MemberRow extends QueryResultRow {
  id: string;
  group_id: string;
  user_id: string | null;
  display_name: string;
  role: SplitMember['role'];
  membership_status: SplitMember['membershipStatus'];
  joined_at: Date | string;
  linked_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}
interface InviteRow extends QueryResultRow {
  id: string;
  group_id: string;
  target_member_id: string | null;
  token_hash: string;
  created_by_user_id: string;
  expires_at: Date | string;
  claimed_at: Date | string | null;
  claimed_by_user_id: string | null;
  revoked_at: Date | string | null;
  created_at: Date | string;
}
interface ExpenseRow extends QueryResultRow {
  id: string;
  group_id: string;
  description: string;
  category_key: SplitExpense['categoryKey'];
  split_method: SplitExpense['splitMethod'];
  original_amount_minor: string | number;
  original_currency: SplitExpense['originalCurrency'];
  base_amount_minor: string | number;
  base_currency: SplitExpense['baseCurrency'];
  exchange_rate: string;
  expense_date: string;
  note: string | null;
  created_by_user_id: string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
  deleted_by_user_id: string | null;
  payments?: Array<{
    id: string;
    expenseId: string;
    groupId: string;
    memberId: string;
    amountMinor: string | number;
    createdAt: Date | string;
  }>;
  splits?: Array<{
    id: string;
    expenseId: string;
    groupId: string;
    memberId: string;
    amountMinor: string | number;
    createdAt: Date | string;
  }>;
}
interface SettlementRow extends QueryResultRow {
  id: string; group_id: string; from_group_member_id: string; to_group_member_id: string;
  amount_minor: string | number; currency: string; payment_method: SplitSettlement['paymentMethod'];
  settlement_date: string; note: string | null; created_by_user_id: string; created_at: Date | string;
}
interface ActivityRow extends QueryResultRow { id:string;group_id:string;actor_user_id:string|null;action_type:string;entity_type:string;entity_id:string|null;metadata:Record<string,unknown>;created_at:Date|string; }
const date = (value: Date | string) => new Date(value);
const group = (r: GroupRow): SplitGroup => ({
  id: r.id,
  name: r.name,
  type: r.type,
  baseCurrency: r.base_currency,
  simplifyDebts: r.simplify_debts,
  startDate: r.start_date,
  endDate: r.end_date,
  status: r.status,
  createdByUserId: r.created_by_user_id,
  createdAt: date(r.created_at),
  updatedAt: date(r.updated_at),
});
const member = (r: MemberRow): SplitMember => ({
  id: r.id,
  groupId: r.group_id,
  userId: r.user_id,
  displayName: r.display_name,
  role: r.role,
  membershipStatus: r.membership_status,
  joinedAt: date(r.joined_at),
  linkedAt: r.linked_at ? date(r.linked_at) : null,
  createdAt: date(r.created_at),
  updatedAt: date(r.updated_at),
});
const invite = (r: InviteRow): SplitInvite => ({
  id: r.id,
  groupId: r.group_id,
  targetMemberId: r.target_member_id,
  tokenHash: r.token_hash,
  createdByUserId: r.created_by_user_id,
  expiresAt: date(r.expires_at),
  claimedAt: r.claimed_at ? date(r.claimed_at) : null,
  claimedByUserId: r.claimed_by_user_id,
  revokedAt: r.revoked_at ? date(r.revoked_at) : null,
  createdAt: date(r.created_at),
});
const safeAmount = (value: string | number) => {
  const result = Number(value);
  if (!Number.isSafeInteger(result))
    throw new Error('Stored money exceeds JavaScript safe integer range.');
  return result;
};
const expense = (r: ExpenseRow): SplitExpense => ({
  id: r.id,
  groupId: r.group_id,
  description: r.description,
  categoryKey: r.category_key,
  splitMethod: r.split_method,
  originalAmountMinor: safeAmount(r.original_amount_minor),
  originalCurrency: r.original_currency,
  baseAmountMinor: safeAmount(r.base_amount_minor),
  baseCurrency: r.base_currency,
  exchangeRate: r.exchange_rate,
  expenseDate: r.expense_date,
  note: r.note,
  createdByUserId: r.created_by_user_id,
  createdAt: date(r.created_at),
  updatedAt: date(r.updated_at),
  deletedAt: r.deleted_at ? date(r.deleted_at) : null,
  deletedByUserId: r.deleted_by_user_id,
  payments: (r.payments ?? []).map((x) => ({
    id: x.id,
    expenseId: x.expenseId,
    groupId: x.groupId,
    memberId: x.memberId,
    amountMinor: safeAmount(x.amountMinor),
    createdAt: date(x.createdAt),
  })),
  splits: (r.splits ?? []).map((x) => ({
    id: x.id,
    expenseId: x.expenseId,
    groupId: x.groupId,
    memberId: x.memberId,
    amountMinor: safeAmount(x.amountMinor),
    createdAt: date(x.createdAt),
  })),
});
const settlement = (r: SettlementRow): SplitSettlement => ({
  id: r.id, groupId: r.group_id, fromMemberId: r.from_group_member_id,
  toMemberId: r.to_group_member_id, amountMinor: safeAmount(r.amount_minor), currency: r.currency,
  paymentMethod: r.payment_method, settlementDate: r.settlement_date, note: r.note,
  createdByUserId: r.created_by_user_id, createdAt: date(r.created_at),
});
const expenseSelect = `select e.*,
  coalesce((select json_agg(json_build_object('id',p.id,'expenseId',p.expense_id,'groupId',p.group_id,'memberId',p.group_member_id,'amountMinor',p.amount_minor,'createdAt',p.created_at) order by p.created_at,p.id) from split_expense_payments p where p.expense_id=e.id),'[]') payments,
  coalesce((select json_agg(json_build_object('id',s.id,'expenseId',s.expense_id,'groupId',s.group_id,'memberId',s.group_member_id,'amountMinor',s.amount_minor,'createdAt',s.created_at) order by s.created_at,s.id) from split_expense_splits s where s.expense_id=e.id),'[]') splits
  from split_expenses e`;

async function activity(
  c: PoolClient,
  id: string,
  groupId: string,
  actor: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  at: Date,
  metadata: Record<string, unknown> = {},
) {
  await c.query(
    `insert into split_activity_logs (id,group_id,actor_user_id,action_type,entity_type,entity_id,created_at,metadata) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, groupId, actor, action, entity, entityId, at, JSON.stringify(metadata)],
  );
}

@Injectable()
export class PostgresSplitRepository implements SplitRepository, OnModuleDestroy {
  private readonly pool = createPostgresPool();
  async onModuleDestroy() {
    await this.pool.end();
  }
  async tx<T>(fn: (c: PoolClient) => Promise<T>) {
    const c = await this.pool.connect();
    try {
      await c.query('begin');
      const value = await fn(c);
      await c.query('commit');
      return value;
    } catch (e) {
      await c.query('rollback');
      throw e;
    } finally {
      c.release();
    }
  }
  async createGroup(input: { group: SplitGroup; owner: SplitMember }) {
    return this.tx(async (c) => {
      const g = input.group,
        o = input.owner;
      const r = await c.query<GroupRow>(
        `insert into split_groups (id,name,type,base_currency,simplify_debts,start_date,end_date,status,created_by_user_id,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
        [
          g.id,
          g.name,
          g.type,
          g.baseCurrency,
          g.simplifyDebts,
          g.startDate,
          g.endDate,
          g.status,
          g.createdByUserId,
          g.createdAt,
          g.updatedAt,
        ],
      );
      await c.query(
        `insert into split_group_members (id,group_id,user_id,display_name,role,membership_status,joined_at,linked_at,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          o.id,
          o.groupId,
          o.userId,
          o.displayName,
          o.role,
          o.membershipStatus,
          o.joinedAt,
          o.linkedAt,
          o.createdAt,
          o.updatedAt,
        ],
      );
      await activity(
        c,
        crypto.randomUUID(),
        g.id,
        g.createdByUserId,
        'GROUP_CREATED',
        'group',
        g.id,
        g.createdAt,
      );
      return group(r.rows[0]!);
    });
  }
  async listGroups(userId: string, status: SplitGroupStatus) {
    const r = await this.pool.query<
      GroupRow & { member_count: string; current_user_role: SplitMember['role'] }
    >(
      `select g.*, m.role current_user_role,
              (select count(*) from split_group_members members
                where members.group_id=g.id and members.membership_status='active') member_count
         from split_groups g join split_group_members m on m.group_id=g.id
        where m.user_id=$1 and m.membership_status='active' and g.status=$2
        order by g.updated_at desc`,
      [userId, status],
    );
    return r.rows.map((row): SplitGroupSummary => ({
      ...group(row),
      memberCount: Number(row.member_count),
      currentUserRole: row.current_user_role,
    }));
  }
  async findGroupAccess(groupId: string, userId: string) {
    const r = await this.pool.query<
      GroupRow &
        MemberRow & {
          member_id: string;
          member_group_id: string;
          member_user_id: string;
          member_display_name: string;
          member_role: SplitMember['role'];
          member_status: SplitMember['membershipStatus'];
          member_joined_at: Date;
          member_linked_at: Date | null;
          member_created_at: Date;
          member_updated_at: Date;
        }
    >(
      `select g.*,m.id member_id,m.group_id member_group_id,m.user_id member_user_id,m.display_name member_display_name,m.role member_role,m.membership_status member_status,m.joined_at member_joined_at,m.linked_at member_linked_at,m.created_at member_created_at,m.updated_at member_updated_at from split_groups g join split_group_members m on m.group_id=g.id where g.id=$1 and m.user_id=$2 and m.membership_status='active'`,
      [groupId, userId],
    );
    const x = r.rows[0];
    if (!x) return undefined;
    return {
      group: group(x),
      membership: member({
        id: x.member_id,
        group_id: x.member_group_id,
        user_id: x.member_user_id,
        display_name: x.member_display_name,
        role: x.member_role,
        membership_status: x.member_status,
        joined_at: x.member_joined_at,
        linked_at: x.member_linked_at,
        created_at: x.member_created_at,
        updated_at: x.member_updated_at,
      }),
    };
  }
  async updateGroup(g: SplitGroup, actor: string) {
    return this.tx(async (c) => {
      const r = await c.query<GroupRow>(
        `update split_groups set name=$2,type=$3,base_currency=$4,simplify_debts=$5,start_date=$6,end_date=$7,updated_at=$8 where id=$1 returning *`,
        [
          g.id,
          g.name,
          g.type,
          g.baseCurrency,
          g.simplifyDebts,
          g.startDate,
          g.endDate,
          g.updatedAt,
        ],
      );
      await activity(
        c,
        crypto.randomUUID(),
        g.id,
        actor,
        'GROUP_UPDATED',
        'group',
        g.id,
        g.updatedAt,
      );
      return group(r.rows[0]!);
    });
  }
  async setGroupStatus(groupId: string, status: SplitGroupStatus, actor: string, at: Date) {
    return this.tx(async (c) => {
      const r = await c.query<GroupRow>(
        `update split_groups set status=$2,updated_at=$3 where id=$1 returning *`,
        [groupId, status, at],
      );
      await activity(
        c,
        crypto.randomUUID(),
        groupId,
        actor,
        status === 'archived' ? 'GROUP_ARCHIVED' : 'GROUP_REOPENED',
        'group',
        groupId,
        at,
      );
      return group(r.rows[0]!);
    });
  }
  async listMembers(groupId: string) {
    const r = await this.pool.query<MemberRow>(
      `select * from split_group_members where group_id=$1 order by created_at`,
      [groupId],
    );
    return r.rows.map(member);
  }
  async findMember(groupId: string, memberId: string) {
    const r = await this.pool.query<MemberRow>(
      `select * from split_group_members where group_id=$1 and id=$2`,
      [groupId, memberId],
    );
    return r.rows[0] ? member(r.rows[0]) : undefined;
  }
  async createGuest(m: SplitMember, actor: string) {
    return this.tx(async (c) => {
      const r = await c.query<MemberRow>(
        `insert into split_group_members (id,group_id,user_id,display_name,role,membership_status,joined_at,linked_at,created_at,updated_at) values ($1,$2,null,$3,'member','active',$4,null,$4,$4) returning *`,
        [m.id, m.groupId, m.displayName, m.createdAt],
      );
      await activity(
        c,
        crypto.randomUUID(),
        m.groupId,
        actor,
        'MEMBER_ADDED',
        'member',
        m.id,
        m.createdAt,
      );
      return member(r.rows[0]!);
    });
  }
  async removeMember(groupId: string, memberId: string, actor: string, at: Date) {
    return this.tx(async (c) => {
      const r = await c.query<MemberRow>(
        `update split_group_members set membership_status='removed',updated_at=$3 where group_id=$1 and id=$2 and membership_status='active' returning *`,
        [groupId, memberId, at],
      );
      if (!r.rows[0]) throw new Error('member_not_active');
      await activity(
        c,
        crypto.randomUUID(),
        groupId,
        actor,
        'MEMBER_REMOVED',
        'member',
        memberId,
        at,
      );
      return member(r.rows[0]);
    });
  }
  async createInvite(i: SplitInvite, actor: string) {
    return this.tx(async (c) => {
      const r = await c.query<InviteRow>(
        `insert into split_invites (id,group_id,target_member_id,token_hash,created_by_user_id,expires_at,created_at) values ($1,$2,$3,$4,$5,$6,$7) returning *`,
        [
          i.id,
          i.groupId,
          i.targetMemberId,
          i.tokenHash,
          i.createdByUserId,
          i.expiresAt,
          i.createdAt,
        ],
      );
      await activity(
        c,
        crypto.randomUUID(),
        i.groupId,
        actor,
        'INVITE_CREATED',
        'invite',
        i.id,
        i.createdAt,
      );
      return invite(r.rows[0]!);
    });
  }
  async listInvites(groupId: string) {
    const r = await this.pool.query<InviteRow>(
      `select * from split_invites where group_id=$1 order by created_at desc`,
      [groupId],
    );
    return r.rows.map(invite);
  }
  async previewInvite(tokenHash: string, now: Date) {
    const r = await this.pool.query<
      InviteRow & {
        group_name: string;
        group_type: SplitGroup['type'];
        target_display_name: string | null;
      }
    >(
      `select i.*,g.name group_name,g.type group_type,m.display_name target_display_name from split_invites i join split_groups g on g.id=i.group_id left join split_group_members m on m.id=i.target_member_id and m.group_id=i.group_id where i.token_hash=$1`,
      [tokenHash],
    );
    const x = r.rows[0];
    if (!x) return { state: 'not_found' as const };
    if (x.revoked_at) return { state: 'revoked' as const };
    if (x.claimed_at) return { state: 'claimed' as const };
    if (date(x.expires_at) <= now) return { state: 'expired' as const };
    return {
      state: 'valid' as const,
      preview: {
        groupName: x.group_name,
        groupType: x.group_type,
        targetDisplayName: x.target_display_name,
        expiresAt: date(x.expires_at),
      },
    };
  }
  async revokeInvite(groupId: string, inviteId: string, actor: string, at: Date) {
    return this.tx(async (c) => {
      const r = await c.query<InviteRow>(
        `update split_invites set revoked_at=$3 where group_id=$1 and id=$2 and revoked_at is null and claimed_at is null returning *`,
        [groupId, inviteId, at],
      );
      if (!r.rows[0]) return undefined;
      await activity(
        c,
        crypto.randomUUID(),
        groupId,
        actor,
        'INVITE_REVOKED',
        'invite',
        inviteId,
        at,
      );
      return invite(r.rows[0]);
    });
  }
  async claimInvite(input: {
    tokenHash: string;
    userId: string;
    displayName: string;
    memberId: string;
    activityIds: string[];
    now: Date;
  }): Promise<SplitClaimResult> {
    return this.tx<SplitClaimResult>(async (c) => {
      const r = await c.query<InviteRow & { group_status: SplitGroupStatus }>(
        `select i.*,g.status group_status from split_invites i join split_groups g on g.id=i.group_id where i.token_hash=$1 for update of i`,
        [input.tokenHash],
      );
      const i = r.rows[0];
      if (!i) return { status: 'not_found' };
      if (i.revoked_at) return { status: 'revoked' };
      if (i.claimed_at) return { status: 'already_claimed' };
      if (date(i.expires_at) <= input.now) return { status: 'expired' };
      if (i.group_status === 'archived') return { status: 'group_archived' };
      const existing = await c.query<MemberRow>(
        `select * from split_group_members where group_id=$1 and user_id=$2 for update`,
        [i.group_id, input.userId],
      );
      const existingMembership = existing.rows[0];
      const plan = splitClaimMembershipPlan(
        existingMembership
          ? { id: existingMembership.id, membershipStatus: existingMembership.membership_status }
          : undefined,
        Boolean(i.target_member_id),
      );
      if (plan.kind === 'conflict') return { status: 'member_exists' };
      let memberId = input.memberId;
      if (i.target_member_id) {
        const target = await c.query<MemberRow>(
          `select * from split_group_members where group_id=$1 and id=$2 for update`,
          [i.group_id, i.target_member_id],
        );
        const m = target.rows[0];
        if (!m || m.user_id || m.membership_status !== 'active')
          return { status: 'target_invalid' };
        memberId = m.id;
        await c.query(
          `update split_group_members set user_id=$2,linked_at=$3,updated_at=$3 where id=$1`,
          [m.id, input.userId, input.now],
        );
      } else if (plan.kind === 'reactivate') {
        memberId = plan.memberId;
        await c.query(
          `update split_group_members
             set membership_status='active',role='member',joined_at=$2,updated_at=$2
           where id=$1`,
          [memberId, input.now],
        );
      } else {
        await c.query(
          `insert into split_group_members (id,group_id,user_id,display_name,role,membership_status,joined_at,linked_at,created_at,updated_at) values ($1,$2,$3,$4,'member','active',$5,$5,$5,$5)`,
          [memberId, i.group_id, input.userId, input.displayName, input.now],
        );
      }
      await c.query(`update split_invites set claimed_at=$2,claimed_by_user_id=$3 where id=$1`, [
        i.id,
        input.now,
        input.userId,
      ]);
      await activity(
        c,
        input.activityIds[0]!,
        i.group_id,
        input.userId,
        'MEMBER_JOINED',
        'member',
        memberId,
        input.now,
      );
      await activity(
        c,
        input.activityIds[1]!,
        i.group_id,
        input.userId,
        'INVITE_CLAIMED',
        'invite',
        i.id,
        input.now,
      );
      return { status: 'claimed', groupId: i.group_id, memberId };
    }).catch((e: unknown) => {
      if ((e as { code?: string }).code === '23505') return { status: 'member_exists' as const };
      throw e;
    });
  }

  async hasActiveExpenses(groupId: string) {
    const r = await this.pool.query(
      `select 1 from split_expenses where group_id=$1 limit 1`,
      [groupId],
    );
    return Boolean(r.rowCount);
  }

  async createExpense(write: SplitExpenseWrite) {
    return this.tx(async (c) => {
      await this.insertExpense(c, write.expense);
      await this.replaceExpenseLines(c, write.expense);
      await activity(
        c,
        write.activityId,
        write.expense.groupId,
        write.actorUserId,
        'EXPENSE_CREATED',
        'expense',
        write.expense.id,
        write.expense.createdAt,
        {
          description: write.expense.description,
          amountMinor: write.expense.originalAmountMinor,
          currency: write.expense.originalCurrency,
        },
      );
      return write.expense;
    });
  }

  async listExpenses(groupId: string) {
    const r = await this.pool.query<ExpenseRow>(
      `${expenseSelect} where e.group_id=$1 and e.deleted_at is null order by e.expense_date desc,e.created_at desc`,
      [groupId],
    );
    return r.rows.map(expense);
  }

  async searchExpenses(groupId: string, query: SplitExpenseQuery) {
    const values: unknown[] = [groupId];
    const add = (value: unknown) => { values.push(value); return `$${values.length}`; };
    const where = ['e.group_id=$1', 'e.deleted_at is null'];
    if (query.search) { const p=add(`%${query.search}%`); where.push(`(e.description ilike ${p} or coalesce(e.note,'') ilike ${p} or e.category_key ilike ${p})`); }
    if (query.category) where.push(`e.category_key=${add(query.category)}`);
    if (query.currency) where.push(`e.original_currency=${add(query.currency)}`);
    if (query.from) where.push(`e.expense_date>=${add(query.from)}`);
    if (query.to) where.push(`e.expense_date<=${add(query.to)}`);
    if (query.payerId) where.push(`exists(select 1 from split_expense_payments ep where ep.expense_id=e.id and ep.group_member_id=${add(query.payerId)})`);
    if (query.memberId) where.push(`exists(select 1 from split_expense_splits es where es.expense_id=e.id and es.group_member_id=${add(query.memberId)})`);
    if (query.beforeCreatedAt && query.beforeId) { const at=add(query.beforeCreatedAt), id=add(query.beforeId); where.push(`(e.created_at,e.id)<(${at},${id})`); }
    const limit=add(query.limit);
    const result=await this.pool.query<ExpenseRow>(`${expenseSelect} where ${where.join(' and ')} order by e.created_at desc,e.id desc limit ${limit}`,values);
    return result.rows.map(expense);
  }

  async findExpense(groupId: string, expenseId: string) {
    const r = await this.pool.query<ExpenseRow>(
      `${expenseSelect} where e.group_id=$1 and e.id=$2 and e.deleted_at is null`,
      [groupId, expenseId],
    );
    return r.rows[0] ? expense(r.rows[0]) : undefined;
  }

  async updateExpense(write: SplitExpenseWrite) {
    return this.tx(async (c) => {
      const e = write.expense;
      const updated = await c.query(
        `update split_expenses set description=$3,category_key=$4,split_method=$5,original_amount_minor=$6,original_currency=$7,base_amount_minor=$8,base_currency=$9,exchange_rate=$10,expense_date=$11,note=$12,updated_at=$13 where group_id=$1 and id=$2 and deleted_at is null`,
        [
          e.groupId,
          e.id,
          e.description,
          e.categoryKey,
          e.splitMethod,
          e.originalAmountMinor,
          e.originalCurrency,
          e.baseAmountMinor,
          e.baseCurrency,
          e.exchangeRate,
          e.expenseDate,
          e.note,
          e.updatedAt,
        ],
      );
      if (!updated.rowCount) throw new Error('expense_not_found');
      await c.query(`delete from split_expense_payments where expense_id=$1`, [e.id]);
      await c.query(`delete from split_expense_splits where expense_id=$1`, [e.id]);
      await this.replaceExpenseLines(c, e);
      await activity(
        c,
        write.activityId,
        e.groupId,
        write.actorUserId,
        'EXPENSE_UPDATED',
        'expense',
        e.id,
        e.updatedAt,
        {
          description: e.description,
          amountMinor: e.originalAmountMinor,
          currency: e.originalCurrency,
        },
      );
      return e;
    });
  }

  async deleteExpense(
    groupId: string,
    expenseId: string,
    actorUserId: string,
    activityId: string,
    at: Date,
  ) {
    return this.tx(async (c) => {
      const updated = await c.query<ExpenseRow>(
        `update split_expenses set deleted_at=$3,deleted_by_user_id=$4,updated_at=$3 where group_id=$1 and id=$2 and deleted_at is null returning *`,
        [groupId, expenseId, at, actorUserId],
      );
      if (!updated.rows[0]) return undefined;
      await activity(
        c,
        activityId,
        groupId,
        actorUserId,
        'EXPENSE_DELETED',
        'expense',
        expenseId,
        at,
        {
          description: updated.rows[0].description,
          amountMinor: safeAmount(updated.rows[0].original_amount_minor),
          currency: updated.rows[0].original_currency,
        },
      );
      const row = updated.rows[0];
      return expense({ ...row, payments: [], splits: [] });
    });
  }

  async createSettlement(write: SplitSettlementWrite) {
    return this.tx(async (c) => {
      const s = write.settlement;
      await c.query(
        `insert into split_settlements (id,group_id,from_group_member_id,to_group_member_id,amount_minor,currency,payment_method,settlement_date,note,created_by_user_id,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [s.id,s.groupId,s.fromMemberId,s.toMemberId,s.amountMinor,s.currency,s.paymentMethod,s.settlementDate,s.note,s.createdByUserId,s.createdAt],
      );
      await activity(c,write.activityId,s.groupId,s.createdByUserId,'SETTLEMENT_CREATED','settlement',s.id,s.createdAt,{ fromMemberId:s.fromMemberId,toMemberId:s.toMemberId,amountMinor:s.amountMinor,currency:s.currency });
      return s;
    });
  }

  async listSettlements(groupId: string) {
    const result = await this.pool.query<SettlementRow>(`select * from split_settlements where group_id=$1 order by settlement_date desc,created_at desc`,[groupId]);
    return result.rows.map(settlement);
  }
  async listActivity(groupId:string,before:Date|null,limit:number):Promise<SplitActivity[]> {
    const result=await this.pool.query<ActivityRow>(`select * from split_activity_logs where group_id=$1 and ($2::timestamptz is null or created_at < $2) order by created_at desc,id desc limit $3`,[groupId,before,limit]);
    return result.rows.map((r)=>({id:r.id,groupId:r.group_id,actorUserId:r.actor_user_id,actionType:r.action_type,entityType:r.entity_type,entityId:r.entity_id,metadata:r.metadata,createdAt:date(r.created_at)}));
  }

  private async insertExpense(c: PoolClient, e: SplitExpense) {
    await c.query(
      `insert into split_expenses (id,group_id,description,category_key,split_method,original_amount_minor,original_currency,base_amount_minor,base_currency,exchange_rate,expense_date,note,created_by_user_id,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        e.id,
        e.groupId,
        e.description,
        e.categoryKey,
        e.splitMethod,
        e.originalAmountMinor,
        e.originalCurrency,
        e.baseAmountMinor,
        e.baseCurrency,
        e.exchangeRate,
        e.expenseDate,
        e.note,
        e.createdByUserId,
        e.createdAt,
        e.updatedAt,
      ],
    );
  }

  private async replaceExpenseLines(c: PoolClient, e: SplitExpense) {
    for (const p of e.payments)
      await c.query(
        `insert into split_expense_payments (id,group_id,expense_id,group_member_id,amount_minor,created_at) values ($1,$2,$3,$4,$5,$6)`,
        [p.id, p.groupId, p.expenseId, p.memberId, p.amountMinor, p.createdAt],
      );
    for (const s of e.splits)
      await c.query(
        `insert into split_expense_splits (id,group_id,expense_id,group_member_id,amount_minor,created_at) values ($1,$2,$3,$4,$5,$6)`,
        [s.id, s.groupId, s.expenseId, s.memberId, s.amountMinor, s.createdAt],
      );
  }
}
