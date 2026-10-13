import { Component } from '@angular/core';

@Component({
  selector: 'nexus-split-auth-shell',
  standalone: true,
  template: `
    <main class="auth-page">
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
