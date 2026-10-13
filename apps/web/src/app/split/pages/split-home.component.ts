import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LucideMinus, LucidePencil, LucidePlus, LucideSettings, LucideTrash2 } from '@lucide/angular';
import { SplitAuthService } from '../auth/data-access/split-auth.service';
import { splitAmountSizeClass, splitRemainingPercent, type SplitBudgetAdjustment, type SplitBudgetAdjustmentKind, type SplitDashboardSummary } from '../data-access/split-dashboard.models';
import { SplitApiService } from '../data-access/split-api.service';
import { SplitBottomNavComponent } from '../ui/split-bottom-nav.component';
import { SplitBottomSheetComponent } from '../ui/split-bottom-sheet.component';

@Component({
  selector: 'nexus-split-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideSettings, LucidePlus, LucideMinus, LucidePencil, LucideTrash2, SplitBottomNavComponent, SplitBottomSheetComponent],
  template: `<main class="split-page split-dashboard-page">
    <div class="split-wrap dashboard-wrap">
      <header class="dashboard-head">
        <div><h1>首页</h1></div>
        <a class="icon-btn crayon-icon" routerLink="/split/settings" aria-label="设置"><svg lucideSettings></svg></a>
      </header>

      @if (loading()) {
        <section class="balance-card balance-loading" aria-label="正在加载余额"></section>
      } @else if (summary(); as data) {
        <section class="balance-card" [class.negative]="data.remainingMinor < 0">
          <div class="balance-card-title"><span>本月余额</span><small>{{ monthLabel() }}</small></div>
          <button class="adjust-button" type="button" aria-label="调整本月余额" title="调整本月余额" (click)="openAdjustments()"><svg lucidePencil></svg></button>
          <strong class="balance-amount" [ngClass]="amountClass(data.remainingMinor)">{{ money(data.remainingMinor) }}</strong>
          <div class="budget-progress" role="progressbar" aria-label="本月余额比例" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100">
            <span [style.width.%]="progress()"></span>
          </div>
          <div class="progress-labels"><span>RM 0</span><span>{{ money(data.availableMinor) }}</span></div>
        </section>
      } @else {
        <section class="dashboard-error"><p>暂时无法读取余额。</p><button class="secondary" (click)="load()">重试</button></section>
      }
    </div>
    <nexus-split-bottom-nav />

    @if (budgetRequired()) {
      <nexus-split-bottom-sheet label="设置月度总额" [dismissible]="false">
        <div class="sheet-title"><span class="sheet-sticker">★</span><div><h2>先设定月度总额</h2><p>设定后才能开始使用首页。</p></div></div>
        <label class="field"><span>每月可用总额</span><div class="money-input"><b>RM</b><input inputmode="decimal" autocomplete="off" [(ngModel)]="budgetInput" placeholder="0.00" /></div></label>
        @if (formError()) { <p class="error-text">{{ formError() }}</p> }
        <button class="primary full" [disabled]="saving()" (click)="saveRequiredBudget()">储存并进入首页</button>
      </nexus-split-bottom-sheet>
    }

    @if (adjustmentsOpen()) {
      <nexus-split-bottom-sheet label="调整本月余额" [expandable]="true" (closed)="closeAdjustments()">
        <div class="sheet-title"><div><h2>调整本月余额</h2><p>额外收入会增加可用总额，支出会减少余额。</p></div></div>
        <div class="kind-picker">
          <button [class.active]="adjustmentKind === 'income'" (click)="adjustmentKind='income'"><svg lucidePlus></svg>额外收入</button>
          <button [class.active]="adjustmentKind === 'expense'" (click)="adjustmentKind='expense'"><svg lucideMinus></svg>额外支出</button>
        </div>
        <label class="field"><span>金额</span><div class="money-input"><b>RM</b><input inputmode="decimal" autocomplete="off" [(ngModel)]="adjustmentAmount" placeholder="0.00" /></div></label>
        <label class="field"><span>备注 <small>选填</small></span><input maxlength="500" [(ngModel)]="adjustmentNote" placeholder="例如：奖金、交通费" /></label>
        @if (formError()) { <p class="error-text">{{ formError() }}</p> }
        <button class="primary full adjustment-submit" [disabled]="saving()" (click)="saveAdjustment()">{{ editingId ? '储存修改' : '新增记录' }}</button>
        @if (summary()?.adjustments?.length) {
          <div class="adjustment-history" [class.is-scrolling]="adjustmentHistoryScrolling()" (scroll)="onAdjustmentHistoryScroll()"><h3>本月记录</h3>
            @for (item of summary()!.adjustments; track item.id) {
              <div class="adjustment-row"><span class="adjustment-mark" [class.expense]="item.kind === 'expense'">{{ item.kind === 'income' ? '+' : '−' }}</span><span><strong>{{ item.note || (item.kind === 'income' ? '额外收入' : '额外支出') }}</strong><small>{{ item.effectiveDate }}</small></span><b>{{ item.kind === 'income' ? '+' : '-' }}{{ money(item.amountMinor) }}</b><button aria-label="编辑" (click)="edit(item)"><svg lucidePencil></svg></button><button aria-label="删除" (click)="remove(item.id)"><svg lucideTrash2></svg></button></div>
            }
          </div>
        }
      </nexus-split-bottom-sheet>
    }
  </main>`,
  styleUrls: ['../ui/split-ui.scss', './split-home.component.scss'],
})
export class SplitHomeComponent implements OnInit, OnDestroy {
  private readonly api = inject(SplitApiService);
  readonly auth = inject(SplitAuthService);
  readonly summary = signal<SplitDashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly adjustmentsOpen = signal(false);
  readonly adjustmentHistoryScrolling = signal(false);
  private adjustmentHistoryScrollTimer: ReturnType<typeof setTimeout> | null = null;
  readonly budgetRequired = computed(() => this.auth.currentUser()?.monthlyBudgetMinor == null);
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
  private readonly today = new Date();
  private readonly month = `${this.today.getFullYear()}-${String(this.today.getMonth() + 1).padStart(2, '0')}`;
  private readonly todayString = `${this.month}-${String(this.today.getDate()).padStart(2, '0')}`;

