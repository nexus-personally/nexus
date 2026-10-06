import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  SplitGroup,
  SplitGroupInput,
  SplitInviteCreated,
  SplitInvitePreview,
  SplitMember,
} from './split.models';
import type {
  SplitActivity,
  SplitBalances,
  SplitExchangeRateQuote,
  SplitExpense,
  SplitSettlement,
} from './split-expense.models';
@Injectable({ providedIn: 'root' })
export class SplitApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/split';
  groups(status: 'active' | 'archived') {
    return this.http.get<SplitGroup[]>(`${this.base}/groups`, { params: { status } });
  }
  group(id: string) {
    return this.http.get<SplitGroup>(`${this.base}/groups/${id}`);
  }
  createGroup(input: SplitGroupInput) {
    return this.http.post<SplitGroup>(`${this.base}/groups`, input);
  }
  updateGroup(id: string, input: Partial<SplitGroupInput>) {
    return this.http.patch<SplitGroup>(`${this.base}/groups/${id}`, input);
  }
  archive(id: string) {
    return this.http.post<SplitGroup>(`${this.base}/groups/${id}/archive`, {});
  }
  reopen(id: string) {
    return this.http.post<SplitGroup>(`${this.base}/groups/${id}/reopen`, {});
  }
  members(id: string) {
    return this.http.get<SplitMember[]>(`${this.base}/groups/${id}/members`);
  }
  createGuest(id: string, displayName: string) {
    return this.http.post<SplitMember>(`${this.base}/groups/${id}/members/guest`, { displayName });
  }
  createInvite(id: string, targetMemberId?: string) {
    return this.http.post<SplitInviteCreated>(
      `${this.base}/groups/${id}/invites`,
      targetMemberId ? { targetMemberId } : {},
    );
  }
  previewInvite(token: string) {
    return this.http.get<SplitInvitePreview>(
      `${this.base}/invites/${encodeURIComponent(token)}/preview`,
    );
  }
  claimInvite(token: string) {
    return this.http.post<{ status: 'claimed'; groupId: string; memberId: string }>(
      `${this.base}/invites/${encodeURIComponent(token)}/claim`,
      {},
    );
  }
  expenses(groupId: string, query: Record<string, string> = {}) {
    return this.http.get<{ items: SplitExpense[]; nextCursor: string | null }>(
      `${this.base}/groups/${groupId}/expenses`,
      { params: query },
    );
  }
  expense(groupId: string, expenseId: string) {
    return this.http.get<SplitExpense>(`${this.base}/groups/${groupId}/expenses/${expenseId}`);
  }
  createExpense(groupId: string, input: unknown) {
    return this.http.post<SplitExpense>(`${this.base}/groups/${groupId}/expenses`, input);
  }
  updateExpense(groupId: string, expenseId: string, input: unknown) {
    return this.http.patch<SplitExpense>(
      `${this.base}/groups/${groupId}/expenses/${expenseId}`,
      input,
    );
  }
  deleteExpense(groupId: string, expenseId: string) {
    return this.http.delete<SplitExpense>(`${this.base}/groups/${groupId}/expenses/${expenseId}`);
  }
  exchangeRate(groupId: string, from: string, to: string, date: string) {
    return this.http.get<SplitExchangeRateQuote>(`${this.base}/groups/${groupId}/fx-rate`, {
      params: { from, to, date },
    });
  }
  balances(groupId: string) {
    return this.http.get<SplitBalances>(`${this.base}/groups/${groupId}/balances`);
  }
  settlements(groupId: string) {
    return this.http.get<SplitSettlement[]>(`${this.base}/groups/${groupId}/settlements`);
  }
  createSettlement(groupId: string, input: unknown) {
    return this.http.post<SplitSettlement>(`${this.base}/groups/${groupId}/settlements`, input);
  }
  activity(groupId: string, cursor?: string) {
    return this.http.get<{ items: SplitActivity[]; nextCursor: string | null }>(
      `${this.base}/groups/${groupId}/activity`,
      { params: cursor ? { cursor } : {} },
    );
  }
}
