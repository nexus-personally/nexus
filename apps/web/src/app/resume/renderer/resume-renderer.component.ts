import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ResumeRecord, ResumeSection } from '@nexus/shared';
import { RESUME_THEMES } from '@nexus/shared';

@Component({
  selector: 'nexus-resume-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (resume) {
      <article class="sheet" [class]="resume.templateId" [style.--accent]="accent">
        <header class="identity">
          <div>
            <h1>{{ resume.content.profile.fullName }}</h1>
            <p>{{ resume.content.profile.headline }}</p>
          </div>
          <address>
            <span>{{ resume.content.profile.email }}</span>
            <span>{{ resume.content.profile.phone }}</span>
            <span>{{ resume.content.profile.location }}</span>
            @if (resume.content.profile.github) {
              <span>{{ resume.content.profile.github }}</span>
            }
          </address>
        </header>

        @for (section of orderedSections; track section.id) {
          @if (!section.hidden) {
            <section class="resume-section">
              <h2>{{ section.title }}</h2>

              @switch (section.type) {
                @case ('summary') {
                  <p class="summary">{{ section.body }}</p>
                }
                @case ('experience') {
                  @for (item of section.items; track item.id) {
                    <div class="block">
                      <h3>{{ item.company }} <span>{{ item.location }}</span></h3>
                      @for (position of item.positions; track position.id) {
                        <div class="position">
                          <strong>{{ position.title }}</strong>
                          <em>{{ position.startDate }} - {{ position.endDate }}</em>
                          <ul>
                            @for (bullet of position.bullets; track bullet) {
                              <li>{{ bullet }}</li>
                            }
                          </ul>
                        </div>
                      }
                    </div>
                  }
                }
                @case ('projects') {
                  @for (project of section.items; track project.id) {
                    <div class="block">
                      <h3>{{ project.name }} <span>{{ project.dates }}</span></h3>
                      <p>{{ project.role }} - {{ project.description }}</p>
                      <p class="chips">{{ project.technologies.join(' / ') }}</p>
                    </div>
                  }
                }
                @case ('skills') {
                  <div class="skill-grid">
                    @for (group of section.groups; track group.id) {
                      <p><strong>{{ group.name }}</strong> {{ group.skills.join(', ') }}</p>
                    }
                  </div>
                }
                @default {
                  <ul>
                    @for (item of section.items; track item) {
                      <li>{{ item }}</li>
                    }
                  </ul>
                }
              }
            </section>
          }
        }
      </article>
    }
  `,
  styles: [
    `
      .sheet {
        --accent: #0f9fb8;
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 18mm;
        background: #fffdf9;
        color: #24262c;
        box-shadow: 0 24px 80px rgba(4, 7, 13, 0.24);
        font-family: Inter, Arial, sans-serif;
      }

      .identity {
        display: grid;
        grid-template-columns: 1.4fr 1fr;
        gap: 1rem;
        border-bottom: 3px solid var(--accent);
        padding-bottom: 0.8rem;
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      h1 {
        font-size: 2.2rem;
        line-height: 1;
      }

      .identity p {
        margin-top: 0.3rem;
        color: var(--accent);
        font-weight: 700;
      }

      address {
        display: grid;
        gap: 0.2rem;
        font-style: normal;
        font-size: 0.78rem;
        text-align: right;
      }

      .resume-section {
        margin-top: 1rem;
        break-inside: avoid;
      }

      h2 {
        color: var(--accent);
        font-size: 0.82rem;
        text-transform: uppercase;
        border-bottom: 1px solid #d9dde4;
        padding-bottom: 0.2rem;
      }

      h3 {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        font-size: 0.98rem;
        margin-top: 0.55rem;
      }

      h3 span,
      em {
        color: #666f7a;
        font-size: 0.78rem;
        font-style: normal;
        font-weight: 500;
      }

      .summary,
      li,
      .block p,
      .skill-grid p {
        font-size: 0.86rem;
        line-height: 1.45;
      }

      ul {
        margin: 0.25rem 0 0;
        padding-left: 1.1rem;
      }

      .position {
        margin-top: 0.25rem;
      }

      .position strong {
        display: inline-block;
        margin-right: 0.5rem;
      }

      .chips {
        color: var(--accent);
        font-weight: 700;
      }

      .tech-modern,
      .tech-creative {
        border-left: 12mm solid color-mix(in srgb, var(--accent), white 45%);
      }

      .tech-minimal {
        box-shadow: 0 12px 48px rgba(28, 32, 38, 0.16);
      }

      .tech-executive h1 {
        font-family: Georgia, serif;
      }

      @media (max-width: 900px) {
        .sheet {
          width: min(100%, 210mm);
          min-height: auto;
          padding: 1.2rem;
        }

        .identity {
          grid-template-columns: 1fr;
        }

        address {
          text-align: left;
        }
      }
    `,
  ],
})
export class ResumeRendererComponent {
  @Input({ required: true }) resume?: ResumeRecord;

  get accent() {
    return RESUME_THEMES.find((theme) => theme.id === this.resume?.themeId)?.accent ?? '#0f9fb8';
  }

  get orderedSections(): ResumeSection[] {
    if (!this.resume) {
      return [];
    }

    const byId = new Map(this.resume.content.sections.map((section) => [section.id, section]));
    return this.resume.sectionOrder.flatMap((id) => {
      const section = byId.get(id);
      return section ? [section] : [];
    });
  }
}
