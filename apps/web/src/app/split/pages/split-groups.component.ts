import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucidePlus, LucideChevronRight } from '@lucide/angular';
import { SplitGroupsStore } from '../data-access/split-groups.store';
import { splitTypeIcon } from '../data-access/split.models';
@Component({
  selector: 'nexus-split-groups',
  standalone: true,
  imports: [CommonModule, RouterLink, LucidePlus, LucideChevronRight],
  template: `<main class="split-page">
    <div class="split-wrap">
      <header class="split-top">
        <div>
          <p class="eyebrow">NEXUS SPLIT</p>
          <h1>My Groups</h1>
        </div>
        <a class="icon-btn" routerLink="new" aria-label="Create group"><svg lucidePlus></svg></a>
      </header>
      <nav class="tabs" aria-label="Group status">
        <button [class.active]="store.status() === 'active'" (click)="switchTo('active')">
          Active</button
        ><button [class.active]="store.status() === 'archived'" (click)="switchTo('archived')">
          Archived
        </button>
      </nav>
      @if (store.state() === 'loading') {
        <div class="card-grid" aria-label="Loading groups">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
      } @else if (store.state() === 'error') {
        <section class="error">
          <h2>Unable to load your groups.</h2>
          <button class="secondary" (click)="retry()">Try Again</button>
        </section>
      } @else if (!store.groups().length) {
        <section class="empty">
          <h2>{{ store.status() === 'active' ? 'No groups yet' : 'No archived groups' }}</h2>
          <p class="muted">
            {{
              store.status() === 'active'
                ? 'Create a group to start splitting expenses.'
                : 'Archived groups will appear here.'
            }}
          </p>
          @if (store.status() === 'active') {
            <a class="primary icon-btn" routerLink="new">Create Group</a>
          }
        </section>
      } @else {
        <section class="card-grid">
          @for (group of store.groups(); track group.id) {
            <a class="group-card" [routerLink]="[group.id]"
              ><span class="type-icon">{{ icons[group.type] }}</span
              ><span
                ><strong>{{ group.name }}</strong
                ><small class="muted"
                  >{{ group.memberCount }} {{ group.memberCount === 1 ? 'member' : 'members' }}
                  @if (group.startDate) {
                    · {{ group.startDate | date: 'mediumDate' }}
                  }
                </small></span
              ><span
                ><b class="currency">{{ group.baseCurrency }}</b
                ><svg lucideChevronRight></svg></span
            ></a>
          }
        </section>
      }
    </div>
  </main>`,
  styleUrls: ['../ui/split-ui.scss'],
})
export class SplitGroupsComponent implements OnInit {
  readonly store = inject(SplitGroupsStore);
  readonly icons = splitTypeIcon;
  ngOnInit() {
    void this.store.load();
  }
  switchTo(s: 'active' | 'archived') {
    void this.store.load(s);
  }
  retry() {
    void this.store.load(this.store.status(), true);
  }
}
