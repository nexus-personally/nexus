import { Component, inject } from '@angular/core';
import { SplitAuthService } from '../auth/data-access/split-auth.service';
import { SplitOfflineCacheService } from '../data-access/split-offline-cache.service';

@Component({
  selector: 'nexus-split-offline-notice',
  standalone: true,
  template: `@if (auth.isAuthenticated() && (cache.offline() || cache.showingSavedData())) {
    <aside role="status">
      {{ cache.offline() ? '离线浏览' : '连接中断' }} · 当前显示本机已保存资料，只能查看
    </aside>
  }`,
  styles: [
    `
      aside {
        position: fixed;
        z-index: 80;
        top: max(8px, env(safe-area-inset-top));
        left: 50%;
        transform: translateX(-50%);
        max-width: calc(100vw - 32px);
        padding: 7px 12px;
        border: 1px solid #7b5a1e;
        border-radius: 999px;
        background: #f1c75f;
        color: #40382f;
        box-shadow: 2px 3px 0 #735f4440;
        font:
          700 12px/1.3 'Comic Sans MS',
          'Trebuchet MS',
          ui-rounded,
          system-ui,
          sans-serif;
        text-align: center;
      }
    `,
  ],
})
export class SplitOfflineNoticeComponent {
  readonly auth = inject(SplitAuthService);
  readonly cache = inject(SplitOfflineCacheService);
}
