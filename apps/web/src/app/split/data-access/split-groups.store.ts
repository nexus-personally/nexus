import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SplitApiService } from './split-api.service';
import type { SplitGroup } from './split.models';
@Injectable({ providedIn: 'root' })
export class SplitGroupsStore {
  private readonly api = inject(SplitApiService);
  private readonly cache = new Map<'active' | 'archived', SplitGroup[]>();
  readonly groups = signal<SplitGroup[]>([]);
  readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly status = signal<'active' | 'archived'>('active');
  async load(status = this.status(), force = false) {
    this.status.set(status);
    if (!force && this.cache.has(status)) {
      this.groups.set(this.cache.get(status)!);
      this.state.set('ready');
      return;
    }
    this.state.set('loading');
    try {
      const groups = await firstValueFrom(this.api.groups(status));
      this.cache.set(status, groups);
      this.groups.set(groups);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
  invalidate() {
    this.cache.clear();
  }
}
