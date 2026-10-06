import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'nexus-split-auth-shell',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="auth-page">
      <a routerLink="/" class="brand" aria-label="Back to NEXUS">
        <span>NEXUS</span><strong>SPLIT</strong>
      </a>
      <section class="auth-card"><ng-content /></section>
      <p class="privacy-note">Your Split account is independent from Resume Builder and Mahjong.</p>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
        background: #f4f7f8;
        color: #112b2c;
      }
      .auth-page {
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        padding: max(1rem, env(safe-area-inset-top)) 1.25rem max(1rem, env(safe-area-inset-bottom));
      }
      .brand {
        display: inline-flex;
        align-self: flex-start;
        align-items: baseline;
        gap: 0.45rem;
        color: inherit;
        text-decoration: none;
        letter-spacing: 0.12em;
      }
      .brand span {
        font-size: 0.72rem;
        font-weight: 700;
        color: #5f7374;
      }
      .brand strong {
        font-size: 1rem;
      }
      .auth-card {
        width: 100%;
        max-width: 420px;
        margin: auto;
        padding: 2rem 0;
      }
      .privacy-note {
        max-width: 420px;
        margin: 0 auto;
        color: #708283;
        font-size: 0.76rem;
        line-height: 1.5;
        text-align: center;
      }
      @media (min-width: 700px) {
        .auth-card {
          padding: 2.25rem;
          border: 1px solid #dce5e5;
          border-radius: 24px;
          background: #fff;
          box-shadow: 0 24px 60px #16353612;
        }
      }
    `,
  ],
})
export class SplitAuthShellComponent {}
