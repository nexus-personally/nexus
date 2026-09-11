import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { ResumeRecord } from '@nexus/shared';
import { ApiService } from '../../core/api.service';
import { ResumeRendererComponent } from '../renderer/resume-renderer.component';

@Component({
  selector: 'nexus-public-resume',
  standalone: true,
  imports: [CommonModule, ResumeRendererComponent],
  template: `
    <main class="public-shell">
      @if (resume) {
        <nexus-resume-renderer [resume]="resume" />
      } @else {
        <section class="unavailable">
          <h1>Resume unavailable.</h1>
          <p>This resume may have been unpublished or the link is no longer available.</p>
        </section>
      }
    </main>
  `,
  styles: [
    `
      .public-shell {
        min-height: 100vh;
        padding: 2rem;
        background: #f4f7f8;
      }

      .unavailable {
        max-width: 34rem;
        margin: 18vh auto 0;
        color: #171a21;
      }

      .unavailable h1 {
        margin: 0 0 0.5rem;
        font-size: clamp(2rem, 6vw, 4rem);
      }
    `,
  ],
})
export class PublicResumeComponent implements OnInit {
  protected resume?: ResumeRecord;
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.api.getPublicResume(slug).subscribe({
      next: (resume) => {
        this.resume = resume;
      },
      error: () => {
        this.resume = undefined;
      },
    });
  }
}
