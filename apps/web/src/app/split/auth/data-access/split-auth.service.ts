import { Injectable, computed, inject, signal } from '@angular/core';
import { concatMap, firstValueFrom, from, map } from 'rxjs';
import { SplitAuthApiService } from './split-auth-api.service';
import type { SplitAuthResponse, SplitAuthState } from './split-auth.models';
import { SplitCsrfStore } from './split-csrf.store';
import { SplitOfflineCacheService } from '../../data-access/split-offline-cache.service';
import { SplitApiService } from '../../data-access/split-api.service';

@Injectable({ providedIn: 'root' })
export class SplitAuthService {
  private readonly api = inject(SplitAuthApiService);
  private readonly csrf = inject(SplitCsrfStore);
  private readonly offlineCache = inject(SplitOfflineCacheService);
  private readonly splitApi = inject(SplitApiService);
  private readonly stateSignal = signal<SplitAuthState>({ status: 'restoring', user: null });
  private restoration?: Promise<void>;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.stateSignal().status === 'offline-authenticated') {
          void this.validateRestoredSession();
        }
      });
    }
  }

  readonly state = this.stateSignal.asReadonly();
  readonly currentUser = computed(() => this.stateSignal().user);
  readonly isAuthenticated = computed(() =>
    ['authenticated', 'offline-authenticated'].includes(this.stateSignal().status),
  );
  readonly isOfflineAuthenticated = computed(
    () => this.stateSignal().status === 'offline-authenticated',
  );

  restoreSession() {
    if (this.stateSignal().status !== 'restoring') return Promise.resolve();
    if (!this.restoration) {
      this.restoration = firstValueFrom(this.api.me())
        .then((result) => this.accept(result))
        .catch(async () => {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            const user = await this.offlineCache.restoreLastUser();
            if (user) {
              this.stateSignal.set({ status: 'offline-authenticated', user });
              return;
            }
          }
          await this.clear();
        });
    }
    return this.restoration;
  }

  register(input: { username: string; displayName: string; password: string }) {
    return this.api
      .register(input)
      .pipe(concatMap((result) => from(this.accept(result)).pipe(map(() => result))));
  }

  login(input: { username: string; password: string }) {
    return this.api
      .login(input)
      .pipe(concatMap((result) => from(this.accept(result)).pipe(map(() => result))));
  }

  async logout() {
    try {
      await firstValueFrom(this.api.logout());
    } finally {
      await this.clear();
    }
  }

  updateProfile(input: { displayName: string } | { monthlyBudgetMinor: number }) {
    return this.api.updateProfile(input).pipe(
      concatMap((user) =>
        from(
          Promise.all([
            this.offlineCache.activateUser(user),
            ...('monthlyBudgetMinor' in input ? [this.offlineCache.invalidate('/dashboard')] : []),
          ]),
        ).pipe(
          map(() => {
            this.stateSignal.set({ status: 'authenticated', user });
            return user;
          }),
        ),
      ),
    );
  }

  updatePassword(password: string) {
    return this.api.updatePassword(password);
  }

  private async accept(result: SplitAuthResponse) {
    await this.offlineCache.activateUser(result.user);
    this.csrf.set(result.csrfToken);
    this.stateSignal.set({ status: 'authenticated', user: result.user });
    this.preloadHomeData();
  }

  private preloadHomeData() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Warm the two screens people use most after login. These are deliberately
    // fire-and-forget; navigation must not wait for either API response.
    void firstValueFrom(this.splitApi.dashboard(month)).catch(() => undefined);
    void firstValueFrom(this.splitApi.groups('active')).catch(() => undefined);
  }

  private async validateRestoredSession() {
    try {
      this.accept(await firstValueFrom(this.api.me()));
    } catch {
      await this.clear();
    }
  }

  private async clear() {
    this.csrf.clear();
    this.stateSignal.set({ status: 'anonymous', user: null });
    await this.offlineCache.clear();
  }
}
