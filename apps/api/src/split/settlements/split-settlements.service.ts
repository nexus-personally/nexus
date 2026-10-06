import { Inject, Injectable } from '@nestjs/common';
import { SplitBalancesService } from '../balances/split-balances.service.js';
import { SplitGroupsService } from '../groups/split-groups.service.js';
import { SPLIT_DOMAIN_RUNTIME, SPLIT_REPOSITORY, type SplitDomainRuntime, type SplitRepository } from '../persistence/split.repository.js';
import { splitConflict, splitDomainInvalid, splitInvalid } from '../split-errors.js';
import type { SplitPaymentMethod, SplitSettlement } from './split-settlement.types.js';

@Injectable()
export class SplitSettlementsService {
  constructor(private readonly groups: SplitGroupsService, private readonly balances: SplitBalancesService,
    @Inject(SPLIT_REPOSITORY) private readonly repository: SplitRepository,
    @Inject(SPLIT_DOMAIN_RUNTIME) private readonly runtime: SplitDomainRuntime) {}
  async create(userId: string, groupId: string, body: unknown) {
    const access = await this.groups.access(userId, groupId); this.groups.requireActive(access);
    if (!body || typeof body !== 'object' || Array.isArray(body)) splitInvalid({ request: ['A JSON object is required.'] });
    const value = body as Record<string, unknown>;
    const fromMemberId = typeof value['fromMemberId'] === 'string' ? value['fromMemberId'] : '';
    const toMemberId = typeof value['toMemberId'] === 'string' ? value['toMemberId'] : '';
    const amountValue = value['amountMinor'];
    const paymentMethod = value['paymentMethod'];
    const settlementDate = value['settlementDate'];
    if (!fromMemberId || !toMemberId || fromMemberId === toMemberId) splitDomainInvalid('SPLIT_SETTLEMENT_MEMBERS_INVALID','Choose two different Group Members.');
    if (typeof amountValue !== 'number' || !Number.isSafeInteger(amountValue) || amountValue <= 0) splitDomainInvalid('SPLIT_SETTLEMENT_AMOUNT_INVALID','Settlement amount must be a positive minor-unit integer.');
    if (!['cash','duitnow','bank_transfer','ewallet','other'].includes(String(paymentMethod))) splitInvalid({ paymentMethod: ['Choose a supported payment method.'] });
    if (typeof settlementDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(settlementDate)) splitInvalid({ settlementDate: ['Use YYYY-MM-DD.'] });
    const members = await this.repository.listMembers(groupId);
    if (![fromMemberId,toMemberId].every((id) => members.some((member) => member.id === id))) splitDomainInvalid('SPLIT_SETTLEMENT_MEMBERS_INVALID','Members must belong to this Group.');
    const balances = await this.balances.get(userId, groupId);
    const debts = balances.simplifyDebtsEnabled ? balances.simplifiedDebts : balances.directDebts;
    const outstanding = debts.find((debt) => debt.fromMemberId === fromMemberId && debt.toMemberId === toMemberId)?.amountMinor ?? 0;
    const amountMinor = amountValue as number;
    if (amountMinor > outstanding) splitConflict('SPLIT_SETTLEMENT_EXCEEDS_OUTSTANDING','Settlement exceeds the current outstanding debt.');
    const settlement: SplitSettlement = { id:this.runtime.uuid(),groupId,fromMemberId,toMemberId,amountMinor,currency:access.group.baseCurrency,
      paymentMethod: paymentMethod as SplitPaymentMethod,settlementDate:settlementDate as string,note:typeof value['note']==='string' ? value['note'].trim() || null : null,
      createdByUserId:userId,createdAt:this.runtime.now() };
    return this.repository.createSettlement({ settlement, activityId:this.runtime.uuid() });
  }
  async list(userId: string, groupId: string) { await this.groups.access(userId,groupId); return this.repository.listSettlements(groupId); }
}
