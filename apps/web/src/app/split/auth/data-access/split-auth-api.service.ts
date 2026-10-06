import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { SplitAuthResponse } from './split-auth.models';

@Injectable({ providedIn: 'root' })
export class SplitAuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/split/auth';

  register(input: { email: string; displayName: string; password: string }) {
    return this.http.post<SplitAuthResponse>(`${this.base}/register`, input);
  }

  login(input: { email: string; password: string }) {
    return this.http.post<SplitAuthResponse>(`${this.base}/login`, input);
  }

  logout() {
    return this.http.post<void>(`${this.base}/logout`, {});
  }

  me() {
    return this.http.get<SplitAuthResponse>(`${this.base}/me`);
  }
}
