import { Inject, Injectable } from '@nestjs/common';
import type { SplitCurrentUser } from '../auth/split-auth.types.js';
import { SplitGroupsService } from '../groups/split-groups.service.js';
import {
  SPLIT_DOMAIN_RUNTIME,
  SPLIT_REPOSITORY,
  type SplitDomainRuntime,
  type SplitRepository,
} from '../persistence/split.repository.js';
import {
  splitDomainInvalid,
  splitForbidden,
  splitInvalid,
  splitNotFound,
} from '../split-errors.js';
import { validateExpenseInput } from './split-expense.validation.js';
import type {
  SplitExpense,
  SplitExpensePayment,
  SplitExpenseShare,
  SplitExpenseWrite,
} from './split-expense.types.js';
@Injectable()
export class SplitExpensesService {
  constructor(
    private readonly groups: SplitGroupsService,
    @Inject(SPLIT_REPOSITORY) private readonly repository: SplitRepository,
    @Inject(SPLIT_DOMAIN_RUNTIME) private readonly runtime: SplitDomainRuntime,
  ) {}
  async create(user: Pick<SplitCurrentUser, 'id'>, groupId: string, body: unknown) {
    const access = await this.groups.access(user.id, groupId);
    this.groups.requireActive(access);
    const input = validateExpenseInput(body, access.group.baseCurrency);
    await this.validateMembers(
      groupId,
      input.payments.map((x) => x.memberId),
      input.allocations.map((x) => x.memberId),
    );
    const now = this.runtime.now(),
      expenseId = this.runtime.uuid();
    const expense: SplitExpense = {
      id: expenseId,
      groupId,
      description: input.description,
      categoryKey: input.categoryKey,
      splitMethod: input.splitMethod,
      originalAmountMinor: input.amountMinor,
      originalCurrency: input.currency,
      baseAmountMinor: input.baseAmountMinor,
      baseCurrency: access.group.baseCurrency,
      exchangeRate: input.exchangeRate,
      expenseDate: input.expenseDate,
      note: input.note,
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedByUserId: null,
      payments: input.payments.map((x) =>
        this.payment(expenseId, groupId, x.memberId, x.amountMinor, now),
      ),
      splits: input.allocations.map((x) =>
        this.share(expenseId, groupId, x.memberId, x.amountMinor, now),
      ),
    };
    return this.repository.createExpense({
      expense,
      activityId: this.runtime.uuid(),
      actorUserId: user.id,
    });
  }
  async list(userId: string, groupId: string, raw:Record<string,string|undefined>={}) {
    await this.groups.access(userId, groupId);
    const categories=new Set(['food','transport','accommodation','shopping','entertainment','travel','home','bills','grocery','health','gift','other']);
    const currencies=new Set(['MYR','USD','SGD','CNY','TWD','JPY','HKD']);
    const date=(value:string|undefined,field:string)=>{if(value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))splitInvalid({[field]:['Use YYYY-MM-DD.']});return value;};
    if(raw.category&&!categories.has(raw.category))splitInvalid({category:['Unsupported category.']});
    if(raw.currency&&!currencies.has(raw.currency))splitInvalid({currency:['Unsupported currency.']});
    const limit=30;
    let beforeCreatedAt:Date|undefined,beforeId:string|undefined;
    if(raw.cursor){try{const [at,id]=Buffer.from(raw.cursor,'base64url').toString('utf8').split('|');beforeCreatedAt=new Date(at!);beforeId=id;if(!id||Number.isNaN(beforeCreatedAt.getTime()))throw new Error();}catch{return splitInvalid({cursor:['Invalid cursor.']});}}
    const rows=await this.repository.searchExpenses(groupId,{search:raw.search?.trim().slice(0,100)||undefined,category:raw.category||undefined,payerId:raw.payerId||undefined,memberId:raw.memberId||undefined,currency:raw.currency||undefined,from:date(raw.from,'from'),to:date(raw.to,'to'),beforeCreatedAt,beforeId,limit:limit+1});
    const items=rows.slice(0,limit),last=items.at(-1);
    return {items,nextCursor:rows.length>limit&&last?Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64url'):null};
  }
  async get(userId: string, groupId: string, expenseId: string) {
    await this.groups.access(userId, groupId);
    return (
      (await this.repository.findExpense(groupId, expenseId)) ??
      splitNotFound('SPLIT_EXPENSE_NOT_FOUND', 'Expense not found.')
    );
  }
  async update(
    user: Pick<SplitCurrentUser, 'id'>,
    groupId: string,
    expenseId: string,
    body: unknown,
  ) {
    const access = await this.groups.access(user.id, groupId);
    this.groups.requireActive(access);
    const existing =
      (await this.repository.findExpense(groupId, expenseId)) ??
      splitNotFound('SPLIT_EXPENSE_NOT_FOUND', 'Expense not found.');
    this.requireEditor(access.membership.role, user.id, existing);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      splitInvalid({ request: ['A JSON object is required.'] });
    const patch = body as Record<string, unknown>;
    const merged = {
      description: existing.description,
      categoryKey: existing.categoryKey,
      amountMinor: existing.originalAmountMinor,
      currency: existing.originalCurrency,
      exchangeRate:
        existing.originalCurrency === existing.baseCurrency ? undefined : existing.exchangeRate,
      expenseDate: existing.expenseDate,
      note: existing.note,
      payments: existing.payments.map((x) => ({
        memberId: x.memberId,
        amountMinor: x.amountMinor,
      })),
      split: {
        method: 'exact',
        allocations: existing.splits.map((x) => ({
          memberId: x.memberId,
          amountMinor: x.amountMinor,
        })),
      },
      ...patch,
    };
    const input = validateExpenseInput(merged, access.group.baseCurrency);
    await this.validateMembers(
      groupId,
      input.payments.map((x) => x.memberId),
      input.allocations.map((x) => x.memberId),
    );
    const now = this.runtime.now();
    const expense: SplitExpense = {
      ...existing,
      description: input.description,
      categoryKey: input.categoryKey,
      splitMethod: input.splitMethod,
      originalAmountMinor: input.amountMinor,
      originalCurrency: input.currency,
      baseAmountMinor: input.baseAmountMinor,
      baseCurrency: access.group.baseCurrency,
      exchangeRate: input.exchangeRate,
      expenseDate: input.expenseDate,
      note: input.note,
      updatedAt: now,
      payments: input.payments.map((x) =>
        this.payment(expenseId, groupId, x.memberId, x.amountMinor, now),
      ),
      splits: input.allocations.map((x) =>
        this.share(expenseId, groupId, x.memberId, x.amountMinor, now),
      ),
    };
    return this.repository.updateExpense({
      expense,
      activityId: this.runtime.uuid(),
      actorUserId: user.id,
    });
  }
  async delete(userId: string, groupId: string, expenseId: string) {
    const access = await this.groups.access(userId, groupId);
    this.groups.requireActive(access);
    const expense =
      (await this.repository.findExpense(groupId, expenseId)) ??
      splitNotFound('SPLIT_EXPENSE_NOT_FOUND', 'Expense not found.');
    this.requireEditor(access.membership.role, userId, expense);
    return (
      (await this.repository.deleteExpense(
        groupId,
        expenseId,
        userId,
        this.runtime.uuid(),
        this.runtime.now(),
      )) ?? splitNotFound('SPLIT_EXPENSE_NOT_FOUND', 'Expense not found.')
    );
  }
  private requireEditor(role: string, userId: string, expense: SplitExpense) {
    if (role !== 'owner' && expense.createdByUserId !== userId)
      splitForbidden('SPLIT_EXPENSE_FORBIDDEN', 'You cannot change this Expense.');
  }
  private async validateMembers(groupId: string, payers: string[], participants: string[]) {
    const active = new Set(
      (await this.repository.listMembers(groupId))
        .filter((x) => x.membershipStatus === 'active')
        .map((x) => x.id),
    );
    if (payers.some((id) => !active.has(id)))
      splitDomainInvalid(
        'SPLIT_PAYER_INVALID',
        'Every payer must be an active member of this Group.',
        'payments',
      );
    if (participants.some((id) => !active.has(id)))
      splitDomainInvalid(
        'SPLIT_PARTICIPANT_INVALID',
        'Every participant must be an active member of this Group.',
        'split',
      );
  }
  private payment(
    expenseId: string,
    groupId: string,
    memberId: string,
    amountMinor: number,
    at: Date,
  ): SplitExpensePayment {
    return { id: this.runtime.uuid(), expenseId, groupId, memberId, amountMinor, createdAt: at };
  }
  private share(
    expenseId: string,
    groupId: string,
    memberId: string,
    amountMinor: number,
    at: Date,
  ): SplitExpenseShare {
    return { id: this.runtime.uuid(), expenseId, groupId, memberId, amountMinor, createdAt: at };
  }
}
