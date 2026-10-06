import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SplitAuthShellComponent } from '../../components/split-auth-shell/split-auth-shell.component';
import { SplitAuthService } from '../../data-access/split-auth.service';
import { safeSplitReturnUrl } from '../../guards/split-route-access';

@Component({
  selector: 'nexus-split-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SplitAuthShellComponent],
  template: `
    <nexus-split-auth-shell>
      <header>
        <span>欢迎回来</span>
        <h1>登录 Split</h1>
        <p>继续管理你的共同费用。</p>
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
          >密码<span class="password-field"
            ><input
              name="password"
              [type]="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              [(ngModel)]="password"
            /><button
              type="button"
              (click)="showPassword = !showPassword"
              [attr.aria-label]="showPassword ? '隐藏密码' : '显示密码'"
            >
              {{ showPassword ? '隐藏' : '显示' }}
            </button></span
          ></label
        >
        @if (error) {
          <p class="error" role="alert">{{ error }}</p>
        }
        <button class="submit" [disabled]="busy">{{ busy ? '登录中…' : '登录' }}</button>
      </form>
      <p class="switch">
        第一次使用 Split？
        <a routerLink="/split/register" [queryParams]="{ returnUrl }">创建账号</a>
      </p>
    </nexus-split-auth-shell>
  `,
  styleUrls: ['../split-auth-form.scss'],
})
export class SplitLoginComponent {
  email = '';
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
      await firstValueFrom(this.auth.login({ email: this.email, password: this.password }));
      await this.router.navigateByUrl(this.returnUrl);
    } catch {
      this.error = '邮箱或密码不正确，或账号暂时无法使用。';
    } finally {
      this.busy = false;
    }
  }
}
