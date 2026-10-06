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
import { activityText, formatExpenseAmount, splitExpenseCategories, splitExpenseCategory, type SplitActivity, type SplitBalances, type SplitExpense } from '../data-access/split-expense.models';
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
  ],
  template: `<main class="split-page"><div class="split-wrap">
    @if(error){<section class="error">{{error}}</section>}
    @else if(!group){<div class="skeleton"></div>}
    @else {
      <header class="split-top"><a class="back" routerLink="/split/groups"><svg lucideArrowLeft></svg></a><span></span><button class="icon-btn" (click)="menu=true"><svg lucideEllipsis></svg></button></header>
      <span class="type-icon">{{icons[group.type]}}</span><h1>{{group.name}}</h1>
      <p class="muted">{{group.baseCurrency}} @if(group.startDate){ · {{group.startDate|date:'mediumDate'}} @if(group.endDate){— {{group.endDate|date:'mediumDate'}}}}</p>
      @if(group.status==='archived'){<span class="archived">ARCHIVED</span>}
      <a class="member-link" [routerLink]="['members']"><span><b>Members</b><span class="avatar-stack">@for(member of members.slice(0,4);track member.id){<i class="avatar">{{initial(member.displayName)}}</i>}@if(members.length>4){<i class="avatar">+{{members.length-4}}</i>}</span></span><svg lucideChevronRight></svg></a>
      <nav class="tabs three" aria-label="Group sections"><button [class.active]="tab==='expenses'" (click)="tab='expenses'">Expenses</button><button [class.active]="tab==='balances'" (click)="tab='balances'">Balances</button><button [class.active]="tab==='activity'" (click)="tab='activity'">Activity</button></nav>
      @if(tab==='expenses'){<section class="expense-section"><h2>Expenses</h2><form class="expense-tools" (ngSubmit)="applyExpenseFilters()"><label><span class="sr-only">Search expenses</span><input name="expenseSearch" [(ngModel)]="filters.search" placeholder="Search expenses"></label><button class="secondary" type="button" (click)="filtersOpen=true">Filters @if(activeFilterCount){({{activeFilterCount}})}</button><button class="primary" type="submit">Search</button></form>@if(expenseLoading){<div class="skeleton"></div>}@else if(!expenses.length){<div class="expense-empty"><h2>{{hasExpenseFilters?'No matching expenses':'No expenses yet'}}</h2><p class="muted">{{hasExpenseFilters?'Try changing or resetting the filters.':'Add your first shared expense and NEXUS will calculate the rest.'}}</p>@if(hasExpenseFilters){<button class="secondary" (click)="resetExpenseFilters()">Reset filters</button>}</div>}@else{<div class="expense-list">@for(expense of expenses;track expense.id){<a class="expense-row" [routerLink]="['expenses',expense.id]"><span class="expense-icon">{{category[expense.categoryKey].icon}}</span><span class="expense-copy"><strong>{{expense.description}}</strong><small>{{payerSummary(expense)}} · {{expense.expenseDate|date:'mediumDate'}}</small>@if(expenseRelationship(expense);as relationship){<small class="relationship" [class.positive]="relationship.positive">{{relationship.text}}</small>}</span><b>{{expense.originalCurrency}} {{money(expense)}}</b></a>}</div>@if(expenseCursor){<button class="secondary full load-more" (click)="loadMoreExpenses()">Load more</button>}}</section>}
      @if(tab==='balances'&&balances){<section class="balances-panel"><div class="balance-summary"><p>{{balances.currentUserBalance>0?'You are owed':balances.currentUserBalance<0?'You owe':'You are'}}</p><strong>{{balances.baseCurrency}} {{balanceMoney(abs(balances.currentUserBalance))}}</strong>@if(!balances.currentUserBalance){<small>settled up</small>}</div><h2>{{balances.simplifyDebtsEnabled?'Suggested settlements':'Balances'}}</h2><p class="muted">{{balances.simplifyDebtsEnabled?'Fewer transfers, with everyone’s net balance unchanged.':'Direct expense relationships.'}}</p>@for(debt of displayedDebts;track debt.fromMemberId+'-'+debt.toMemberId){<div class="debt-row"><span><b>{{memberName(debt.fromMemberId)}}</b><small>pays {{memberName(debt.toMemberId)}}</small></span><strong>{{balances.baseCurrency}} {{balanceMoney(debt.amountMinor)}}</strong></div>}@empty{<div class="expense-empty"><h2>All settled up</h2><p class="muted">There are no outstanding balances.</p></div>}<h2>Member balances</h2>@for(member of balances.memberBalances;track member.memberId){<div class="debt-row"><span><b>{{member.displayName}}</b>@if(member.membershipStatus!=='active'){<small>Former member</small>}@else if(member.isGuest){<small>Guest</small>}</span><strong [class.balance-positive]="member.amountMinor>0" [class.balance-negative]="member.amountMinor<0">{{member.amountMinor>0?'+':''}}{{balances.baseCurrency}} {{balanceMoney(member.amountMinor)}}</strong></div>}</section>}
      @if(tab==='balances'&&displayedDebts.length&&group.status==='active'){<a class="primary full settle-link" [routerLink]="['settle']">Settle Up</a>}
      @if(tab==='activity'){<section class="activity-list">@for(item of activities;track item.id){<article class="activity-row"><span class="activity-dot"></span><div><strong>{{activityLabel(item)}}</strong>@if(item.metadata['amountMinor'];as amount){<p>{{item.metadata['currency']}} {{activityAmount(amount)}}</p>}<small>{{item.createdAt|date:'medium'}}</small></div></article>}@empty{<div class="expense-empty"><h2>No activity yet</h2><p class="muted">Group changes will appear here.</p></div>}@if(activityCursor){<button class="secondary full" (click)="loadMoreActivity()">Load more</button>}</section>}
      @if(group.status==='active'&&tab==='expenses'){<a class="expense-fab" [routerLink]="['expenses','new']" aria-label="Add Expense"><svg lucidePlus></svg></a>}
      @if(group.status==='archived'&&group.currentUserRole==='owner'){<div class="sticky-action"><button class="primary full" (click)="reopen()">Reopen Group</button></div>}
    }
  </div></main>
  @if(menu&&group){<nexus-split-bottom-sheet label="Group menu" (closed)="menu=false"><h2>{{group.name}}</h2>@if(group.currentUserRole==='owner'){@if(group.status==='active'){<a class="sheet-option" [routerLink]="['settings']">Group Settings</a><button class="sheet-option" (click)="confirmArchive=true;menu=false">Archive Group</button>}@else{<button class="sheet-option" (click)="reopen()">Reopen Group</button>}}<button class="sheet-option" (click)="menu=false">Cancel</button></nexus-split-bottom-sheet>}
  @if(confirmArchive){<nexus-split-bottom-sheet label="Archive group" (closed)="confirmArchive=false"><h2>Archive group?</h2><p>Archived groups become read-only. You can reopen this group later.</p><button class="danger full" (click)="archive()">Archive Group</button></nexus-split-bottom-sheet>}
  @if(filtersOpen){<nexus-split-bottom-sheet label="Filter expenses" (closed)="filtersOpen=false"><h2>Filter Expenses</h2><div class="form filter-form"><label class="field">Category<select name="filterCategory" [(ngModel)]="filters.category"><option value="">All categories</option>@for(item of expenseCategories;track item[0]){<option [value]="item[0]">{{item[1]}}</option>}</select></label><label class="field">Paid by<select name="filterPayer" [(ngModel)]="filters.payerId"><option value="">Anyone</option>@for(member of members;track member.id){<option [value]="member.id">{{member.displayName}}</option>}</select></label><label class="field">Participant<select name="filterMember" [(ngModel)]="filters.memberId"><option value="">Anyone</option>@for(member of members;track member.id){<option [value]="member.id">{{member.displayName}}</option>}</select></label><label class="field">Currency<select name="filterCurrency" [(ngModel)]="filters.currency"><option value="">All currencies</option>@for(item of currencies;track item[0]){<option [value]="item[0]">{{item[0]}}</option>}</select></label><div class="date-grid"><label class="field">From<input type="date" name="filterFrom" [(ngModel)]="filters.from"></label><label class="field">To<input type="date" name="filterTo" [(ngModel)]="filters.to"></label></div><button class="secondary full" type="button" (click)="resetExpenseFilters()">Reset</button><button class="primary full" type="button" (click)="applyExpenseFilters()">Apply Filters</button></div></nexus-split-bottom-sheet>}`,
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
  expenseCursor: string|null = null;
  expenseLoading = false;
  filtersOpen = false;
  filters:Record<'search'|'category'|'payerId'|'memberId'|'currency'|'from'|'to',string>={search:'',category:'',payerId:'',memberId:'',currency:'',from:'',to:''};
  balances?: SplitBalances;
  activities: SplitActivity[] = [];
  activityCursor: string|null = null;
  tab: 'expenses' | 'balances' | 'activity' = 'expenses';
  error = '';
  menu = false;
  confirmArchive = false;
  readonly icons = splitTypeIcon;
  readonly category = splitExpenseCategory;
  readonly expenseCategories=splitExpenseCategories;
  readonly currencies=[['MYR'],['USD'],['SGD'],['CNY'],['TWD'],['JPY'],['HKD']] as const;
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
      this.expenses = expenses.items; this.expenseCursor=expenses.nextCursor;
      this.balances = balances;
      this.activities = activity.items; this.activityCursor = activity.nextCursor;
    } catch {
      this.error = 'Unable to load this group.';
    }
  }
  get activeFilterCount(){return Object.entries(this.filters).filter(([key,value])=>key!=='search'&&Boolean(value)).length;}
  get hasExpenseFilters(){return Boolean(this.filters.search||this.activeFilterCount);}
  private expenseQuery(cursor?:string){return Object.fromEntries([...Object.entries(this.filters),['cursor',cursor??'']].filter(([,value])=>Boolean(value)));}
  async applyExpenseFilters(){this.filtersOpen=false;this.expenseLoading=true;try{const page=await firstValueFrom(this.api.expenses(this.id,this.expenseQuery()));this.expenses=page.items;this.expenseCursor=page.nextCursor;}catch{this.error='Unable to filter expenses.';}finally{this.expenseLoading=false;}}
  async loadMoreExpenses(){if(!this.expenseCursor)return;this.expenseLoading=true;try{const page=await firstValueFrom(this.api.expenses(this.id,this.expenseQuery(this.expenseCursor)));this.expenses=[...this.expenses,...page.items];this.expenseCursor=page.nextCursor;}finally{this.expenseLoading=false;}}
  resetExpenseFilters(){for(const key of Object.keys(this.filters) as Array<keyof typeof this.filters>)this.filters[key]='';void this.applyExpenseFilters();}
  initial(n: string) {
    return n.trim().charAt(0).toUpperCase();
  }
  money(expense: SplitExpense) {
    return formatExpenseAmount(expense.originalAmountMinor, expense.originalCurrency);
  }
  payerSummary(expense: SplitExpense) {
    if (expense.payments.length > 1) return `${expense.payments.length} people paid`;
    return `${this.members.find((member) => member.id === expense.payments[0]?.memberId)?.displayName ?? 'Former member'} paid`;
  }
  get displayedDebts() {
    if (!this.balances) return [];
    return this.balances.simplifyDebtsEnabled ? this.balances.simplifiedDebts : this.balances.directDebts;
  }
  memberName(id: string) {
    return this.members.find((member) => member.id === id)?.displayName ?? this.balances?.memberBalances.find((member) => member.memberId === id)?.displayName ?? 'Former member';
  }
  balanceMoney(amount: number) {
    return formatExpenseAmount(Math.abs(amount), this.balances!.baseCurrency);
  }
  abs(value: number) { return Math.abs(value); }
  expenseRelationship(expense: SplitExpense) {
    const memberId = this.members.find((member) => member.userId === this.auth.currentUser()?.id)?.id;
    if (!memberId || expense.originalCurrency !== expense.baseCurrency) return null;
    const paid = expense.payments.filter((row) => row.memberId === memberId).reduce((sum, row) => sum + row.amountMinor, 0);
    const share = expense.splits.filter((row) => row.memberId === memberId).reduce((sum, row) => sum + row.amountMinor, 0);
    const net = paid - share;
    if (!paid && !share) return { text: 'Not involved', positive: false };
    if (net > 0) return { text: `You lent ${expense.originalCurrency} ${formatExpenseAmount(net, expense.originalCurrency)}`, positive: true };
    if (net < 0) return { text: `You owe ${expense.originalCurrency} ${formatExpenseAmount(-net, expense.originalCurrency)}`, positive: false };
    return { text: 'Your share is settled', positive: true };
  }
  activityLabel(item:SplitActivity){const actor=this.members.find(m=>m.userId===item.actorUserId)?.displayName??'Someone';return activityText(item,actor);}
  activityAmount(value:unknown){return this.balances&&typeof value==='number'?formatExpenseAmount(value,this.balances.baseCurrency):String(value);}
  async loadMoreActivity(){if(!this.activityCursor)return;const page=await firstValueFrom(this.api.activity(this.id,this.activityCursor));this.activities=[...this.activities,...page.items];this.activityCursor=page.nextCursor;}
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
