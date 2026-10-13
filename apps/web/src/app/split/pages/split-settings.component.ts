import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LucideChevronRight, LucideKeyRound, LucideLogOut, LucidePiggyBank, LucideUserRound } from '@lucide/angular';
import { SplitAuthService } from '../auth/data-access/split-auth.service';
import { SplitBottomNavComponent } from '../ui/split-bottom-nav.component';
import { SplitBottomSheetComponent } from '../ui/split-bottom-sheet.component';

type SettingKind = 'name' | 'budget' | 'password';

@Component({
  selector: 'nexus-split-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideChevronRight, LucideKeyRound, LucideLogOut, LucidePiggyBank, LucideUserRound, SplitBottomNavComponent, SplitBottomSheetComponent],
  template: `<main class="split-page settings-page"><div class="split-wrap settings-wrap">
    <header class="settings-head"><h1>我的设置</h1><p>管理你的个人资料与每月总额。</p></header>
    <section class="settings-card">
      <button (click)="ask('name')"><svg lucideUserRound></svg><span><small>我的名字</small><strong>{{ auth.currentUser()?.displayName }}</strong></span><svg lucideChevronRight></svg></button>
      <button (click)="ask('budget')"><svg lucidePiggyBank></svg><span><small>月度总额</small><strong>{{ budgetLabel() }}</strong></span><svg lucideChevronRight></svg></button>
      <button (click)="ask('password')"><svg lucideKeyRound></svg><span><small>账号安全</small><strong>更改密码</strong></span><svg lucideChevronRight></svg></button>
    </section>
    <button class="logout-button" (click)="logout()"><svg lucideLogOut></svg>退出登录</button>
  </div><nexus-split-bottom-nav />

  @if (confirming()) { <nexus-split-bottom-sheet [label]="confirmTitle()" [expandable]="true" (closed)="cancel()"><h2>{{ confirmTitle() }}</h2><p class="confirm-copy">{{ confirmCopy() }}</p><div class="confirm-actions"><button class="secondary" (click)="cancel()">否</button><button class="primary" (click)="beginEdit()">是</button></div></nexus-split-bottom-sheet> }
  @if (editing()) { <nexus-split-bottom-sheet [label]="editTitle()" [expandable]="true" (closed)="cancel()"><h2>{{ editTitle() }}</h2>
    <label class="field"><span>{{ fieldLabel() }}</span>@if (kind() === 'budget') { <div class="money-input"><b>RM</b><input inputmode="decimal" autocomplete="off" [(ngModel)]="value" /></div> } @else { <input [type]="kind() === 'password' ? 'password' : 'text'" [autocomplete]="kind() === 'password' ? 'new-password' : 'name'" [(ngModel)]="value" /> }</label>
    @if (error()) { <p class="error-text">{{ error() }}</p> }
    <button class="primary full settings-edit-submit" [disabled]="saving()" (click)="save()">储存</button>
  </nexus-split-bottom-sheet> }
  </main>`,
  styleUrls: ['../ui/split-ui.scss', './split-home.component.scss', './split-settings.component.scss'],
})
export class SplitSettingsComponent {
  readonly auth = inject(SplitAuthService);
  private readonly router = inject(Router);
  readonly kind = signal<SettingKind>('name');
  readonly confirming = signal(false);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  value = '';
  budgetLabel() { const minor=this.auth.currentUser()?.monthlyBudgetMinor; return minor == null ? '尚未设置' : `RM ${(minor/100).toLocaleString('en-MY',{minimumFractionDigits:2})}`; }
  ask(kind: SettingKind) { this.kind.set(kind); this.confirming.set(true); this.error.set(''); }
  cancel() { this.confirming.set(false); this.editing.set(false); this.value=''; this.error.set(''); }
  confirmTitle() { return this.kind()==='name' ? '要更改名字吗？' : this.kind()==='budget' ? '要更改月度总额吗？' : '要更改密码吗？'; }
  confirmCopy() { return this.kind()==='budget' ? '新的总额会立即用于计算本月余额。' : this.kind()==='password' ? '储存新密码后即可继续使用。' : '新的名字会显示在你的账号中。'; }
  editTitle() { return this.kind()==='name' ? '更改名字' : this.kind()==='budget' ? '更改月度总额' : '更改密码'; }
  fieldLabel() { return this.kind()==='name' ? '新名字' : this.kind()==='budget' ? '新的每月总额' : '新密码'; }
  beginEdit() { this.confirming.set(false); this.editing.set(true); const user=this.auth.currentUser(); this.value=this.kind()==='name' ? user?.displayName ?? '' : this.kind()==='budget' && user?.monthlyBudgetMinor ? (user.monthlyBudgetMinor/100).toFixed(2) : ''; }
  async save() {
    this.error.set('');
    this.saving.set(true);
    try {
      if (this.kind()==='name') {
        if (!this.value.trim()) { this.error.set('请输入名字。'); return; }
        await firstValueFrom(this.auth.updateProfile({displayName:this.value.trim()}));
      } else if (this.kind()==='budget') {
        const minor=Math.round(Number(this.value)*100);
        if (!Number.isSafeInteger(minor)||minor<=0) { this.error.set('月度总额必须大于 RM 0。'); return; }
        await firstValueFrom(this.auth.updateProfile({monthlyBudgetMinor:minor}));
      } else {
        if (this.value.length<5||this.value.length>128) { this.error.set('密码必须为5至128个字符。'); return; }
        await firstValueFrom(this.auth.updatePassword(this.value));
      }
      this.cancel();
    } catch { this.error.set('无法储存，请再试一次。'); } finally { this.saving.set(false); }
  }
  async logout() { await this.auth.logout(); await this.router.navigateByUrl('/split/login'); }
}
