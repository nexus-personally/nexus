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
  selector: 'nexus-split-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SplitAuthShellComponent],
  template: `
    <nexus-split-auth-shell>
      <header>
        <span>GET STARTED</span>
        <h1>Create your Split account</h1>
        <p>This account belongs only to NEXUS Split.</p>
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
          >Display name<input
            name="displayName"
            autocomplete="name"
            required
            maxlength="100"
            [(ngModel)]="displayName"
        /></label>
        <label
          >Password<span class="password-field"
            ><input
              name="password"
              [type]="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              required
              minlength="12"
              maxlength="128"
              [(ngModel)]="password"
            /><button
              type="button"
              (click)="showPassword = !showPassword"
              [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
            >
              {{ showPassword ? 'Hide' : 'Show' }}
            </button></span
          ><small>Use at least 12 characters.</small></label
        >
        @if (error) {
          <p class="error" role="alert">{{ error }}</p>
        }
        <button class="submit" [disabled]="busy">
          {{ busy ? 'Creating account…' : 'Create account' }}
        </button>
      </form>
      <p class="switch">
        Already registered? <a routerLink="/split/login" [queryParams]="{ returnUrl }">Sign in</a>
      </p>
    </nexus-split-auth-shell>
  `,
  styleUrls: ['../split-auth-form.scss'],
})
export class SplitRegisterComponent {
  email = '';
  displayName = '';
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
      await firstValueFrom(
        this.auth.register({
          email: this.email,
          displayName: this.displayName,
          password: this.password,
        }),
      );
      await this.router.navigateByUrl(this.returnUrl);
    } catch (error) {
      this.error =
        error instanceof HttpErrorResponse
          ? (error.error?.error?.message ?? 'Unable to create the account.')
          : 'Unable to create the account.';
    } finally {
      this.busy = false;
    }
  }
}
