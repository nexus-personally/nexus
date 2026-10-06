import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SplitAuthShellComponent } from '../../components/split-auth-shell/split-auth-shell.component';
import { SplitAuthService } from '../../data-access/split-auth.service';
import { safeSplitReturnUrl } from '../../guards/split-route-access';

@Component({
  selector: 'nexus-split-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SplitAuthShellComponent],
  template: `
    <nexus-split-auth-shell>
      <header>
        <span>开始使用</span>
        <h1>创建 Split 账号</h1>
        <p>此账号仅用于 NEXUS Split。</p>
      </header>
      <form (ngSubmit)="submit()" novalidate>
        <label
          >电子邮箱<input
            name="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            required
            [(ngModel)]="email"
        /></label>
        <label
          >显示名称<input
            name="displayName"
            autocomplete="name"
            required
            maxlength="100"
            [(ngModel)]="displayName"
        /></label>
        <label
          >密码<span class="password-field"
            ><input
              name="password"
              [type]="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              required
              minlength="5"
              maxlength="128"
              [(ngModel)]="password"
            /><button
              type="button"
              (click)="showPassword = !showPassword"
              [attr.aria-label]="showPassword ? '隐藏密码' : '显示密码'"
            >
              {{ showPassword ? '隐藏' : '显示' }}
            </button></span
          ><small>请至少使用 5 个字符。</small></label
        >
        @if (error) {
          <p class="error" role="alert">{{ error }}</p>
        }
        <button class="submit" [disabled]="busy">
          {{ busy ? '正在创建账号…' : '创建账号' }}
        </button>
      </form>
      <p class="switch">
        已经注册？<a routerLink="/split/login" [queryParams]="{ returnUrl }">登录</a>
      </p>
    </nexus-split-auth-shell>
  `,
  styleUrls: ['../split-auth-form.scss'],
})
export class SplitRegisterComponent {
  email = '';
  displayName = '';
  password = '';
  showPassword = false;
  busy = false;
  error = '';
  private readonly auth = inject(SplitAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly returnUrl = safeSplitReturnUrl(
    this.route.snapshot.queryParamMap.get('returnUrl') ?? '/split/groups',
  );

  async submit() {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await firstValueFrom(
        this.auth.register({
          email: this.email,
          displayName: this.displayName,
          password: this.password,
        }),
      );
      await this.router.navigateByUrl(this.returnUrl);
    } catch {
      this.error = '无法创建账号，请检查填写内容后重试。';
    } finally {
      this.busy = false;
    }
  }
}
