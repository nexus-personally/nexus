import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { ResumeRecord, ResumeSection } from '@nexus/shared';
import { RESUME_THEMES } from '@nexus/shared';

@Component({
  selector: 'nexus-resume-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (resume) {
      <article
        class="sheet"
        [class]="resume.templateId"
        [class.is-editable]="editable"
        [style.--accent]="accent"
      >
        <header class="identity">
          <div class="identity-main">
            <h1
              [attr.contenteditable]="editable ? 'true' : null"
              [attr.tabindex]="editable ? 0 : null"
              (keydown.enter)="singleLine($event)"
              (blur)="editField(resume.content.profile, 'fullName', $event)"
            >
              {{ resume.content.profile.fullName }}
            </h1>
            <p
              [attr.contenteditable]="editable ? 'true' : null"
              [attr.tabindex]="editable ? 0 : null"
              (keydown.enter)="singleLine($event)"
              (blur)="editField(resume.content.profile, 'headline', $event)"
            >
              {{ resume.content.profile.headline }}
            </p>
          </div>
          <address>
            <span
              [attr.contenteditable]="editable ? 'true' : null"
              (keydown.enter)="singleLine($event)"
              (blur)="editField(resume.content.profile, 'email', $event)"
              >{{ resume.content.profile.email }}</span
            >
            <span
              [attr.contenteditable]="editable ? 'true' : null"
              (keydown.enter)="singleLine($event)"
              (blur)="editField(resume.content.profile, 'phone', $event)"
              >{{ resume.content.profile.phone }}</span
            >
            <span
              [attr.contenteditable]="editable ? 'true' : null"
              (keydown.enter)="singleLine($event)"
              (blur)="editField(resume.content.profile, 'location', $event)"
              >{{ resume.content.profile.location }}</span
            >
            @if (resume.content.profile.github) {
              <span
                [attr.contenteditable]="editable ? 'true' : null"
                (keydown.enter)="singleLine($event)"
                (blur)="editField(resume.content.profile, 'github', $event)"
                >{{ resume.content.profile.github }}</span
              >
            }
          </address>
        </header>

        <div class="resume-body">
          @for (section of orderedSections; track section.id) {
            @if (!section.hidden) {
              <section class="resume-section" [attr.data-section]="section.type">
                <h2
                  [attr.contenteditable]="editable ? 'true' : null"
                  (keydown.enter)="singleLine($event)"
                  (blur)="editField(section, 'title', $event)"
                >
                  {{ section.title }}
                </h2>

                @switch (section.type) {
                  @case ('summary') {
                    <p
                      class="summary"
                      [attr.contenteditable]="editable ? 'true' : null"
                      (blur)="editField(section, 'body', $event)"
                    >
                      {{ section.body }}
                    </p>
                  }
                  @case ('experience') {
                    @for (item of section.items; track item.id) {
                      <div class="block experience-block">
                        <h3>
                          <span
                            class="primary-field"
                            [attr.contenteditable]="editable ? 'true' : null"
                            (keydown.enter)="singleLine($event)"
                            (blur)="editField(item, 'company', $event)"
                            >{{ item.company }}</span
                          >
                          <span
                            [attr.contenteditable]="editable ? 'true' : null"
                            (keydown.enter)="singleLine($event)"
                            (blur)="editField(item, 'location', $event)"
                            >{{ item.location }}</span
                          >
                        </h3>
                        @for (position of item.positions; track position.id) {
                          <div class="position">
                            <div class="position-line">
                              <strong
                                [attr.contenteditable]="editable ? 'true' : null"
                                (keydown.enter)="singleLine($event)"
                                (blur)="editField(position, 'title', $event)"
                                >{{ position.title }}</strong
                              >
                              <em>
                                <span
                                  [attr.contenteditable]="editable ? 'true' : null"
                                  (keydown.enter)="singleLine($event)"
                                  (blur)="editField(position, 'startDate', $event)"
                                  >{{ position.startDate }}</span
                                >
                                -
                                <span
                                  [attr.contenteditable]="editable ? 'true' : null"
                                  (keydown.enter)="singleLine($event)"
                                  (blur)="editField(position, 'endDate', $event)"
                                  >{{ position.endDate }}</span
                                >
                              </em>
                            </div>
                            <ul>
                              @for (bullet of position.bullets; track $index) {
                                <li
                                  [attr.contenteditable]="editable ? 'true' : null"
                                  (blur)="editArrayItem(position.bullets, $index, $event)"
                                >
                                  {{ bullet }}
                                </li>
                              }
                            </ul>
                          </div>
                        }
                      </div>
                    }
                  }
                  @case ('education') {
                    @for (item of section.items; track item.id) {
                      <div class="block education-block">
                        <h3>
                          <span
                            class="primary-field"
                            [attr.contenteditable]="editable ? 'true' : null"
                            (keydown.enter)="singleLine($event)"
                            (blur)="editField(item, 'school', $event)"
                            >{{ item.school }}</span
                          >
                          <span
                            [attr.contenteditable]="editable ? 'true' : null"
                            (keydown.enter)="singleLine($event)"
                            (blur)="editField(item, 'dates', $event)"
                            >{{ item.dates }}</span
                          >
                        </h3>
                        <p>
                          <span
                            [attr.contenteditable]="editable ? 'true' : null"
                            (keydown.enter)="singleLine($event)"
                            (blur)="editField(item, 'degree', $event)"
                            >{{ item.degree }}</span
                          >
                          ·
                          <span
                            [attr.contenteditable]="editable ? 'true' : null"
                            (keydown.enter)="singleLine($event)"
                            (blur)="editField(item, 'location', $event)"
                            >{{ item.location }}</span
                          >
                        </p>
                      </div>
                    }
                  }
                  @case ('projects') {
                    @for (project of section.items; track project.id) {
                      <div class="block project-block">
                        <h3>
                          <span
                            class="primary-field"
                            [attr.contenteditable]="editable ? 'true' : null"
                            (keydown.enter)="singleLine($event)"
                            (blur)="editField(project, 'name', $event)"
                            >{{ project.name }}</span
                          >
                          <span
                            [attr.contenteditable]="editable ? 'true' : null"
                            (keydown.enter)="singleLine($event)"
                            (blur)="editField(project, 'dates', $event)"
                            >{{ project.dates }}</span
                          >
                        </h3>
                        <p>
                          <strong
                            [attr.contenteditable]="editable ? 'true' : null"
                            (keydown.enter)="singleLine($event)"
                            (blur)="editField(project, 'role', $event)"
                            >{{ project.role }}</strong
                          >
                          <span
                            [attr.contenteditable]="editable ? 'true' : null"
                            (blur)="editField(project, 'description', $event)"
                            >{{ project.description }}</span
                          >
                        </p>
                        <p
                          class="technologies"
                          [attr.contenteditable]="editable ? 'true' : null"
                          (keydown.enter)="singleLine($event)"
                          (blur)="editStringList(project, 'technologies', $event)"
                        >
                          {{ project.technologies.join(' · ') }}
                        </p>
                      </div>
                    }
                  }
                  @case ('skills') {
                    <div class="skill-grid">
                      @for (group of section.groups; track group.id) {
                        <div class="skill-group">
                          <strong
                            [attr.contenteditable]="editable ? 'true' : null"
                            (keydown.enter)="singleLine($event)"
                            (blur)="editField(group, 'name', $event)"
                            >{{ group.name }}</strong
                          >
                          <p
                            [attr.contenteditable]="editable ? 'true' : null"
                            (keydown.enter)="singleLine($event)"
                            (blur)="editStringList(group, 'skills', $event)"
                          >
                            {{ group.skills.join(', ') }}
                          </p>
                        </div>
                      }
                    </div>
                  }
                  @default {
                    <ul>
                      @for (item of section.items; track $index) {
                        <li
                          [attr.contenteditable]="editable ? 'true' : null"
                          (blur)="editArrayItem(section.items, $index, $event)"
                        >
                          {{ item }}
                        </li>
                      }
                    </ul>
                  }
                }
              </section>
            }
          }
        </div>
      </article>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .sheet {
        --accent: #0f9fb8;
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 17mm 18mm;
        overflow: hidden;
        background: #ffffff;
        color: #22272a;
        box-shadow: 0 22px 70px rgba(10, 18, 20, 0.18);
        font-family: Arial, Helvetica, sans-serif;
      }
      .identity {
        display: grid;
        grid-template-columns: 1.4fr 1fr;
        gap: 1rem;
        padding-bottom: 0.85rem;
        border-bottom: 2px solid var(--accent);
      }
      h1,
      h2,
      h3,
      p {
        margin: 0;
      }
      h1 {
        font-size: 2.15rem;
        line-height: 1;
        font-weight: 720;
      }
      .identity-main > p {
        margin-top: 0.32rem;
        color: var(--accent);
        font-size: 0.95rem;
        font-weight: 700;
      }
      address {
        display: grid;
        align-content: end;
        gap: 0.18rem;
        font-size: 0.72rem;
        font-style: normal;
        text-align: right;
      }
      .resume-section {
        margin-top: 0.95rem;
        break-inside: avoid;
      }
      h2 {
        padding-bottom: 0.2rem;
        border-bottom: 1px solid #d8ddde;
        color: var(--accent);
        font-size: 0.74rem;
        font-weight: 800;
        text-transform: uppercase;
      }
      h3,
      .position-line {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
      }
      h3 {
        margin-top: 0.5rem;
        font-size: 0.9rem;
      }
      h3 > span:last-child,
      em {
        color: #687074;
        font-size: 0.7rem;
        font-style: normal;
        font-weight: 500;
      }
      .summary,
      li,
      .block p,
      .skill-grid p {
        font-size: 0.78rem;
        line-height: 1.45;
      }
      ul {
        margin: 0.25rem 0 0;
        padding-left: 1rem;
      }
      li + li {
        margin-top: 0.12rem;
      }
      .position {
        margin-top: 0.25rem;
      }
      .position-line strong {
        font-size: 0.78rem;
      }
      .technologies {
        margin-top: 0.15rem;
        color: var(--accent);
        font-weight: 700;
      }
      .skill-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.4rem 1.2rem;
        margin-top: 0.45rem;
      }
      .skill-group {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.4rem;
        align-items: baseline;
      }
      .skill-group strong {
        color: #343a3d;
        font-size: 0.72rem;
      }
      .is-editable [contenteditable='true'] {
        border-radius: 2px;
        outline: 1px solid transparent;
        transition:
          background 120ms ease,
          outline-color 120ms ease;
      }
      .is-editable [contenteditable='true']:hover {
        background: color-mix(in srgb, var(--accent), white 93%);
        outline-color: color-mix(in srgb, var(--accent), white 60%);
      }
      .is-editable [contenteditable='true']:focus {
        background: color-mix(in srgb, var(--accent), white 89%);
        outline: 2px solid color-mix(in srgb, var(--accent), white 28%);
        outline-offset: 2px;
      }
      .tech-modern {
        display: grid;
        grid-template-columns: 46mm 1fr;
        padding: 0;
      }
      .tech-modern .identity {
        display: flex;
        min-height: 297mm;
        flex-direction: column;
        grid-column: 1;
        padding: 18mm 8mm;
        border: 0;
        background: #17262b;
        color: #f4f8f7;
      }
      .tech-modern .identity h1 {
        font-size: 1.65rem;
      }
      .tech-modern .identity-main > p {
        color: #8ed8df;
        line-height: 1.35;
      }
      .tech-modern address {
        margin-top: auto;
        text-align: left;
        color: #c2ced0;
      }
      .tech-modern .resume-body {
        grid-column: 2;
        padding: 15mm 15mm 15mm 11mm;
      }
      .tech-modern .skill-grid {
        grid-template-columns: 1fr;
      }
      .tech-minimal {
        padding: 22mm;
        color: #282c2e;
      }
      .tech-minimal .identity {
        border-bottom-width: 1px;
      }
      .tech-minimal h2 {
        border-bottom: 0;
        color: #3c4447;
        letter-spacing: 0.08em;
      }
      .tech-minimal .resume-section {
        margin-top: 1.25rem;
      }
      .tech-executive {
        padding: 19mm 20mm;
        font-family: Georgia, 'Times New Roman', serif;
      }
      .tech-executive h1 {
        font-size: 2.35rem;
        font-weight: 500;
      }
      .tech-executive .identity-main > p,
      .tech-executive address,
      .tech-executive .resume-body {
        font-family: Arial, Helvetica, sans-serif;
      }
      .tech-executive h2 {
        color: #252a2d;
        border-bottom-color: var(--accent);
        font-size: 0.76rem;
      }
      .tech-creative {
        padding: 0 18mm 17mm;
      }
      .tech-creative .identity {
        margin: 0 -18mm 1.2rem;
        padding: 17mm 18mm 13mm;
        border: 0;
        background: #172126;
        color: #ffffff;
      }
      .tech-creative .identity-main > p {
        color: #a6e4e8;
      }
      .tech-creative address {
        color: #cbd6d7;
      }
      .tech-creative h2 {
        display: inline-block;
        padding: 0.24rem 0.55rem;
        border: 0;
        background: var(--accent);
        color: #ffffff;
      }
      @media (max-width: 900px) {
        .sheet {
          width: min(100%, 210mm);
          min-height: auto;
          padding: 1.3rem;
        }
        .identity {
          grid-template-columns: 1fr;
        }
        address {
          text-align: left;
        }
        .tech-modern {
          display: block;
          padding: 0;
        }
        .tech-modern .identity {
          min-height: auto;
          padding: 1.4rem;
        }
        .tech-modern .resume-body {
          padding: 1.4rem;
        }
        .tech-creative .identity {
          margin: -1.3rem -1.3rem 1.2rem;
          padding: 1.4rem;
        }
      }
      @media print {
        .sheet {
          width: 210mm;
          min-height: 297mm;
          box-shadow: none;
        }
        .is-editable [contenteditable='true'] {
          outline: 0;
          background: transparent;
        }
      }
    `,
  ],
})
export class ResumeRendererComponent {
  @Input({ required: true }) resume?: ResumeRecord;
  @Input() editable = false;
  @Output() edited = new EventEmitter<void>();

  get accent() {
    return RESUME_THEMES.find((theme) => theme.id === this.resume?.themeId)?.accent ?? '#0f9fb8';
  }

  get orderedSections(): ResumeSection[] {
    if (!this.resume) return [];
    const byId = new Map(this.resume.content.sections.map((section) => [section.id, section]));
    return this.resume.sectionOrder.flatMap((id) => {
      const section = byId.get(id);
      return section ? [section] : [];
    });
  }

  protected editField(target: object, field: string, event: Event) {
    if (!this.editable) return;
    (target as Record<string, unknown>)[field] = this.readText(event);
    this.edited.emit();
  }

  protected editArrayItem(items: string[], index: number, event: Event) {
    if (!this.editable) return;
    items[index] = this.readText(event);
    this.edited.emit();
  }

  protected editStringList(target: object, field: string, event: Event) {
    if (!this.editable) return;
    (target as Record<string, unknown>)[field] = this.readText(event)
      .split(/[·,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    this.edited.emit();
  }

  protected singleLine(event: KeyboardEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).blur();
  }

  private readText(event: Event) {
    return (event.currentTarget as HTMLElement).innerText.replace(/\u00a0/g, ' ').trim();
  }
}
