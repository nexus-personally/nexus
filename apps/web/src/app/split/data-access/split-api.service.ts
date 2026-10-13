import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { concatMap, from, map, type Observable } from 'rxjs';
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
import type {
  SplitBudgetAdjustment,
  SplitBudgetAdjustmentInput,
  SplitCreditCard,
  SplitCreditCardInput,
  SplitDashboardSummary,
} from './split-dashboard.models';
import { SPLIT_CACHE_REFRESH, SplitOfflineCacheService } from './split-offline-cache.service';
@Injectable({ providedIn: 'root' })
export class SplitApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(SplitOfflineCacheService);
  private readonly base = '/api/split';
  private afterMutation<T>(request: Observable<T>, ...paths: string[]) {
    return request.pipe(
      concatMap((result) =>
        from(Promise.all(paths.map((path) => this.cache.invalidate(path)))).pipe(map(() => result)),
      ),
    );
  }
  groups(status: 'active' | 'archived', force = false) {
    return this.http.get<SplitGroup[]>(`${this.base}/groups`, {
      params: { status },
      context: new HttpContext().set(SPLIT_CACHE_REFRESH, force),
    });
  }
  group(id: string) {
    return this.http.get<SplitGroup>(`${this.base}/groups/${id}`);
  }
  createGroup(input: SplitGroupInput) {
    return this.afterMutation(this.http.post<SplitGroup>(`${this.base}/groups`, input), '/groups?');
  }
  updateGroup(id: string, input: Partial<SplitGroupInput>) {
    return this.afterMutation(
      this.http.patch<SplitGroup>(`${this.base}/groups/${id}`, input),
      `/groups/${id}`,
      '/groups?',
    );
  }
  archive(id: string) {
    return this.afterMutation(
      this.http.post<SplitGroup>(`${this.base}/groups/${id}/archive`, {}),
      `/groups/${id}`,
      '/groups?',
    );
  }
  reopen(id: string) {
    return this.afterMutation(
      this.http.post<SplitGroup>(`${this.base}/groups/${id}/reopen`, {}),
      `/groups/${id}`,
      '/groups?',
    );
  }
  members(id: string) {
    return this.http.get<SplitMember[]>(`${this.base}/groups/${id}/members`);
  }
  createGuest(id: string, displayName: string) {
    return this.afterMutation(
      this.http.post<SplitMember>(`${this.base}/groups/${id}/members/guest`, { displayName }),
      `/groups/${id}/members`,
      `/groups/${id}/balances`,
      `/groups/${id}/activity`,
      '/groups?',
    );
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
    const request = this.http.post<{ status: 'claimed'; groupId: string; memberId: string }>(
      `${this.base}/invites/${encodeURIComponent(token)}/claim`,
      {},
    );
    return request.pipe(
      concatMap((result) =>
        from(
          Promise.all([
            this.cache.invalidate('/groups?'),
            this.cache.invalidate(`/groups/${result.groupId}`),
            this.cache.invalidate(`/groups/${result.groupId}/members`),
            this.cache.invalidate(`/groups/${result.groupId}/balances`),
            this.cache.invalidate(`/groups/${result.groupId}/activity`),
          ]),
        ).pipe(map(() => result)),
      ),
    );
  }
  expenses(groupId: string, query: Record<string, string> = {}, force = false) {
    return this.http.get<{ items: SplitExpense[]; nextCursor: string | null }>(
      `${this.base}/groups/${groupId}/expenses`,
      {
        params: query,
        context: new HttpContext().set(SPLIT_CACHE_REFRESH, force),
      },
    );
  }
  expense(groupId: string, expenseId: string) {
    return this.http.get<SplitExpense>(`${this.base}/groups/${groupId}/expenses/${expenseId}`);
  }
  createExpense(groupId: string, input: unknown, idempotencyKey: string) {
    return this.afterMutation(
      this.http.post<SplitExpense>(`${this.base}/groups/${groupId}/expenses`, input, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      ...this.expenseInvalidations(groupId),
    );
  }
  updateExpense(groupId: string, expenseId: string, input: unknown) {
    return this.afterMutation(
      this.http.patch<SplitExpense>(`${this.base}/groups/${groupId}/expenses/${expenseId}`, input),
      ...this.expenseInvalidations(groupId),
    );
  }
  deleteExpense(groupId: string, expenseId: string) {
    return this.afterMutation(
      this.http.delete<SplitExpense>(`${this.base}/groups/${groupId}/expenses/${expenseId}`),
      ...this.expenseInvalidations(groupId),
    );
  }
  exchangeRate(groupId: string, from: string, to: string, date: string) {
    return this.http.get<SplitExchangeRateQuote>(`${this.base}/groups/${groupId}/fx-rate`, {
      params: { from, to, date },
    });
  }
  balances(groupId: string, force = false) {
    return this.http.get<SplitBalances>(`${this.base}/groups/${groupId}/balances`, {
      context: new HttpContext().set(SPLIT_CACHE_REFRESH, force),
    });
  }
  settlements(groupId: string) {
    return this.http.get<SplitSettlement[]>(`${this.base}/groups/${groupId}/settlements`);
  }
  createSettlement(groupId: string, input: unknown, idempotencyKey: string) {
    return this.afterMutation(
      this.http.post<SplitSettlement>(`${this.base}/groups/${groupId}/settlements`, input, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      `/groups/${groupId}/balances`,
      `/groups/${groupId}/settlements`,
      `/groups/${groupId}/activity`,
    );
  }
  activity(groupId: string, cursor?: string) {
    return this.http.get<{ items: SplitActivity[]; nextCursor: string | null }>(
      `${this.base}/groups/${groupId}/activity`,
      { params: cursor ? { cursor } : {} },
    );
  }
  dashboard(month: string) {
    return this.http.get<SplitDashboardSummary>(`${this.base}/dashboard`, { params: { month } });
  }
  createAdjustment(input: SplitBudgetAdjustmentInput, idempotencyKey: string) {
    return this.afterMutation(
      this.http.post<SplitBudgetAdjustment>(`${this.base}/dashboard/adjustments`, input, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      '/dashboard',
    );
  }
  updateAdjustment(id: string, input: SplitBudgetAdjustmentInput) {
    return this.afterMutation(
      this.http.patch<SplitBudgetAdjustment>(`${this.base}/dashboard/adjustments/${id}`, input),
      '/dashboard',
    );
  }
  deleteAdjustment(id: string) {
    return this.afterMutation(
      this.http.delete<void>(`${this.base}/dashboard/adjustments/${id}`),
      '/dashboard',
    );
  }
  createCard(input: SplitCreditCardInput, idempotencyKey: string) {
    return this.afterMutation(
      this.http.post<SplitCreditCard>(`${this.base}/dashboard/cards`, input, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      '/dashboard',
    );
  }
  updateCard(id: string, input: SplitCreditCardInput) {
    return this.afterMutation(
      this.http.patch<SplitCreditCard>(`${this.base}/dashboard/cards/${id}`, input),
      '/dashboard',
    );
  }
  deleteCard(id: string) {
    return this.afterMutation(
      this.http.delete<void>(`${this.base}/dashboard/cards/${id}`),
      '/dashboard',
    );
  }

  private expenseInvalidations(groupId: string) {
    return [
      `/groups/${groupId}/expenses`,
      `/groups/${groupId}/balances`,
      `/groups/${groupId}/activity`,
      '/dashboard',
    ];
  }
}
