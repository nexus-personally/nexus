import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideEllipsis } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { SplitAuthService } from '../auth/data-access/split-auth.service';
import { SplitApiService } from '../data-access/split-api.service';
import {
  canManageExpense,
  formatExpenseAmount,
  splitExpenseCategory,
  type SplitExpense,
} from '../data-access/split-expense.models';
import { type SplitGroup, type SplitMember } from '../data-access/split.models';
import { SplitBottomSheetComponent } from '../ui/split-bottom-sheet.component';
import { SplitDatePipe } from '../ui/split-date.pipe';

@Component({
  selector: 'nexus-split-expense-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideArrowLeft,
    LucideEllipsis,
    SplitBottomSheetComponent,
    SplitDatePipe,
  ],
  template: `<main class="split-page">
      <div class="split-wrap">
        @if (error) {
          <section class="error">
            <p>{{ error }}</p>
            <button class="secondary" (click)="load()">重试</button>
          </section>
        } @else if (!expense) {
          <div class="skeleton"></div>
        } @else {
          <header class="split-top">
            <a class="back" [routerLink]="['/split/groups', groupId]"><svg lucideArrowLeft></svg></a
            ><strong>费用详情</strong>
            @if (canEdit) {
              <button class="icon-btn" (click)="menu = true"><svg lucideEllipsis></svg></button>
            } @else {
              <span class="back"></span>
            }
          </header>
          <section class="expense-hero">
            <span class="category-glyph">{{ category.icon }}</span>
            <p class="eyebrow">{{ category.label }}</p>
            <h1>{{ expense.description }}</h1>
            <strong class="expense-total"
              >{{ expense.originalCurrency }} {{ money(expense.originalAmountMinor) }}</strong
            >
            @if (expense.originalCurrency !== expense.baseCurrency) {
              <p class="muted">
                {{ expense.baseCurrency }} {{ baseMoney(expense.baseAmountMinor) }} · 汇率
                {{ expense.exchangeRate }}
              </p>
            }
            <p class="muted">{{ expense.expenseDate | splitDate }}</p>
          </section>
          <section class="detail-card">
            <h2>付款人</h2>
            @for (row of expense.payments; track row.id) {
              <p>
                <span>{{ name(row.memberId) }}</span
                ><b>{{ expense.originalCurrency }} {{ money(row.amountMinor) }}</b>
              </p>
            }
          </section>
          <section class="detail-card">
            <h2>分摊明细</h2>
            @for (row of expense.splits; track row.id) {
              <p>
                <span>{{ name(row.memberId) }}</span
                ><b>{{ expense.originalCurrency }} {{ money(row.amountMinor) }}</b>
              </p>
            }
          </section>
          @if (expense.note) {
            <section class="detail-card">
              <h2>备注</h2>
              <p>{{ expense.note }}</p>
            </section>
          }
          <section class="detail-card metadata">
            <p>
              <span>创建者</span><b>{{ creatorName }}</b>
            </p>
            <p>
              <span>创建时间</span><b>{{ expense.createdAt | splitDate: 'datetime' }}</b>
            </p>
          </section>
        }
      </div>
    </main>
    @if (menu) {
      <nexus-split-bottom-sheet label="费用操作" (closed)="menu = false"
        ><h2>费用操作</h2>
        <a class="sheet-option" [routerLink]="['edit']">编辑费用</a
        ><button class="sheet-option danger-text" (click)="menu = false; confirmDelete = true">
          删除费用</button
        ><button class="sheet-option" (click)="menu = false">取消</button></nexus-split-bottom-sheet
      >
    }
    @if (confirmDelete) {
      <nexus-split-bottom-sheet label="删除费用" (closed)="confirmDelete = false"
        ><h2>要删除这笔费用吗？</h2>
        <p>删除后将不再影响余额，但这项操作仍会保留在动态中。</p>
        @if (deleteError) {
          <p class="error-text">{{ deleteError }}</p>
        }
        <button class="danger full" [disabled]="deleting" (click)="remove()">
          {{ deleting ? '删除中…' : '删除费用' }}
        </button></nexus-split-bottom-sheet
      >
    }`,
  styleUrls: ['../ui/split-ui.scss'],
})
export class SplitExpenseDetailComponent implements OnInit {
  private readonly api = inject(SplitApiService);
  private readonly auth = inject(SplitAuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  groupId = '';
  expenseId = '';
  group?: SplitGroup;
  expense?: SplitExpense;
  members: SplitMember[] = [];
  error = '';
  deleteError = '';
  menu = false;
  confirmDelete = false;
  deleting = false;
  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('groupId')!;
    this.expenseId = this.route.snapshot.paramMap.get('expenseId')!;
    void this.load();
  }
  async load() {
    this.error = '';
    try {
      [this.group, this.members, this.expense] = await Promise.all([
        firstValueFrom(this.api.group(this.groupId)),
        firstValueFrom(this.api.members(this.groupId)),
        firstValueFrom(this.api.expense(this.groupId, this.expenseId)),
      ]);
    } catch {
      this.error = '无法加载这笔费用。';
    }
  }
  get category() {
    return splitExpenseCategory[this.expense!.categoryKey];
  }
  get canEdit() {
    return (
      !!this.group &&
      !!this.expense &&
      canManageExpense(
        this.group.status,
        this.group.currentUserRole,
        this.auth.currentUser()?.id,
        this.expense.createdByUserId,
      )
    );
  }
  get creatorName() {
    const id = this.expense?.createdByUserId;
    return this.members.find((member) => member.userId === id)?.displayName ?? '已离开的成员';
  }
  name(id: string) {
    return this.members.find((member) => member.id === id)?.displayName ?? '已离开的成员';
  }
  money(amount: number) {
    return formatExpenseAmount(amount, this.expense!.originalCurrency);
  }
  baseMoney(amount: number) {
    return formatExpenseAmount(amount, this.expense!.baseCurrency);
  }
  async remove() {
    this.deleting = true;
    this.deleteError = '';
    try {
      await firstValueFrom(this.api.deleteExpense(this.groupId, this.expenseId));
      await this.router.navigate(['/split/groups', this.groupId]);
    } catch {
      this.deleteError = '无法删除这笔费用。';
    } finally {
      this.deleting = false;
    }
  }
}
