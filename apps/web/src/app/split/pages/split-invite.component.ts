import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SplitAuthService } from '../auth/data-access/split-auth.service';
import { SplitApiService } from '../data-access/split-api.service';
import {
  inviteReturnUrl,
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
          <a class="secondary icon-btn" routerLink="/split">Back to NEXUS Split</a>
        </section>
      } @else if (preview) {
        <section class="empty">
          <p class="eyebrow">NEXUS SPLIT</p>
          <span class="type-icon">{{ icons[preview.groupType] }}</span>
          <h1>You've been invited</h1>
          <h2>{{ preview.groupName }}</h2>
          <p class="muted">{{ preview.groupType | titlecase }}</p>
          @if (preview.targetDisplayName) {
            <p>
              <strong>{{ preview.targetDisplayName }}</strong
              >, this place is waiting for you.
            </p>
          }
          @if (joined) {
            <p class="notice">You've joined {{ preview.groupName }} ✓</p>
          } @else if (auth.isAuthenticated()) {
            <button class="primary full" [disabled]="busy" (click)="join()">
              {{ busy ? 'Joining…' : 'Join Group' }}
            </button>
          } @else {
            <a class="primary icon-btn full" [routerLink]="loginUrl">Join Group</a>
            <p>
              New here?
              <a routerLink="/split/register" [queryParams]="{ returnUrl: invitePath }"
                >Create an account</a
              >
            </p>
            <p>Already have an account? <a [routerLink]="loginUrl">Sign in</a></p>
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
  message = 'Invite not found';
  busy = false;
  joined = false;
  get invitePath() {
    return `/split/invite/${this.token}`;
  }
  get loginUrl() {
    return inviteReturnUrl(this.token);
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
          SPLIT_INVITE_EXPIRED: 'Invite expired',
          SPLIT_INVITE_REVOKED: 'Invite revoked',
          SPLIT_INVITE_ALREADY_CLAIMED: 'Invite already used',
          SPLIT_MEMBER_ALREADY_EXISTS: 'Already a member',
        } as Record<string, string>
      )[code] ?? 'Invite not found'
    );
  }
}
