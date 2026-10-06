import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideArrowLeft } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { SplitApiService } from '../data-access/split-api.service';
import {
  formatExpenseAmount,
  parseExpenseAmount,
  type SplitBalances,
} from '../data-access/split-expense.models';
import type { SplitMember } from '../data-access/split.models';
@Component({
  selector: 'nexus-split-settle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideArrowLeft],
  template: `<main class="split-page">
    <div class="split-wrap">
      <header class="split-top">
        <a class="back" [routerLink]="['/split/groups', groupId]"><svg lucideArrowLeft></svg></a
        ><strong>记录还款</strong><span class="back"></span>
      </header>
      @if (!balances) {
        <div class="skeleton"></div>
      } @else {
        <form class="form" (ngSubmit)="save()">
          <label class="field"
            >付款人<select name="from" [(ngModel)]="fromMemberId" (ngModelChange)="selectDebt()">
              @for (m of members; track m.id) {
                <option [value]="m.id">{{ m.displayName }}</option>
              }
            </select></label
          ><label class="field"
            >收款人<select name="to" [(ngModel)]="toMemberId" (ngModelChange)="selectDebt()">
              @for (m of members; track m.id) {
                <option [value]="m.id">{{ m.displayName }}</option>
              }
            </select></label
          ><label class="field"
            >金额（{{ balances.baseCurrency }}）<input
              name="amount"
              [(ngModel)]="amount"
              inputmode="decimal"
          /></label>
          <p class="notice">付款后剩余：{{ balances.baseCurrency }} {{ remaining }}</p>
          <label class="field"
            >付款方式<select name="method" [(ngModel)]="paymentMethod">
              <option value="cash">现金</option>
              <option value="duitnow">DuitNow</option>
              <option value="bank_transfer">银行转账</option>
              <option value="ewallet">电子钱包</option>
              <option value="other">其他</option>
            </select></label
          ><label class="field"
            >日期<input type="date" name="date" [(ngModel)]="settlementDate" /></label
          ><label class="field">备注<textarea name="note" [(ngModel)]="note"></textarea></label>
          @if (error) {
            <p class="error-text">{{ error }}</p>
          }
          <div class="sticky-action">
            <button class="primary full" [disabled]="saving">
              {{ saving ? '保存中…' : '记录付款' }}
            </button>
          </div>
        </form>
      }
    </div>
  </main>`,
  styleUrls: ['../ui/split-ui.scss'],
})
export class SplitSettleComponent implements OnInit {
  private api = inject(SplitApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  groupId = '';
  balances?: SplitBalances;
  members: SplitMember[] = [];
  fromMemberId = '';
  toMemberId = '';
  amount = '';
  paymentMethod = 'cash';
  settlementDate = new Date().toISOString().slice(0, 10);
  note = '';
  error = '';
  saving = false;
  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('groupId')!;
    void this.load();
  }
  async load() {
    try {
      [this.balances, this.members] = await Promise.all([
        firstValueFrom(this.api.balances(this.groupId)),
        firstValueFrom(this.api.members(this.groupId)),
      ]);
      const d = (
        this.balances.simplifyDebtsEnabled
          ? this.balances.simplifiedDebts
          : this.balances.directDebts
      )[0];
      if (d) {
        this.fromMemberId = d.fromMemberId;
        this.toMemberId = d.toMemberId;
        this.amount = formatExpenseAmount(d.amountMinor, this.balances.baseCurrency);
      }
    } catch {
      this.error = '无法加载还款信息。';
    }
  }
  get debt() {
    return (
      this.balances?.simplifyDebtsEnabled
        ? this.balances.simplifiedDebts
        : this.balances?.directDebts
    )?.find((d) => d.fromMemberId === this.fromMemberId && d.toMemberId === this.toMemberId);
  }
  get remaining() {
    const amount = this.balances
      ? (parseExpenseAmount(this.amount, this.balances.baseCurrency) ?? 0)
      : 0;
    return this.balances
      ? formatExpenseAmount(
          Math.max(0, (this.debt?.amountMinor ?? 0) - amount),
          this.balances.baseCurrency,
        )
      : '0';
  }
  selectDebt() {
    const d = this.debt;
    if (d && this.balances)
      this.amount = formatExpenseAmount(d.amountMinor, this.balances.baseCurrency);
  }
  async save() {
    if (!this.balances) return;
    const amountMinor = parseExpenseAmount(this.amount, this.balances.baseCurrency);
    if (!amountMinor) {
      this.error = '请输入有效金额。';
      return;
    }
    this.saving = true;
    this.error = '';
    try {
      await firstValueFrom(
        this.api.createSettlement(this.groupId, {
          fromMemberId: this.fromMemberId,
          toMemberId: this.toMemberId,
          amountMinor,
          paymentMethod: this.paymentMethod,
          settlementDate: this.settlementDate,
          note: this.note || null,
        }),
      );
      await this.router.navigate(['/split/groups', this.groupId]);
    } catch {
      this.error = '无法记录付款，请检查金额和成员后重试。';
    } finally {
      this.saving = false;
    }
  }
}
