import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucidePlus, LucideChevronRight } from '@lucide/angular';
import { SplitGroupsStore } from '../data-access/split-groups.store';
import { splitTypeIcon } from '../data-access/split.models';
import { SplitDatePipe } from '../ui/split-date.pipe';
@Component({
  selector: 'nexus-split-groups',
  standalone: true,
  imports: [CommonModule, RouterLink, LucidePlus, LucideChevronRight, SplitDatePipe],
  template: `<main class="split-page">
    <div class="split-wrap">
      <header class="split-top">
        <div>
          <p class="eyebrow">NEXUS SPLIT</p>
          <h1>我的群组</h1>
        </div>
        <a class="icon-btn" routerLink="new" aria-label="创建群组"><svg lucidePlus></svg></a>
      </header>
      <nav class="tabs" aria-label="群组状态">
        <button [class.active]="store.status() === 'active'" (click)="switchTo('active')">
          使用中</button
        ><button [class.active]="store.status() === 'archived'" (click)="switchTo('archived')">
          已归档
        </button>
      </nav>
      @if (store.state() === 'loading') {
        <div class="card-grid" aria-label="正在加载群组">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
      } @else if (store.state() === 'error') {
        <section class="error">
          <h2>无法加载群组。</h2>
          <button class="secondary" (click)="retry()">重试</button>
        </section>
      } @else if (!store.groups().length) {
        <section class="empty">
          <h2>{{ store.status() === 'active' ? '还没有群组' : '没有已归档群组' }}</h2>
          <p class="muted">
            {{
              store.status() === 'active'
                ? '创建群组，开始一起分摊费用。'
                : '已归档的群组会显示在这里。'
            }}
          </p>
          @if (store.status() === 'active') {
            <a class="primary icon-btn" routerLink="new">创建群组</a>
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
                  >{{ group.memberCount }} 位成员
                  @if (group.startDate) {
                    · {{ group.startDate | splitDate }}
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
