import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SplitOfflineNoticeComponent } from './split/ui/split-offline-notice.component';

@Component({
  selector: 'nexus-root',
  standalone: true,
  imports: [RouterOutlet, SplitOfflineNoticeComponent],
  template: '<router-outlet /><nexus-split-offline-notice />',
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.syncPwaMetadata(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.syncPwaMetadata(event.urlAfterRedirects));
  }

  private syncPwaMetadata(url: string): void {
    const path = url.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
    const system =
      path === '/resume' || path.startsWith('/resume/')
        ? {
            manifest: '/resume/manifest.webmanifest',
            icon: '/resume/icon-192.png',
            themeColor: '#263349',
          }
        : path === '/split' || path.startsWith('/split/')
          ? {
              manifest: '/split/manifest.webmanifest',
              icon: '/split/apple-touch-icon.png',
              themeColor: '#fbf1d8',
            }
          : undefined;

    let manifest = this.document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (system) {
      if (!manifest) {
        manifest = this.document.createElement('link');
        manifest.rel = 'manifest';
        this.document.head.append(manifest);
      }
      manifest.href = system.manifest;
      this.document
        .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.setAttribute('content', system.themeColor);

      let appleIcon = this.document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (!appleIcon) {
        appleIcon = this.document.createElement('link');
        appleIcon.rel = 'apple-touch-icon';
        this.document.head.append(appleIcon);
      }
      appleIcon.href = system.icon;
    } else {
      manifest?.remove();
      this.document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.remove();
    }
  }
}
