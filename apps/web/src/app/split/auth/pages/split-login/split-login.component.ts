import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SplitAuthShellComponent } from '../../components/split-auth-shell/split-auth-shell.component';
import { SplitAuthService } from '../../data-access/split-auth.service';
import { safeSplitReturnUrl } from '../../guards/split-route-access';

@Component({
  selector: 'nexus-split-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SplitAuthShellComponent],
  template: `
    <nexus-split-auth-shell>
      <header>
        <span>WELCOME BACK</span>
        <h1>Sign in to Split</h1>
        <p>Continue to your shared expenses.</p>
      </header>
      <form (ngSubmit)="submit()" novalidate>
        <label
          >Email<input
            name="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            required
            [(ngModel)]="email"
        /></label>
        <label
          >Password<span class="password-field"
            ><input
              name="password"
              [type]="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              [(ngModel)]="password"
            /><button
              type="button"
              (click)="showPassword = !showPassword"
              [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
            >
              {{ showPassword ? 'Hide' : 'Show' }}
            </button></span
          ></label
        >
        @if (error) {
          <p class="error" role="alert">{{ error }}</p>
        }
        <button class="submit" [disabled]="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</button>
      </form>
      <p class="switch">
        New to Split?
        <a routerLink="/split/register" [queryParams]="{ returnUrl }">Create an account</a>
      </p>
    </nexus-split-auth-shell>
  `,
  styleUrls: ['../split-auth-form.scss'],
})
export class SplitLoginComponent {
  email = '';
  password = '';
  showPassword = false;
  busy = false;
  error = '';
  private readonly auth = inject(SplitAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly returnUrl = safeSplitReturnUrl(
    this.route.snapshot.queryParamMap.get('returnUrl') ?? '/split/groups',
  );

  async submit() {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await firstValueFrom(this.auth.login({ email: this.email, password: this.password }));
      await this.router.navigateByUrl(this.returnUrl);
    } catch (error) {
      this.error =
        error instanceof HttpErrorResponse
          ? (error.error?.error?.message ?? 'Unable to sign in.')
          : 'Unable to sign in.';
    } finally {
      this.busy = false;
    }
  }
}
