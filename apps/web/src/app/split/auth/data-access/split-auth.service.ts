import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, tap } from 'rxjs';
import { SplitAuthApiService } from './split-auth-api.service';
import type { SplitAuthResponse, SplitAuthState } from './split-auth.models';
import { SplitCsrfStore } from './split-csrf.store';

@Injectable({ providedIn: 'root' })
export class SplitAuthService {
  private readonly api = inject(SplitAuthApiService);
  private readonly csrf = inject(SplitCsrfStore);
  private readonly stateSignal = signal<SplitAuthState>({ status: 'restoring', user: null });
  private restoration?: Promise<void>;

  readonly state = this.stateSignal.asReadonly();
  readonly currentUser = computed(() => this.stateSignal().user);
  readonly isAuthenticated = computed(() => this.stateSignal().status === 'authenticated');

  restoreSession() {
    if (this.stateSignal().status !== 'restoring') return Promise.resolve();
    if (!this.restoration) {
      this.restoration = firstValueFrom(this.api.me())
        .then((result) => this.accept(result))
        .catch(() => this.clear());
    }
    return this.restoration;
  }

  register(input: { email: string; displayName: string; password: string }) {
    return this.api.register(input).pipe(tap((result) => this.accept(result)));
  }

  login(input: { email: string; password: string }) {
    return this.api.login(input).pipe(tap((result) => this.accept(result)));
  }

  async logout() {
    try {
      await firstValueFrom(this.api.logout());
    } finally {
      this.clear();
    }
  }

  private accept(result: SplitAuthResponse) {
    this.csrf.set(result.csrfToken);
    this.stateSignal.set({ status: 'authenticated', user: result.user });
  }

  private clear() {
    this.csrf.clear();
    this.stateSignal.set({ status: 'anonymous', user: null });
  }
}
