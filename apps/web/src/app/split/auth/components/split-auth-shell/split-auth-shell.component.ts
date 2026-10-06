import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'nexus-split-auth-shell',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="auth-page">
      <a routerLink="/" class="brand" aria-label="返回 NEXUS">
        <span>NEXUS</span><strong>SPLIT</strong>
      </a>
      <section class="auth-card"><ng-content /></section>
      <p class="privacy-note">你的 Split 账号独立于简历制作器和麻将系统。</p>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
        background-color: #fbf1d8;
        background-image: linear-gradient(#fff9edc9, #fff9edc9), url('/split/crayon-paper.png');
        background-size:
          auto,
          720px auto;
        color: #40382f;
        font-family: 'Comic Sans MS', 'Trebuchet MS', ui-rounded, system-ui, sans-serif;
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
        transform: rotate(-1deg);
      }
      .brand span {
        font-size: 0.72rem;
        font-weight: 700;
        color: #b9553f;
      }
      .brand strong {
        font-size: 1rem;
        color: #244f3b;
        text-shadow: 1px 1px 0 #e4aa2f;
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
        color: #756858;
        font-size: 0.76rem;
        line-height: 1.5;
        text-align: center;
      }
      @media (min-width: 700px) {
        .auth-card {
          padding: 2.25rem;
          border: 3px solid #6e604f;
          border-radius: 25px 19px 28px 17px;
          background: #fffaf0e8;
          box-shadow: 7px 9px 0 #735f4430;
          transform: rotate(-0.2deg);
        }
      }
    `,
  ],
})
export class SplitAuthShellComponent {}
