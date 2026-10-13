import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  LucideCreditCard,
  LucideMinus,
  LucidePencil,
  LucidePlus,
  LucideSettings,
  LucideTrash2,
} from '@lucide/angular';
import { SplitAuthService } from '../auth/data-access/split-auth.service';
import {
  splitAmountSizeClass,
  splitRemainingPercent,
  type SplitBudgetAdjustment,
  type SplitBudgetAdjustmentKind,
  type SplitCreditCard,
  type SplitDashboardSummary,
} from '../data-access/split-dashboard.models';
import { SplitApiService } from '../data-access/split-api.service';
import { parseExpenseAmount } from '../data-access/split-expense.models';
import { SplitOfflineCacheService } from '../data-access/split-offline-cache.service';
import { SplitBottomNavComponent } from '../ui/split-bottom-nav.component';
import { SplitBottomSheetComponent } from '../ui/split-bottom-sheet.component';
import { SplitMoneyInputDirective } from '../ui/split-money-input.directive';

const cardProviders = [
  { name: 'Maybank', domain: 'maybank2u.com.my', short: 'M' },
  { name: 'CIMB', domain: 'cimb.com.my', short: 'C' },
  { name: 'Public Bank', domain: 'pbebank.com', short: 'PB' },
  { name: 'RHB', domain: 'rhbgroup.com', short: 'R' },
  { name: 'Hong Leong Bank', domain: 'hlb.com.my', short: 'HL' },
  { name: 'UOB', domain: 'uob.com.my', short: 'U' },
  { name: 'OCBC', domain: 'ocbc.com.my', short: 'O' },
  { name: 'AmBank', domain: 'ambank.com.my', short: 'A' },
  { name: 'Bank Islam', domain: 'bankislam.com', short: 'BI' },
  { name: 'HSBC', domain: 'hsbc.com.my', short: 'H' },
  { name: 'Standard Chartered', domain: 'sc.com', short: 'SC' },
  { name: 'GXBank', domain: 'gxbank.my', short: 'GX' },
  { name: 'Ryt Bank', domain: 'rytbank.my', short: 'RYT' },
  { name: 'Shopee', domain: 'shopee.com.my', short: 'S' },
  { name: 'Atome', domain: 'atome.my', short: 'A' },
  { name: 'Grab', domain: 'grab.com', short: 'G' },
] as const;

