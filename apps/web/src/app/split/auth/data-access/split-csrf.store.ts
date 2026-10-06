import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SplitCsrfStore {
  private readonly valueSignal = signal<string | null>(null);
  readonly value = this.valueSignal.asReadonly();

  set(value: string) {
    this.valueSignal.set(value);
  }

  clear() {
    this.valueSignal.set(null);
  }
}