  ngOnInit() { void this.load(); }
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
  monthLabel() { return `${this.today.getMonth() + 1}月`; }
  money(minor: number) {
    const sign = minor < 0 ? '-' : '';
    return `${sign}RM ${Math.abs(minor / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  amountClass(minor: number) { return splitAmountSizeClass(minor); }
  async load() {
    this.loading.set(true);
    try { this.summary.set(await firstValueFrom(this.api.dashboard(this.month))); }
    catch { this.summary.set(null); }
    finally { this.loading.set(false); }
  }
  openAdjustments() { this.resetAdjustment(); this.adjustmentsOpen.set(true); }
  closeAdjustments() { this.adjustmentsOpen.set(false); this.resetAdjustment(); }
  private minor(value: string) {
    const amount = Number(value.trim());
    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  }
  async saveRequiredBudget() {
    const monthlyBudgetMinor = this.minor(this.budgetInput);
    if (monthlyBudgetMinor <= 0) { this.formError.set('月度总额必须大于 RM 0。'); return; }
    this.saving.set(true); this.formError.set('');
    try { await firstValueFrom(this.auth.updateProfile({ monthlyBudgetMinor })); await this.load(); }
    catch { this.formError.set('无法储存，请再试一次。'); }
    finally { this.saving.set(false); }
  }
  async saveAdjustment() {
    const amountMinor = this.minor(this.adjustmentAmount);
    if (amountMinor <= 0) { this.formError.set('金额必须大于 RM 0。'); return; }
    const input = { kind: this.adjustmentKind, amountMinor, note: this.adjustmentNote.trim() || null, effectiveDate: this.todayString };
    this.saving.set(true); this.formError.set('');
    try {
      if (this.editingId) await firstValueFrom(this.api.updateAdjustment(this.editingId, input));
      else await firstValueFrom(this.api.createAdjustment(input));
      await this.load(); this.resetAdjustment();
    } catch { this.formError.set('无法储存，请再试一次。'); }
    finally { this.saving.set(false); }
  }
  edit(item: SplitBudgetAdjustment) {
    this.editingId = item.id; this.adjustmentKind = item.kind;
    this.adjustmentAmount = (item.amountMinor / 100).toFixed(2); this.adjustmentNote = item.note ?? '';
    this.formError.set('');
  }
  async remove(id: string) {
    this.saving.set(true);
    try { await firstValueFrom(this.api.deleteAdjustment(id)); await this.load(); if (this.editingId === id) this.resetAdjustment(); }
    catch { this.formError.set('无法删除，请再试一次。'); }
    finally { this.saving.set(false); }
  }
  private resetAdjustment() { this.editingId = null; this.adjustmentKind = 'income'; this.adjustmentAmount = ''; this.adjustmentNote = ''; this.formError.set(''); }
}
