import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucidePlus } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { SplitApiService } from '../data-access/split-api.service';
import { SplitAuthService } from '../auth/data-access/split-auth.service';
import {
  activeMembers,
  type SplitGroup,
  type SplitInviteCreated,
  type SplitMember,
} from '../data-access/split.models';
import { SplitBottomSheetComponent } from '../ui/split-bottom-sheet.component';
@Component({
  selector: 'nexus-split-members',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideArrowLeft,
    LucidePlus,
    SplitBottomSheetComponent,
  ],
  template: `<main class="split-page">
      <div class="split-wrap">
        <header class="split-top">
          <a class="back" [routerLink]="['../']"><svg lucideArrowLeft></svg></a
          ><strong>{{ group?.name || 'Members' }}</strong>
          @if (owner) {
            <button class="icon-btn" (click)="sheet = 'actions'" aria-label="Add member">
              <svg lucidePlus></svg>
            </button>
          } @else {
            <span></span>
          }
        </header>
        <h1>Members</h1>
        @for (member of members; track member.id) {
          <article class="member-row">
            <span class="avatar">{{ initial(member.displayName) }}</span
            ><span class="member-copy"
              ><strong>{{ member.displayName }}</strong
              ><small class="badge">{{
                member.role === 'owner' ? 'OWNER' : member.userId ? 'MEMBER' : 'GUEST'
              }}</small></span
            >
            @if (owner && !member.userId) {
              <button class="text-btn" (click)="invite(member)">Invite</button>
            }
          </article>
        }
      </div>
    </main>
    @if (sheet === 'actions') {
      <nexus-split-bottom-sheet label="Add member" (closed)="sheet = null"
        ><h2>Add Member</h2>
        <button class="sheet-option" (click)="sheet = 'guest'">Create Guest</button
        ><button class="sheet-option" (click)="invite()">Invite Someone</button
        ><button class="sheet-option" (click)="sheet = null">
          Cancel
        </button></nexus-split-bottom-sheet
      >
    }
    @if (sheet === 'guest') {
      <nexus-split-bottom-sheet label="Create guest" (closed)="sheet = null"
        ><h2>Create Guest</h2>
        <label class="field"
          >Name<input [(ngModel)]="guestName" name="guest" maxlength="100" /></label
        ><button
          class="primary full"
          [disabled]="!guestName.trim() || busy"
          (click)="createGuest()"
        >
          Add Guest
        </button></nexus-split-bottom-sheet
      >
    }
    @if (sheet === 'invite' && createdInvite) {
      <nexus-split-bottom-sheet label="Invite link" (closed)="clearInvite()"
        ><h2>Invite to {{ group?.name }}</h2>
        <p class="share-link">{{ inviteUrl }}</p>
        <button class="primary full" (click)="copy()">Copy Link</button
        ><button class="secondary full" (click)="share()">Share</button></nexus-split-bottom-sheet
      >
    }
    @if (toast) {
      <p class="toast">{{ toast }}</p>
    }`,
  styleUrls: ['../ui/split-ui.scss'],
})
export class SplitMembersComponent implements OnInit {
  private api = inject(SplitApiService);
  private auth = inject(SplitAuthService);
  private route = inject(ActivatedRoute);
  id = '';
  group?: SplitGroup;
  members: SplitMember[] = [];
  owner = false;
  sheet: null | 'actions' | 'guest' | 'invite' = null;
  guestName = '';
  busy = false;
  createdInvite?: SplitInviteCreated;
  toast = '';
  get inviteUrl() {
    return `${location.origin}/split/invite/${this.createdInvite?.token ?? ''}`;
  }
  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('groupId')!;
    void this.load();
  }
  async load() {
    const [g, m] = await Promise.all([
      firstValueFrom(this.api.group(this.id)),
      firstValueFrom(this.api.members(this.id)),
    ]);
    this.group = g;
    this.members = activeMembers(m);
    this.owner =
      this.members.some((x) => x.role === 'owner' && x.userId === this.auth.currentUser()?.id) ||
      g.currentUserRole === 'owner';
  }
  initial(n: string) {
    return n.trim().charAt(0).toUpperCase();
  }
  async createGuest() {
    this.busy = true;
    await firstValueFrom(this.api.createGuest(this.id, this.guestName.trim()));
    this.busy = false;
    this.sheet = null;
    this.guestName = '';
    this.toast = 'Guest added';
    await this.load();
    setTimeout(() => (this.toast = ''), 1800);
  }
  async invite(member?: SplitMember) {
    this.createdInvite = await firstValueFrom(this.api.createInvite(this.id, member?.id));
    this.sheet = 'invite';
  }
  clearInvite() {
    this.createdInvite = undefined;
    this.sheet = null;
  }
  async copy() {
    await navigator.clipboard.writeText(this.inviteUrl);
    this.toast = 'Link copied';
  }
  async share() {
    if (navigator.share)
      await navigator.share({ title: `Invite to ${this.group?.name}`, url: this.inviteUrl });
    else await this.copy();
  }
}
