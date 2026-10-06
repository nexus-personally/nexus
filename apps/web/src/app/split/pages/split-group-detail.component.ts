import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideEllipsis, LucideChevronRight, LucidePlus } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { SplitApiService } from '../data-access/split-api.service';
import { SplitAuthService } from '../auth/data-access/split-auth.service';
import { SplitGroupsStore } from '../data-access/split-groups.store';
import {
  activeMembers,
  splitTypeIcon,
  type SplitGroup,
  type SplitMember,
} from '../data-access/split.models';
import { SplitBottomSheetComponent } from '../ui/split-bottom-sheet.component';
import { SplitDatePipe } from '../ui/split-date.pipe';
import {
  activityText,
  formatExpenseAmount,
  splitExpenseCategories,
  splitExpenseCategory,
  type SplitActivity,
  type SplitBalances,
  type SplitExpense,
} from '../data-access/split-expense.models';
@Component({
  selector: 'nexus-split-group-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideArrowLeft,
    LucideEllipsis,
    LucideChevronRight,
    LucidePlus,
    SplitBottomSheetComponent,
    SplitDatePipe,
  ],
  template: `<main class="split-page">
      <div class="split-wrap">
        @if (error) {
          <section class="error">{{ error }}</section>
        } @else if (!group) {
          <div class="skeleton"></div>
        } @else {
          <header class="split-top">
            <a class="back" routerLink="/split/groups"><svg lucideArrowLeft></svg></a><span></span
            ><button class="icon-btn" (click)="menu = true"><svg lucideEllipsis></svg></button>
          </header>
          <span class="type-icon">{{ icons[group.type] }}</span>
          <h1>{{ group.name }}</h1>
          <p class="muted">
            {{ group.baseCurrency }}
            @if (group.startDate) {
              · {{ group.startDate | splitDate }}
              @if (group.endDate) {
                — {{ group.endDate | splitDate }}
              }
            }
          </p>
          @if (group.status === 'archived') {
            <span class="archived">已归档</span>
          }
          <a class="member-link" [routerLink]="['members']"
            ><span
              ><b>成员</b
              ><span class="avatar-stack">
                @for (member of members.slice(0, 4); track member.id) {
                  <i class="avatar">{{ initial(member.displayName) }}</i>
                }
                @if (members.length > 4) {
                  <i class="avatar">+{{ members.length - 4 }}</i>
                }
              </span></span
            ><svg lucideChevronRight></svg
          ></a>
          <nav class="tabs three" aria-label="群组内容">
            <button [class.active]="tab === 'expenses'" (click)="tab = 'expenses'">费用</button
            ><button [class.active]="tab === 'balances'" (click)="tab = 'balances'">余额</button
            ><button [class.active]="tab === 'activity'" (click)="tab = 'activity'">动态</button>
          </nav>
          @if (tab === 'expenses') {
            <section class="expense-section">
              <h2>费用</h2>
              <form class="expense-tools" (ngSubmit)="applyExpenseFilters()">
                <label
                  ><span class="sr-only">搜索费用</span
                  ><input
                    name="expenseSearch"
                    [(ngModel)]="filters.search"
                    placeholder="搜索费用" /></label
                ><button class="secondary" type="button" (click)="filtersOpen = true">
                  筛选
                  @if (activeFilterCount) {
                    ({{ activeFilterCount }})
                  }</button
                ><button class="primary" type="submit">搜索</button>
              </form>
              @if (expenseLoading) {
                <div class="skeleton"></div>
              } @else if (!expenses.length) {
                <div class="expense-empty">
                  <h2>{{ hasExpenseFilters ? '没有符合条件的费用' : '还没有费用' }}</h2>
                  <p class="muted">
                    {{
                      hasExpenseFilters
                        ? '请修改或重置筛选条件。'
                        : '添加第一笔共同费用，NEXUS 会自动计算分摊结果。'
                    }}
                  </p>
                  @if (hasExpenseFilters) {
                    <button class="secondary" (click)="resetExpenseFilters()">重置筛选</button>
                  }
                </div>
              } @else {
                <div class="expense-list">
                  @for (expense of expenses; track expense.id) {
                    <a class="expense-row" [routerLink]="['expenses', expense.id]"
                      ><span class="expense-icon">{{ category[expense.categoryKey].icon }}</span
                      ><span class="expense-copy"
                        ><strong>{{ expense.description }}</strong
                        ><small
                          >{{ payerSummary(expense) }} ·
                          {{ expense.expenseDate | splitDate }}</small
                        >
                        @if (expenseRelationship(expense); as relationship) {
                          <small class="relationship" [class.positive]="relationship.positive">{{
                            relationship.text
                          }}</small>
                        }</span
                      ><b>{{ expense.originalCurrency }} {{ money(expense) }}</b></a
                    >
                  }
                </div>
                @if (expenseCursor) {
                  <button class="secondary full load-more" (click)="loadMoreExpenses()">
                    加载更多
                  </button>
                }
              }
            </section>
          }
          @if (tab === 'balances' && balances) {
            <section class="balances-panel">
              <div class="balance-summary">
                <p>
                  {{
                    balances.currentUserBalance > 0
                      ? '别人欠你'
                      : balances.currentUserBalance < 0
                        ? '你欠别人'
                        : '你的状态'
                  }}
                </p>
                <strong
                  >{{ balances.baseCurrency }}
                  {{ balanceMoney(abs(balances.currentUserBalance)) }}</strong
                >
                @if (!balances.currentUserBalance) {
                  <small>已结清</small>
                }
              </div>
              <h2>{{ balances.simplifyDebtsEnabled ? '建议还款方式' : '余额' }}</h2>
              <p class="muted">
                {{
                  balances.simplifyDebtsEnabled
                    ? '减少转账次数，同时保持每个人的净余额不变。'
                    : '按实际费用显示直接欠款关系。'
                }}
              </p>
              @for (debt of displayedDebts; track debt.fromMemberId + '-' + debt.toMemberId) {
                <div class="debt-row">
                  <span
                    ><b>{{ memberName(debt.fromMemberId) }}</b
                    ><small>支付给 {{ memberName(debt.toMemberId) }}</small></span
                  ><strong>{{ balances.baseCurrency }} {{ balanceMoney(debt.amountMinor) }}</strong>
                </div>
              } @empty {
                <div class="expense-empty">
                  <h2>全部结清</h2>
                  <p class="muted">目前没有未结清的余额。</p>
                </div>
              }
              <h2>成员余额</h2>
              @for (member of balances.memberBalances; track member.memberId) {
                <div class="debt-row">
                  <span
                    ><b>{{ member.displayName }}</b>
                    @if (member.membershipStatus !== 'active') {
                      <small>已离开的成员</small>
                    } @else if (member.isGuest) {
                      <small>访客</small>
                    }</span
                  ><strong
                    [class.balance-positive]="member.amountMinor > 0"
                    [class.balance-negative]="member.amountMinor < 0"
                    >{{ member.amountMinor > 0 ? '+' : '' }}{{ balances.baseCurrency }}
                    {{ balanceMoney(member.amountMinor) }}</strong
                  >
                </div>
              }
            </section>
          }
          @if (tab === 'balances' && displayedDebts.length && group.status === 'active') {
            <a class="primary full settle-link" [routerLink]="['settle']">记录还款</a>
          }
          @if (tab === 'activity') {
            <section class="activity-list">
              @for (item of activities; track item.id) {
                <article class="activity-row">
                  <span class="activity-dot"></span>
                  <div>
                    <strong>{{ activityLabel(item) }}</strong>
                    @if (item.metadata['amountMinor']; as amount) {
                      <p>{{ item.metadata['currency'] }} {{ activityAmount(amount) }}</p>
                    }
                    <small>{{ item.createdAt | splitDate: 'datetime' }}</small>
                  </div>
                </article>
              } @empty {
                <div class="expense-empty">
                  <h2>还没有动态</h2>
                  <p class="muted">群组变更会显示在这里。</p>
                </div>
              }
              @if (activityCursor) {
                <button class="secondary full" (click)="loadMoreActivity()">加载更多</button>
              }
            </section>
          }
          @if (group.status === 'active' && tab === 'expenses') {
            <a class="expense-fab" [routerLink]="['expenses', 'new']" aria-label="添加费用"
              ><svg lucidePlus></svg
            ></a>
          }
          @if (group.status === 'archived' && group.currentUserRole === 'owner') {
            <div class="sticky-action">
              <button class="primary full" (click)="reopen()">重新开启群组</button>
            </div>
          }
        }
      </div>
    </main>
    @if (menu && group) {
      <nexus-split-bottom-sheet label="群组菜单" (closed)="menu = false"
        ><h2>{{ group.name }}</h2>
        @if (group.currentUserRole === 'owner') {
          @if (group.status === 'active') {
            <a class="sheet-option" [routerLink]="['settings']">群组设置</a
            ><button class="sheet-option" (click)="confirmArchive = true; menu = false">
              归档群组
            </button>
          } @else {
            <button class="sheet-option" (click)="reopen()">重新开启群组</button>
          }
        }
        <button class="sheet-option" (click)="menu = false">取消</button></nexus-split-bottom-sheet
      >
    }
    @if (confirmArchive) {
      <nexus-split-bottom-sheet label="归档群组" (closed)="confirmArchive = false"
        ><h2>要归档这个群组吗？</h2>
        <p>归档后群组将变为只读，你可以稍后重新开启。</p>
        <button class="danger full" (click)="archive()">归档群组</button></nexus-split-bottom-sheet
      >
    }
    @if (filtersOpen) {
      <nexus-split-bottom-sheet label="筛选费用" (closed)="filtersOpen = false"
        ><h2>筛选费用</h2>
        <div class="form filter-form">
          <label class="field"
            >类别<select name="filterCategory" [(ngModel)]="filters.category">
              <option value="">所有类别</option>
              @for (item of expenseCategories; track item[0]) {
                <option [value]="item[0]">{{ item[1] }}</option>
              }
            </select></label
          ><label class="field"
            >付款人<select name="filterPayer" [(ngModel)]="filters.payerId">
              <option value="">所有人</option>
              @for (member of members; track member.id) {
                <option [value]="member.id">{{ member.displayName }}</option>
              }
            </select></label
          ><label class="field"
            >分摊成员<select name="filterMember" [(ngModel)]="filters.memberId">
              <option value="">所有人</option>
              @for (member of members; track member.id) {
                <option [value]="member.id">{{ member.displayName }}</option>
              }
            </select></label
          ><label class="field"
            >货币<select name="filterCurrency" [(ngModel)]="filters.currency">
              <option value="">所有货币</option>
              @for (item of currencies; track item[0]) {
                <option [value]="item[0]">{{ item[0] }}</option>
              }
            </select></label
          >
          <div class="date-grid">
            <label class="field"
              >开始日期<input type="date" name="filterFrom" [(ngModel)]="filters.from" /></label
            ><label class="field"
              >结束日期<input type="date" name="filterTo" [(ngModel)]="filters.to"
            /></label>
          </div>
          <button class="secondary full" type="button" (click)="resetExpenseFilters()">重置</button
          ><button class="primary full" type="button" (click)="applyExpenseFilters()">
            应用筛选
          </button>
        </div></nexus-split-bottom-sheet
      >
    }`,
  styleUrls: ['../ui/split-ui.scss'],
})
export class SplitGroupDetailComponent implements OnInit {
  private api = inject(SplitApiService);
  private auth = inject(SplitAuthService);
  private route = inject(ActivatedRoute);
  private store = inject(SplitGroupsStore);
  group?: SplitGroup;
  members: SplitMember[] = [];
  expenses: SplitExpense[] = [];
  expenseCursor: string | null = null;
  expenseLoading = false;
  filtersOpen = false;
  filters: Record<
    'search' | 'category' | 'payerId' | 'memberId' | 'currency' | 'from' | 'to',
    string
  > = { search: '', category: '', payerId: '', memberId: '', currency: '', from: '', to: '' };
  balances?: SplitBalances;
  activities: SplitActivity[] = [];
  activityCursor: string | null = null;
  tab: 'expenses' | 'balances' | 'activity' = 'expenses';
  error = '';
  menu = false;
  confirmArchive = false;
  readonly icons = splitTypeIcon;
  readonly category = splitExpenseCategory;
  readonly expenseCategories = splitExpenseCategories;
  readonly currencies = [['MYR'], ['USD'], ['SGD'], ['CNY'], ['TWD'], ['JPY'], ['HKD']] as const;
  private id = '';
  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('groupId')!;
    void this.load();
  }
  async load() {
    try {
      const [g, m, expenses, balances, activity] = await Promise.all([
        firstValueFrom(this.api.group(this.id)),
        firstValueFrom(this.api.members(this.id)),
        firstValueFrom(this.api.expenses(this.id)),
        firstValueFrom(this.api.balances(this.id)),
        firstValueFrom(this.api.activity(this.id)),
      ]);
      this.group = {
        ...g,
        currentUserRole:
          m.find((x) => x.userId === this.auth.currentUser()?.id)?.role ?? g.currentUserRole,
      };
      this.members = activeMembers(m);
      this.expenses = expenses.items;
      this.expenseCursor = expenses.nextCursor;
      this.balances = balances;
      this.activities = activity.items;
      this.activityCursor = activity.nextCursor;
    } catch {
      this.error = '无法加载这个群组。';
    }
  }
  get activeFilterCount() {
    return Object.entries(this.filters).filter(([key, value]) => key !== 'search' && Boolean(value))
      .length;
  }
  get hasExpenseFilters() {
    return Boolean(this.filters.search || this.activeFilterCount);
  }
  private expenseQuery(cursor?: string) {
    return Object.fromEntries(
      [...Object.entries(this.filters), ['cursor', cursor ?? '']].filter(([, value]) =>
        Boolean(value),
      ),
    );
  }
  async applyExpenseFilters() {
    this.filtersOpen = false;
    this.expenseLoading = true;
    try {
      const page = await firstValueFrom(this.api.expenses(this.id, this.expenseQuery()));
      this.expenses = page.items;
      this.expenseCursor = page.nextCursor;
    } catch {
      this.error = '无法筛选费用。';
    } finally {
      this.expenseLoading = false;
    }
  }
  async loadMoreExpenses() {
    if (!this.expenseCursor) return;
    this.expenseLoading = true;
    try {
      const page = await firstValueFrom(
        this.api.expenses(this.id, this.expenseQuery(this.expenseCursor)),
      );
      this.expenses = [...this.expenses, ...page.items];
      this.expenseCursor = page.nextCursor;
    } finally {
      this.expenseLoading = false;
    }
  }
  resetExpenseFilters() {
    for (const key of Object.keys(this.filters) as Array<keyof typeof this.filters>)
      this.filters[key] = '';
    void this.applyExpenseFilters();
  }
  initial(n: string) {
    return n.trim().charAt(0).toUpperCase();
  }
  money(expense: SplitExpense) {
    return formatExpenseAmount(expense.originalAmountMinor, expense.originalCurrency);
  }
  payerSummary(expense: SplitExpense) {
    if (expense.payments.length > 1) return `${expense.payments.length} 人付款`;
    return `${this.members.find((member) => member.id === expense.payments[0]?.memberId)?.displayName ?? '已离开的成员'} 付款`;
  }
  get displayedDebts() {
    if (!this.balances) return [];
    return this.balances.simplifyDebtsEnabled
      ? this.balances.simplifiedDebts
      : this.balances.directDebts;
  }
  memberName(id: string) {
    return (
      this.members.find((member) => member.id === id)?.displayName ??
      this.balances?.memberBalances.find((member) => member.memberId === id)?.displayName ??
      '已离开的成员'
    );
  }
  balanceMoney(amount: number) {
    return formatExpenseAmount(Math.abs(amount), this.balances!.baseCurrency);
  }
  abs(value: number) {
    return Math.abs(value);
  }
  expenseRelationship(expense: SplitExpense) {
    const memberId = this.members.find(
      (member) => member.userId === this.auth.currentUser()?.id,
    )?.id;
    if (!memberId || expense.originalCurrency !== expense.baseCurrency) return null;
    const paid = expense.payments
      .filter((row) => row.memberId === memberId)
      .reduce((sum, row) => sum + row.amountMinor, 0);
    const share = expense.splits
      .filter((row) => row.memberId === memberId)
      .reduce((sum, row) => sum + row.amountMinor, 0);
    const net = paid - share;
    if (!paid && !share) return { text: '未参与分摊', positive: false };
    if (net > 0)
      return {
        text: `你垫付了 ${expense.originalCurrency} ${formatExpenseAmount(net, expense.originalCurrency)}`,
        positive: true,
      };
    if (net < 0)
      return {
        text: `你欠 ${expense.originalCurrency} ${formatExpenseAmount(-net, expense.originalCurrency)}`,
        positive: false,
      };
    return { text: '你的份额已结清', positive: true };
  }
  activityLabel(item: SplitActivity) {
    const actor =
      this.members.find((m) => m.userId === item.actorUserId)?.displayName ?? '某位成员';
    return activityText(item, actor);
  }
  activityAmount(value: unknown) {
    return this.balances && typeof value === 'number'
      ? formatExpenseAmount(value, this.balances.baseCurrency)
      : String(value);
  }
  async loadMoreActivity() {
    if (!this.activityCursor) return;
    const page = await firstValueFrom(this.api.activity(this.id, this.activityCursor));
    this.activities = [...this.activities, ...page.items];
    this.activityCursor = page.nextCursor;
  }
  async archive() {
    this.group = await firstValueFrom(this.api.archive(this.id));
    this.group.currentUserRole = 'owner';
    this.confirmArchive = false;
    this.store.invalidate();
  }
  async reopen() {
    this.group = await firstValueFrom(this.api.reopen(this.id));
    this.group.currentUserRole = 'owner';
    this.menu = false;
    this.store.invalidate();
  }
}
