import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SplitAuthService } from '../auth/data-access/split-auth.service';
import { SplitApiService } from '../data-access/split-api.service';
import {
  inviteReturnUrl,
  splitTypes,
  splitTypeIcon,
  type SplitInvitePreview,
} from '../data-access/split.models';
@Component({
  selector: 'nexus-split-invite',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `<main class="split-page">
    <div class="split-wrap">
      @if (state === 'loading') {
        <div class="skeleton"></div>
      } @else if (state === 'invalid') {
        <section class="empty">
          <p class="eyebrow">NEXUS SPLIT</p>
          <h1>{{ message }}</h1>
          <a class="secondary icon-btn" routerLink="/split">返回 NEXUS Split</a>
        </section>
      } @else if (preview) {
        <section class="empty">
          <p class="eyebrow">NEXUS SPLIT</p>
          <span class="type-icon">{{ icons[preview.groupType] }}</span>
          <h1>你收到了群组邀请</h1>
          <h2>{{ preview.groupName }}</h2>
          <p class="muted">{{ groupTypeLabel(preview.groupType) }}</p>
          @if (preview.targetDisplayName) {
            <p>
              <strong>{{ preview.targetDisplayName }}</strong
              >，这个位置正在等你加入。
            </p>
          }
          @if (joined) {
            <p class="notice">你已加入 {{ preview.groupName }} ✓</p>
          } @else if (auth.isAuthenticated()) {
            <button class="primary full" [disabled]="busy" (click)="join()">
              {{ busy ? '加入中…' : '加入群组' }}
            </button>
          } @else {
            <a class="primary icon-btn full" [routerLink]="loginUrl">加入群组</a>
            <p>
              第一次使用？
              <a routerLink="/split/register" [queryParams]="{ returnUrl: invitePath }">创建账号</a>
            </p>
            <p>已经有账号？<a [routerLink]="loginUrl">登录</a></p>
          }
        </section>
      }
    </div>
  </main>`,
  styleUrls: ['../ui/split-ui.scss'],
})
export class SplitInviteComponent implements OnInit {
  private api = inject(SplitApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly auth = inject(SplitAuthService);
  readonly icons = splitTypeIcon;
  token = '';
  preview?: SplitInvitePreview;
  state: 'loading' | 'ready' | 'invalid' = 'loading';
  message = '找不到邀请';
  busy = false;
  joined = false;
  get invitePath() {
    return `/split/invite/${this.token}`;
  }
  get loginUrl() {
    return inviteReturnUrl(this.token);
  }
  groupTypeLabel(type: SplitInvitePreview['groupType']) {
    return splitTypes.find(([value]) => value === type)?.[1] ?? '其他';
  }
  async ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token')!;
    await this.auth.restoreSession();
    try {
      this.preview = await firstValueFrom(this.api.previewInvite(this.token));
      this.state = 'ready';
    } catch (e) {
      this.state = 'invalid';
      this.message = this.errorMessage(e);
    }
  }
  async join() {
    this.busy = true;
    try {
      const result = await firstValueFrom(this.api.claimInvite(this.token));
      this.joined = true;
      setTimeout(() => void this.router.navigateByUrl(`/split/groups/${result.groupId}`), 800);
    } catch (e) {
      this.state = 'invalid';
      this.message = this.errorMessage(e);
    } finally {
      this.busy = false;
    }
  }
  private errorMessage(e: unknown) {
    const code = e instanceof HttpErrorResponse ? e.error?.error?.code : '';
    return (
      (
        {
          SPLIT_INVITE_EXPIRED: '邀请已过期',
          SPLIT_INVITE_REVOKED: '邀请已撤销',
          SPLIT_INVITE_ALREADY_CLAIMED: '邀请已被使用',
          SPLIT_MEMBER_ALREADY_EXISTS: '你已经是群组成员',
        } as Record<string, string>
      )[code] ?? '找不到邀请'
    );
  }
}
