import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SplitApiService } from './split-api.service';
import type { SplitGroup } from './split.models';
@Injectable({ providedIn: 'root' })
export class SplitGroupsStore {
  private readonly api = inject(SplitApiService);
  private readonly cache = new Map<'active' | 'archived', SplitGroup[]>();
  private readonly cachedAt = new Map<'active' | 'archived', number>();
  readonly groups = signal<SplitGroup[]>([]);
  readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly status = signal<'active' | 'archived'>('active');
  async load(status = this.status(), force = false) {
    this.status.set(status);
    const cached = this.cache.get(status);
    if (!force && cached && Date.now() - (this.cachedAt.get(status) ?? 0) < 30_000) {
      this.groups.set(cached);
      this.state.set('ready');
      return;
    }
    if (cached) {
      this.groups.set(cached);
      this.state.set('ready');
    } else {
      this.state.set('loading');
    }
    try {
      const groups = await firstValueFrom(this.api.groups(status, force));
      this.cache.set(status, groups);
      this.cachedAt.set(status, Date.now());
      this.groups.set(groups);
      this.state.set('ready');
    } catch {
      this.state.set(cached ? 'ready' : 'error');
    }
  }
  invalidate() {
    this.cache.clear();
    this.cachedAt.clear();
  }
}
