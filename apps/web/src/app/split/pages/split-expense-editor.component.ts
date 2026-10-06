import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideChevronDown, LucideCheck } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { SplitAuthService } from '../auth/data-access/split-auth.service';
import { SplitApiService } from '../data-access/split-api.service';
import {
  allocationPreview,
  convertExpenseAmount,
  expensePayload,
  formatExpenseAmount,
  parseExpenseAmount,
  splitExpenseCategories,
  splitExpenseCategory,
  validateExpenseDraft,
  type SplitExpense,
  type SplitExpenseDraft,
  type SplitMethod,
} from '../data-access/split-expense.models';
import { activeMembers, splitCurrencies, type SplitGroup, type SplitMember } from '../data-access/split.models';
import { SplitBottomSheetComponent } from '../ui/split-bottom-sheet.component';

type Sheet = 'category' | 'currency' | 'payers' | 'participants' | null;

@Component({
  selector: 'nexus-split-expense-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideArrowLeft, LucideChevronDown, LucideCheck, SplitBottomSheetComponent],
  template: `<main class="split-page expense-editor"><div class="split-wrap">
    <header class="split-top"><a class="back" [routerLink]="['/split/groups',groupId]"><svg lucideArrowLeft></svg></a><strong>{{expenseId?'Edit Expense':'Add Expense'}}</strong><span class="back"></span></header>
    @if(loading){<div class="skeleton"></div>}
    @else if(loadError){<section class="error"><p>{{loadError}}</p><button class="secondary" (click)="load()">Try Again</button></section>}
    @else {<form class="form expense-form" (ngSubmit)="save()" novalidate>
      <button type="button" class="category-picker" (click)="sheet='category'"><span class="category-glyph">{{category.icon}}</span><span><small>Category</small><b>{{category.label}}</b></span><svg lucideChevronDown></svg></button>
      <label class="field">Description<input name="description" [(ngModel)]="draft.description" maxlength="200" autocomplete="off" placeholder="What was this for?">@if(errors.description){<span class="error-text">{{errors.description}}</span>}</label>
      <div class="amount-block"><button type="button" class="currency-button" (click)="sheet='currency'">{{draft.currency}} <svg lucideChevronDown></svg></button><label><span class="sr-only">Amount</span><input name="amount" [(ngModel)]="draft.amount" inputmode="decimal" placeholder="0{{draft.currency==='JPY'?'':'.00'}}" (ngModelChange)="amountChanged()"></label></div>
      @if(errors.amount){<span class="error-text">{{errors.amount}}</span>}
      @if(draft.currency!==draft.baseCurrency){<section class="fx-card" aria-live="polite"><label class="field">Rate used for this expense<input name="exchangeRate" [(ngModel)]="draft.exchangeRate" inputmode="decimal" placeholder="1.0000" (ngModelChange)="rateSource='manual'"><small>1 {{draft.currency}} = {{draft.exchangeRate||'—'}} {{draft.baseCurrency}}</small></label><button type="button" class="secondary" (click)="suggestRate()" [disabled]="fxLoading">{{fxLoading?'Checking…':'Use suggested rate'}}</button>@if(convertedAmount){<strong>≈ {{draft.baseCurrency}} {{convertedAmount}}</strong>}@if(rateSource==='suggested'){<small>Suggested for {{draft.expenseDate}}. You may override it.</small>}@if(fxError){<span class="error-text">{{fxError}} Manual entry is still available.</span>}@if(errors.exchangeRate){<span class="error-text">{{errors.exchangeRate}}</span>}</section>}
      <label class="field">Expense Date<input type="date" name="expenseDate" [(ngModel)]="draft.expenseDate">@if(errors.expenseDate){<span class="error-text">{{errors.expenseDate}}</span>}</label>
      <button type="button" class="summary-button" (click)="sheet='payers'"><span><small>Paid By</small><b>{{payerSummary}}</b></span><svg lucideChevronDown></svg></button>
      @if(errors.payments){<span class="error-text">{{errors.payments}}</span>}
      <button type="button" class="summary-button" (click)="sheet='participants'"><span><small>Split Between</small><b>{{participantSummary}}</b></span><svg lucideChevronDown></svg></button>
      @if(errors.split){<span class="error-text">{{errors.split}}</span>}
      <fieldset class="method-picker"><legend>Split Method</legend>@for(method of methods;track method.value){<button type="button" [class.active]="draft.method===method.value" (click)="setMethod(method.value)">{{method.label}}</button>}</fieldset>
      @if(draft.method!=='equal'){<section class="allocation-editor">@for(member of selectedParticipants;track member.id){<label><span>{{member.displayName}}</span><input [name]="'allocation-'+member.id" [(ngModel)]="draft.allocations[member.id]" [inputmode]="draft.method==='shares'?'numeric':'decimal'" [placeholder]="draft.method==='percentage'?'0.00':draft.method==='shares'?'1':'0.00'"><em>{{draft.method==='percentage'?'%':draft.method==='shares'?'shares':draft.currency}}</em></label>}<p [class.invalid]="allocationRemaining!==0">{{allocationCaption}}</p></section>}
      @if(draft.method==='equal'&&preview.length){<section class="allocation-preview"><h2>Equal preview</h2>@for(row of preview;track row.memberId){<p><span>{{memberName(row.memberId)}}</span><b>{{draft.currency}} {{money(row.amountMinor)}}</b></p>}</section>}
      <label class="field">Note <small>Optional</small><textarea name="note" [(ngModel)]="draft.note" rows="3" placeholder="Add a note"></textarea></label>
      @if(saveError){<div class="notice error-text" role="alert">{{saveError}}</div>}
      <div class="sticky-action"><button class="primary full" type="submit" [disabled]="saving">{{saving?'Saving…':expenseId?'Save Changes':'Save Expense'}}</button></div>
    </form>}
  </div></main>
  @if(sheet==='category'){<nexus-split-bottom-sheet label="Choose category" (closed)="sheet=null"><h2>Category</h2><div class="sheet-grid">@for(item of categories;track item[0]){<button class="sheet-option" (click)="draft.categoryKey=item[0];sheet=null"><span>{{item[2]}}</span><span>{{item[1]}}</span>@if(draft.categoryKey===item[0]){<svg lucideCheck></svg>}</button>}</div></nexus-split-bottom-sheet>}
  @if(sheet==='currency'){<nexus-split-bottom-sheet label="Choose currency" (closed)="sheet=null"><h2>Currency</h2>@for(item of currencies;track item[0]){<button class="sheet-option" (click)="chooseCurrency(item[0])"><b>{{item[0]}}</b><span>{{item[1]}}</span>@if(draft.currency===item[0]){<svg lucideCheck></svg>}</button>}</nexus-split-bottom-sheet>}
  @if(sheet==='participants'){<nexus-split-bottom-sheet label="Choose participants" (closed)="sheet=null"><h2>Split between</h2>@for(member of members;track member.id){<label class="sheet-check"><input type="checkbox" [checked]="draft.participantIds.includes(member.id)" (change)="toggleParticipant(member.id)"><span>{{member.displayName}}</span><small>{{member.userId?'Member':'Guest'}}</small></label>}<button class="primary full sheet-done" (click)="sheet=null">Done</button></nexus-split-bottom-sheet>}
  @if(sheet==='payers'){<nexus-split-bottom-sheet label="Choose payers" (closed)="sheet=null"><h2>Paid by</h2>@for(member of members;track member.id){<label class="payer-row"><input type="checkbox" [checked]="isPayer(member.id)" (change)="togglePayer(member.id)"><span>{{member.displayName}}</span>@if(isPayer(member.id)){<input [name]="'payer-'+member.id" [ngModel]="payerAmount(member.id)" (ngModelChange)="setPayerAmount(member.id,$event)" inputmode="decimal" [placeholder]="draft.amount">}</label>}<p [class.error-text]="paymentRemaining!==0">Remaining {{draft.currency}} {{moneyAbs(paymentRemaining)}}</p><button class="primary full sheet-done" (click)="sheet=null">Done</button></nexus-split-bottom-sheet>}`,
  styleUrls: ['../ui/split-ui.scss'],
})
export class SplitExpenseEditorComponent implements OnInit {
  private readonly api = inject(SplitApiService);
  private readonly auth = inject(SplitAuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  groupId = '';
  expenseId = '';
  group?: SplitGroup;
  members: SplitMember[] = [];
  loading = true;
  saving = false;
  loadError = '';
  saveError = '';
  fxError = '';
  fxLoading = false;
  rateSource: 'manual'|'suggested' = 'manual';
  errors: Record<string, string> = {};
  sheet: Sheet = null;
  readonly categories = splitExpenseCategories;
  readonly currencies = splitCurrencies;
  readonly methods: Array<{ value: SplitMethod; label: string }> = [
    { value: 'equal', label: 'Equal' }, { value: 'exact', label: 'Exact' },
    { value: 'percentage', label: '%' }, { value: 'shares', label: 'Shares' },
  ];
  draft: SplitExpenseDraft = {
    description: '', categoryKey: 'food', amount: '', currency: 'MYR', baseCurrency: 'MYR', exchangeRate: '',
    expenseDate: new Date().toISOString().slice(0, 10), note: '', payments: [], participantIds: [], method: 'equal', allocations: {},
  };
  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('groupId')!;
    this.expenseId = this.route.snapshot.paramMap.get('expenseId') ?? '';
    void this.load();
  }
  async load() {
    this.loading = true; this.loadError = '';
    try {
      const [group, members, expense] = await Promise.all([
        firstValueFrom(this.api.group(this.groupId)), firstValueFrom(this.api.members(this.groupId)),
        this.expenseId ? firstValueFrom(this.api.expense(this.groupId, this.expenseId)) : Promise.resolve(undefined),
      ]);
      this.group = group; this.members = activeMembers(members); this.draft.baseCurrency = group.baseCurrency;
      if (expense) this.fromExpense(expense);
      else {
        this.draft.currency = group.baseCurrency;
        this.draft.participantIds = this.members.map((member) => member.id);
        const own = this.members.find((member) => member.userId === this.auth.currentUser()?.id) ?? this.members[0];
        if (own) this.draft.payments = [{ memberId: own.id, amount: this.draft.amount }];
      }
    } catch { this.loadError = 'Unable to load the Expense editor.'; }
    finally { this.loading = false; }
  }
  private fromExpense(expense: SplitExpense) {
    this.draft = {
      description: expense.description, categoryKey: expense.categoryKey,
      amount: this.money(expense.originalAmountMinor), currency: expense.originalCurrency, baseCurrency: expense.baseCurrency,
      exchangeRate: expense.originalCurrency === expense.baseCurrency ? '' : expense.exchangeRate,
      expenseDate: expense.expenseDate, note: expense.note ?? '',
      payments: expense.payments.map((row) => ({ memberId: row.memberId, amount: this.moneyFor(row.amountMinor, expense.originalCurrency) })),
      participantIds: expense.splits.map((row) => row.memberId), method: 'exact',
      allocations: Object.fromEntries(expense.splits.map((row) => [row.memberId, this.moneyFor(row.amountMinor, expense.originalCurrency)])),
    };
  }
  async save() {
    this.errors = validateExpenseDraft(this.draft); this.saveError = '';
    if (Object.keys(this.errors).length) return;
    this.saving = true;
    try {
      const result = this.expenseId
        ? await firstValueFrom(this.api.updateExpense(this.groupId, this.expenseId, expensePayload(this.draft)))
        : await firstValueFrom(this.api.createExpense(this.groupId, expensePayload(this.draft)));
      await this.router.navigate(['/split/groups', this.groupId, 'expenses', result.id]);
    } catch (error: any) {
      this.saveError = error?.error?.message ?? 'Expense could not be saved. Check the details and try again.';
    } finally { this.saving = false; }
  }
  get category() { return splitExpenseCategory[this.draft.categoryKey]; }
  get selectedParticipants() { return this.draft.participantIds.map((id) => this.members.find((m) => m.id === id)).filter(Boolean) as SplitMember[]; }
  get preview() { return allocationPreview(this.draft); }
  get payerSummary() { return this.draft.payments.length === 1 ? this.memberName(this.draft.payments[0]!.memberId) : `${this.draft.payments.length} people`; }
  get participantSummary() { return this.draft.participantIds.length ? `${this.draft.participantIds.length} selected` : 'Choose participants'; }
  get paymentRemaining() { const total = parseExpenseAmount(this.draft.amount, this.draft.currency) ?? 0; return total - this.draft.payments.reduce((sum, row) => sum + (parseExpenseAmount(row.amount, this.draft.currency) ?? 0), 0); }
  get allocationRemaining() { const total = parseExpenseAmount(this.draft.amount, this.draft.currency) ?? 0; return total - this.preview.reduce((sum, row) => sum + row.amountMinor, 0); }
  get allocationCaption() { if (this.draft.method === 'percentage') return `Total ${this.draft.participantIds.reduce((sum,id)=>sum+Number(this.draft.allocations[id]||0),0).toFixed(2)}%`; if (this.draft.method === 'shares') return 'Every participant needs at least one share.'; return `Remaining ${this.draft.currency} ${this.moneyAbs(this.allocationRemaining)}`; }
  memberName(id: string) { return this.members.find((member) => member.id === id)?.displayName ?? 'Former member'; }
  money(amount: number) { return formatExpenseAmount(amount, this.draft.currency); }
  moneyFor(amount: number, currency: SplitExpense['originalCurrency']) { return formatExpenseAmount(amount, currency); }
  moneyAbs(amount: number) { return formatExpenseAmount(Math.abs(amount), this.draft.currency); }
  amountChanged() { if (this.draft.payments.length === 1) this.draft.payments[0]!.amount = this.draft.amount; }
  chooseCurrency(currency: SplitExpenseDraft['currency']) { this.draft.currency = currency; this.draft.amount = ''; this.draft.exchangeRate='';this.rateSource='manual';this.fxError=''; this.draft.payments.forEach((row) => row.amount = ''); this.sheet = null; if(currency!==this.draft.baseCurrency) void this.suggestRate(); }
  async suggestRate(){if(this.draft.currency===this.draft.baseCurrency)return;this.fxLoading=true;this.fxError='';try{const q=await firstValueFrom(this.api.exchangeRate(this.groupId,this.draft.currency,this.draft.baseCurrency,this.draft.expenseDate));this.draft.exchangeRate=q.rate;this.rateSource='suggested';}catch{this.fxError='Suggested rate unavailable.';}finally{this.fxLoading=false;}}
  get convertedAmount(){const amount=parseExpenseAmount(this.draft.amount,this.draft.currency);const converted=amount&&this.draft.exchangeRate?convertExpenseAmount(amount,this.draft.currency,this.draft.baseCurrency,this.draft.exchangeRate):null;return converted?formatExpenseAmount(converted,this.draft.baseCurrency):'';}
  setMethod(method: SplitMethod) { this.draft.method = method; this.draft.allocations = {}; if (method === 'shares') this.draft.participantIds.forEach((id) => this.draft.allocations[id] = '1'); }
  toggleParticipant(id: string) { this.draft.participantIds = this.draft.participantIds.includes(id) ? this.draft.participantIds.filter((x) => x !== id) : [...this.draft.participantIds, id]; }
  isPayer(id: string) { return this.draft.payments.some((row) => row.memberId === id); }
  payerAmount(id: string) { return this.draft.payments.find((row) => row.memberId === id)?.amount ?? ''; }
  setPayerAmount(id: string, amount: string) { const row = this.draft.payments.find((item) => item.memberId === id); if (row) row.amount = amount; }
  togglePayer(id: string) { if (this.isPayer(id)) this.draft.payments = this.draft.payments.filter((row) => row.memberId !== id); else this.draft.payments = [...this.draft.payments, { memberId: id, amount: this.draft.payments.length ? '' : this.draft.amount }]; }
}