@Component({
  selector: 'nexus-split-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideCreditCard,
    LucideSettings,
    LucidePlus,
    LucideMinus,
    LucidePencil,
    LucideTrash2,
    SplitBottomNavComponent,
    SplitBottomSheetComponent,
    SplitMoneyInputDirective,
  ],
  template: `<main class="split-page split-dashboard-page">
    <div class="split-wrap dashboard-wrap">
      <header class="dashboard-head">
        <div><h1>首页</h1></div>
        <a class="icon-btn crayon-icon" routerLink="/split/settings" aria-label="设置"
          ><svg lucideSettings></svg
        ></a>
      </header>

      @if (loading()) {
        <section class="balance-card balance-loading" aria-label="正在加载余额"></section>
      } @else if (summary(); as data) {
        <section class="balance-card" [class.negative]="data.remainingMinor < 0">
          <div class="balance-card-title">
            <span>本月余额</span><small>{{ monthLabel() }}</small>
          </div>
          <button
            class="adjust-button"
            type="button"
            aria-label="调整本月余额"
            title="调整本月余额"
            (click)="openAdjustments()"
          >
            <svg lucidePencil></svg>
          </button>
          <strong class="balance-amount" [ngClass]="amountClass(data.remainingMinor)">{{
            money(data.remainingMinor)
          }}</strong>
          <div
            class="budget-progress"
            role="progressbar"
            aria-label="本月余额比例"
            [attr.aria-valuenow]="progress()"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span [style.width.%]="progress()"></span>
          </div>
          <div class="progress-labels">
            <span>RM 0</span><span>{{ money(data.availableMinor) }}</span>
          </div>
        </section>
        <section class="card-debt-section" aria-labelledby="card-debt-title">
          <header class="card-debt-head">
            <div>
              <h2 id="card-debt-title">我的卡债</h2>
              <p>{{ cards().length ? '共 ' + money(cardDebtTotal()) : '还没有添加卡片' }}</p>
            </div>
            <button class="add-card-button" type="button" (click)="openCardEditor()">
              <svg lucidePlus></svg><span>加卡</span>
            </button>
          </header>
          @if (cards().length) {
            <div class="credit-card-list">
              @for (card of cards(); track card.id; let index = $index) {
                <button
                  class="credit-card"
                  [class.card-tone-two]="index % 3 === 1"
                  [class.card-tone-three]="index % 3 === 2"
                  type="button"
                  (click)="openCardEditor(card)"
                  [attr.aria-label]="'编辑 ' + card.name"
                >
                  <span class="credit-card-top"
                    ><span
                      class="bank-logo card-bank-logo"
                      [style.background-image]="bankLogo(card.name)"
                      >{{ bankShort(card.name) }}</span
                    ><small>信用卡欠款</small></span
                  >
                  <strong>{{ card.name }}</strong>
                  <b>{{ money(card.amountMinor) }}</b>
                </button>
              }
            </div>
          } @else {
            <button class="card-debt-empty" type="button" (click)="openCardEditor()">
              <span><svg lucideCreditCard></svg></span>
              <strong>添加第一张卡</strong>
              <small>输入卡名和目前欠款，余额会自动扣除。</small>
            </button>
          }
        </section>
      } @else {
        <section class="dashboard-error">
          <p>暂时无法读取余额。</p>
          <button class="secondary" (click)="load()">重试</button>
        </section>
      }
    </div>
    <nexus-split-bottom-nav />

    @if (budgetRequired()) {
      <nexus-split-bottom-sheet label="设置月度总额" [dismissible]="false">
        <div class="sheet-title">
          <span class="sheet-sticker">★</span>
          <div>
            <h2>先设定月度总额</h2>
            <p>设定后才能开始使用首页。</p>
          </div>
        </div>
        <label class="field"
          ><span>每月可用总额</span>
          <div class="money-input">
            <b>RM</b
            ><input
              inputmode="decimal"
              splitMoneyInput
              autocomplete="off"
              [(ngModel)]="budgetInput"
              placeholder="0.00"
            /></div
        ></label>
        @if (formError()) {
          <p class="error-text">{{ formError() }}</p>
        }
        <button
          class="primary full required-budget-submit"
          [disabled]="saving()"
          (click)="saveRequiredBudget()"
        >
          储存并进入首页
        </button>
      </nexus-split-bottom-sheet>
    }

    @if (adjustmentsOpen()) {
      <nexus-split-bottom-sheet
        label="调整本月余额"
        [expandable]="true"
        [coversBottomNav]="true"
        (closed)="closeAdjustments()"
      >
        <div class="sheet-title">
          <div>
            <h2>调整本月余额</h2>
            <p>额外收入会增加可用总额，支出会减少余额。</p>
          </div>
        </div>
        <div class="kind-picker">
          <button [class.active]="adjustmentKind === 'income'" (click)="adjustmentKind = 'income'">
            <svg lucidePlus></svg>额外收入
          </button>
          <button
            [class.active]="adjustmentKind === 'expense'"
            (click)="adjustmentKind = 'expense'"
          >
            <svg lucideMinus></svg>额外支出
          </button>
        </div>
        <label class="field"
          ><span>金额</span>
          <div class="money-input">
            <b>RM</b
            ><input
              inputmode="decimal"
              splitMoneyInput
              autocomplete="off"
              [(ngModel)]="adjustmentAmount"
              placeholder="0.00"
            /></div
        ></label>
        <label class="field"
          ><span>备注 <small>选填</small></span
          ><input maxlength="500" [(ngModel)]="adjustmentNote" placeholder="例如：奖金、交通费"
        /></label>
        @if (formError()) {
          <p class="error-text">{{ formError() }}</p>
        }
        <button
          class="primary full adjustment-submit"
          [disabled]="saving()"
          (click)="saveAdjustment()"
        >
          {{ editingId ? '储存修改' : '新增记录' }}
        </button>
        @if (summary()?.adjustments?.length) {
          <div
            class="adjustment-history"
            [class.is-scrolling]="adjustmentHistoryScrolling()"
            (scroll)="onAdjustmentHistoryScroll()"
          >
            <h3>本月记录</h3>
            @for (item of summary()!.adjustments; track item.id) {
              <div class="adjustment-row">
                <span class="adjustment-mark" [class.expense]="item.kind === 'expense'">{{
                  item.kind === 'income' ? '+' : '−'
                }}</span
                ><span
                  ><strong>{{
                    item.note || (item.kind === 'income' ? '额外收入' : '额外支出')
                  }}</strong
                  ><small>{{ item.effectiveDate }}</small></span
                ><b>{{ item.kind === 'income' ? '+' : '-' }}{{ money(item.amountMinor) }}</b
                ><button aria-label="编辑" (click)="edit(item)"><svg lucidePencil></svg></button
                ><button aria-label="删除" (click)="remove(item.id)">
                  <svg lucideTrash2></svg>
                </button>
              </div>
            }
          </div>
        }
      </nexus-split-bottom-sheet>
    }

    @if (cardEditorOpen()) {
      <nexus-split-bottom-sheet
        [label]="editingCardId ? '编辑卡片' : '添加卡片'"
        [coversBottomNav]="true"
        (closed)="closeCardEditor()"
      >
        <div class="sheet-title">
          <span class="sheet-sticker card-sticker"><svg lucideCreditCard></svg></span>
          <div>
            <h2>{{ editingCardId ? '编辑卡片' : '添加卡片' }}</h2>
            <p>卡债会直接从本月余额扣除。</p>
          </div>
        </div>
        @if (editingCardId) {
          <div class="selected-bank-card">
            <span class="bank-logo" [style.background-image]="bankLogo(cardName)">{{
              bankShort(cardName)
            }}</span>
            <strong>{{ cardName }}</strong>
          </div>
          <label class="field"
            ><span>目前欠款</span>
            <div class="money-input">
              <b>RM</b
              ><input
                inputmode="decimal"
                splitMoneyInput
                autocomplete="off"
                [(ngModel)]="cardAmount"
                placeholder="0.00"
              /></div
          ></label>
        } @else {
          <div class="bank-picker" aria-label="选择银行">
            @for (bank of providers; track bank.name) {
              <div class="bank-choice" [class.selected]="isBankSelected(bank.name)">
                <label>
                  <span class="bank-logo" [style.background-image]="bankLogo(bank.name)">{{
                    bank.short
                  }}</span>
                  <strong>{{ bank.name }}</strong>
                  <input
                    type="checkbox"
                    [checked]="isBankSelected(bank.name) || isBankAdded(bank.name)"
                    [disabled]="isBankAdded(bank.name)"
                    (change)="toggleBank(bank.name)"
                  />
                </label>
                @if (isBankSelected(bank.name)) {
                  <div class="bank-amount-input">
                    <b>RM</b>
                    <input
                      inputmode="decimal"
                      splitMoneyInput
                      autocomplete="off"
                      [ngModel]="selectedBankAmounts[bank.name]"
                      (ngModelChange)="selectedBankAmounts[bank.name] = $event"
                      placeholder="0.00"
                      [attr.aria-label]="bank.name + ' 欠款金额'"
                    />
                  </div>
                }
              </div>
            }
          </div>
        }
        @if (cardError()) {
          <p class="error-text">{{ cardError() }}</p>
        }
        <button class="primary full card-submit" [disabled]="saving()" (click)="saveCard()">
          {{
            saving()
              ? '储存中…'
              : editingCardId
                ? '储存更改'
                : selectedBankCount
                  ? '添加 ' + selectedBankCount + ' 张卡'
                  : '选择卡片'
          }}
        </button>
        @if (editingCardId) {
          <button class="card-delete full" [disabled]="saving()" (click)="removeCard()">
            删除卡片
          </button>
        }
      </nexus-split-bottom-sheet>
    }
  </main>`,
  styleUrls: ['../ui/split-ui.scss', './split-home.component.scss'],
})
export class SplitHomeComponent implements OnInit, OnDestroy {
  private pendingAdjustmentCreate: { body: string; key: string } | null = null;
  private pendingCardCreates: Record<string, { body: string; key: string }> = {};
  private readonly api = inject(SplitApiService);
  private readonly cache = inject(SplitOfflineCacheService);
  readonly auth = inject(SplitAuthService);
  readonly summary = signal<SplitDashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly adjustmentsOpen = signal(false);
  readonly cardEditorOpen = signal(false);
  readonly cardError = signal('');
  readonly adjustmentHistoryScrolling = signal(false);
  private adjustmentHistoryScrollTimer: ReturnType<typeof setTimeout> | null = null;
  readonly budgetRequired = computed(() => this.auth.currentUser()?.monthlyBudgetMinor == null);
  readonly cards = computed(() => this.summary()?.creditCards ?? []);
  readonly cardDebtTotal = computed(() => this.summary()?.cardDebtMinor ?? 0);
  readonly providers = cardProviders;
  readonly progress = computed(() => {
    const data = this.summary();
    if (!data || data.availableMinor <= 0) return 0;
    return splitRemainingPercent(data.remainingMinor, data.availableMinor);
  });
  budgetInput = '';
  adjustmentKind: SplitBudgetAdjustmentKind = 'income';
  adjustmentAmount = '';
  adjustmentNote = '';
  editingId: string | null = null;
  editingCardId: string | null = null;
  cardName = '';
  cardAmount = '';
  selectedBankAmounts: Record<string, string> = {};
  private readonly today = new Date();
  private readonly month = `${this.today.getFullYear()}-${String(this.today.getMonth() + 1).padStart(2, '0')}`;
  private readonly todayString = `${this.month}-${String(this.today.getDate()).padStart(2, '0')}`;

  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    if (this.adjustmentHistoryScrollTimer) clearTimeout(this.adjustmentHistoryScrollTimer);
  }
  onAdjustmentHistoryScroll() {
    this.adjustmentHistoryScrolling.set(true);
    if (this.adjustmentHistoryScrollTimer) clearTimeout(this.adjustmentHistoryScrollTimer);
    this.adjustmentHistoryScrollTimer = setTimeout(() => {
      this.adjustmentHistoryScrolling.set(false);
      this.adjustmentHistoryScrollTimer = null;
    }, 700);
  }
  monthLabel() {
    return `${this.today.getMonth() + 1}月`;
  }
  money(minor: number) {
    const sign = minor < 0 ? '-' : '';
    return `${sign}RM ${Math.abs(minor / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  amountClass(minor: number) {
    return splitAmountSizeClass(minor);
  }
  async load() {
    const key = `/api/split/dashboard?month=${encodeURIComponent(this.month)}`;
    const cached = await this.cache.get(key);
    if (cached) {
      this.summary.set(cached.body as SplitDashboardSummary);
      this.loading.set(false);
    } else {
      this.loading.set(!this.summary());
    }
    try {
      this.summary.set(await firstValueFrom(this.api.dashboard(this.month)));
    } catch {
      if (!cached) this.summary.set(null);
    } finally {
      this.loading.set(false);
    }
  }
  openAdjustments() {
    this.resetAdjustment();
    this.adjustmentsOpen.set(true);
  }
  closeAdjustments() {
    this.adjustmentsOpen.set(false);
    this.resetAdjustment();
  }
  private minor(value: string) {
    return parseExpenseAmount(value, 'MYR') ?? 0;
  }
  async saveRequiredBudget() {
    const monthlyBudgetMinor = this.minor(this.budgetInput);
    if (monthlyBudgetMinor <= 0) {
      this.formError.set('月度总额必须大于 RM 0。');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    try {
      await firstValueFrom(this.auth.updateProfile({ monthlyBudgetMinor }));
      await this.load();
    } catch {
      this.formError.set('无法储存，请再试一次。');
    } finally {
      this.saving.set(false);
    }
  }
  async saveAdjustment() {
    const amountMinor = this.minor(this.adjustmentAmount);
    if (amountMinor <= 0) {
      this.formError.set('金额必须大于 RM 0。');
      return;
    }
    const input = {
      kind: this.adjustmentKind,
      amountMinor,
      note: this.adjustmentNote.trim() || null,
      effectiveDate: this.todayString,
    };
    this.saving.set(true);
    this.formError.set('');
    try {
      if (this.editingId) await firstValueFrom(this.api.updateAdjustment(this.editingId, input));
      else {
        const requestBody = JSON.stringify(input);
        const key =
          this.pendingAdjustmentCreate?.body === requestBody
            ? this.pendingAdjustmentCreate.key
            : (this.pendingAdjustmentCreate = { body: requestBody, key: crypto.randomUUID() }).key;
        await firstValueFrom(this.api.createAdjustment(input, key));
        this.pendingAdjustmentCreate = null;
      }
      await this.load();
      this.resetAdjustment();
    } catch {
      this.formError.set('无法储存，请再试一次。');
    } finally {
      this.saving.set(false);
    }
  }
  edit(item: SplitBudgetAdjustment) {
    this.editingId = item.id;
    this.adjustmentKind = item.kind;
    this.adjustmentAmount = (item.amountMinor / 100).toFixed(2);
    this.adjustmentNote = item.note ?? '';
    this.formError.set('');
  }
  async remove(id: string) {
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.deleteAdjustment(id));
      await this.load();
      if (this.editingId === id) this.resetAdjustment();
    } catch {
      this.formError.set('无法删除，请再试一次。');
    } finally {
      this.saving.set(false);
    }
  }
  openCardEditor(card?: SplitCreditCard) {
    this.editingCardId = card?.id ?? null;
    this.cardName = card?.name ?? '';
    this.cardAmount = card ? (card.amountMinor / 100).toFixed(2) : '';
    this.selectedBankAmounts = {};
    this.cardError.set('');
    this.cardEditorOpen.set(true);
  }
  closeCardEditor() {
    this.cardEditorOpen.set(false);
    this.resetCardEditor();
  }
  async saveCard() {
    if (!this.editingCardId && !this.selectedBankCount) {
      this.cardError.set('请至少选择一家银行。');
      return;
    }
    this.saving.set(true);
    this.cardError.set('');
    try {
      if (this.editingCardId) {
        const amountMinor = this.parseCardAmount(this.cardAmount);
        if (amountMinor === null) {
          this.cardError.set('请输入有效的欠款金额。');
          return;
        }
        const input = { name: this.cardName.trim(), amountMinor };
        const updated = await firstValueFrom(this.api.updateCard(this.editingCardId, input));
        this.applyCreditCards(
          this.cards().map((card) => (card.id === updated.id ? updated : card)),
        );
      } else {
        const inputs = Object.entries(this.selectedBankAmounts).map(([name, value]) => {
          const amountMinor = this.parseCardAmount(value);
          if (amountMinor === null) throw new Error('INVALID_AMOUNT:' + name);
          return { name, amountMinor };
        });
        const created = await Promise.all(
          inputs.map((input) => {
            const body = JSON.stringify(input);
            const pending = this.pendingCardCreates[input.name];
            const key =
              pending?.body === body
                ? pending.key
                : (this.pendingCardCreates[input.name] = {
                    body,
                    key: crypto.randomUUID(),
                  }).key;
            return firstValueFrom(this.api.createCard(input, key));
          }),
        );
        this.applyCreditCards([...this.cards(), ...created]);
        this.pendingCardCreates = {};
      }
      this.closeCardEditor();
    } catch (error) {
      const invalidName =
        error instanceof Error && error.message.startsWith('INVALID_AMOUNT:')
          ? error.message.slice('INVALID_AMOUNT:'.length)
          : '';
      this.cardError.set(
        invalidName ? '请输入 ' + invalidName + ' 的有效欠款金额。' : '无法储存卡片，请再试一次。',
      );
    } finally {
      this.saving.set(false);
    }
  }
  async removeCard() {
    if (!this.editingCardId) return;
    this.saving.set(true);
    this.cardError.set('');
    try {
      await firstValueFrom(this.api.deleteCard(this.editingCardId));
      this.applyCreditCards(this.cards().filter((card) => card.id !== this.editingCardId));
      this.closeCardEditor();
    } catch {
      this.cardError.set('无法删除卡片，请再试一次。');
    } finally {
      this.saving.set(false);
    }
  }
  private resetCardEditor() {
    this.editingCardId = null;
    this.cardName = '';
    this.cardAmount = '';
    this.selectedBankAmounts = {};
    this.cardError.set('');
  }
  get selectedBankCount() {
    return Object.keys(this.selectedBankAmounts).length;
  }
  isBankSelected(name: string) {
    return Object.hasOwn(this.selectedBankAmounts, name);
  }
  isBankAdded(name: string) {
    return this.cards().some((card) => card.name.toLowerCase() === name.toLowerCase());
  }
  toggleBank(name: string) {
    if (this.isBankAdded(name)) return;
    if (this.isBankSelected(name)) {
      const next = { ...this.selectedBankAmounts };
      delete next[name];
      this.selectedBankAmounts = next;
    } else {
      this.selectedBankAmounts = { ...this.selectedBankAmounts, [name]: '' };
    }
    this.cardError.set('');
  }
  bankLogo(name: string) {
    const domain = cardProviders.find((provider) => provider.name === name)?.domain;
    return domain
      ? 'url("https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=128")'
      : '';
  }
  bankShort(name: string) {
    return (
      cardProviders.find((provider) => provider.name === name)?.short ??
      name
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 3)
        .toUpperCase()
    );
  }
  private parseCardAmount(value: string) {
    const amountText = value.trim();
    if (!amountText) return null;
    return /^0+(?:\.0{1,2})?$/.test(amountText) ? 0 : parseExpenseAmount(amountText, 'MYR');
  }
  private applyCreditCards(cards: SplitCreditCard[]) {
    const current = this.summary();
    if (!current) return;
    const previousDebt = current.cardDebtMinor ?? 0;
    const cardDebtMinor = cards.reduce((total, card) => total + card.amountMinor, 0);
    this.summary.set({
      ...current,
      creditCards: cards,
      cardDebtMinor,
      spentMinor: current.spentMinor - previousDebt + cardDebtMinor,
      remainingMinor: current.remainingMinor + previousDebt - cardDebtMinor,
    });
  }
  private resetAdjustment() {
    this.editingId = null;
    this.adjustmentKind = 'income';
    this.adjustmentAmount = '';
    this.adjustmentNote = '';
    this.formError.set('');
  }
}
