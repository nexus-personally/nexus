import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { ResumeRecord, ResumeSection } from '@nexus/shared';
import { resolveResumeColors } from '@nexus/shared';

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
        [class.has-photo]="showPhoto"
        [style.--accent]="colors.accent"
        [style.--heading]="colors.heading"
        [style.--body]="colors.body"
      >
        <header class="identity">
          @if (showPhoto) {
            <img
              class="profile-photo"
              [src]="resume.content.profile.photoDataUrl"
              [alt]="resume.content.profile.fullName + ' profile photo'"
            />
          }
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
        --heading: #20272a;
        --body: #30383b;
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 17mm 18mm;
        overflow: hidden;
        background: #ffffff;
        color: var(--body);
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
      .identity.has-photo,
      .has-photo .identity {
        grid-template-columns: 25mm 1.4fr 1fr;
        align-items: center;
      }
      .profile-photo {
        width: 22mm;
        height: 22mm;
        border: 2px solid color-mix(in srgb, var(--accent), white 60%);
        border-radius: 50%;
        object-fit: cover;
      }
      h1,
      h2,
      h3,
      p {
        margin: 0;
      }
      h1 {
        color: var(--heading);
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
      h3,
      .position-line strong,
      .skill-group strong {
        color: var(--heading);
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
        color: color-mix(in srgb, var(--body), white 34%);
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
      .tech-modern .profile-photo {
        width: 30mm;
        height: 30mm;
        margin-bottom: 0.6rem;
        border-color: #8ed8df;
      }
      .tech-modern .identity h1 {
        color: #ffffff;
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
      }
      .tech-minimal .identity,
      .tech-minimal .identity.has-photo,
      .tech-minimal.has-photo .identity {
        grid-template-columns: 30mm minmax(0, 1fr);
        align-items: center;
        gap: 7mm;
        padding-bottom: 0;
        border-bottom: 0;
      }
      .tech-minimal:not(.has-photo) .identity {
        grid-template-columns: minmax(0, 1fr);
      }
      .tech-minimal .identity-main h1 {
        font-size: 2.45rem;
        font-weight: 500;
      }
      .tech-minimal .identity-main > p {
        font-size: 1.05rem;
        font-weight: 600;
      }
      .tech-minimal .profile-photo {
        width: 28mm;
        height: 28mm;
        border-width: 1px;
      }
      .tech-minimal address {
        display: grid;
        grid-column: 1 / -1;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.55rem 1.4rem;
        margin: 4mm -22mm 0;
        padding: 4mm 22mm;
        background: var(--accent);
        color: #ffffff;
        text-align: left;
      }
      .tech-minimal .resume-body {
        --minimal-main-width: 1.25fr;
        --minimal-side-width: 0.95fr;
        display: grid;
        grid-template-columns:
          minmax(0, var(--minimal-main-width))
          minmax(0, var(--minimal-side-width));
        align-items: start;
        gap: 9mm;
        margin-top: 8mm;
      }
      .tech-minimal .resume-section {
        margin-top: 0;
      }
      .tech-minimal .resume-section[data-section='summary'],
      .tech-minimal .resume-section[data-section='experience'],
      .tech-minimal .resume-section[data-section='projects'],
      .tech-minimal .resume-section[data-section='education'] {
        grid-column: 1;
      }
      .tech-minimal .resume-section[data-section='skills'],
      .tech-minimal .resume-section[data-section='languages'],
      .tech-minimal .resume-section[data-section='interests'],
      .tech-minimal .resume-section[data-section='certifications'],
      .tech-minimal .resume-section[data-section='awards'],
      .tech-minimal .resume-section[data-section='custom'] {
        grid-column: 2;
      }
      .tech-minimal h2 {
        border-bottom: 0;
        color: var(--accent);
        font-size: 0.82rem;
        letter-spacing: 0.03em;
      }
      .tech-minimal .skill-grid {
        grid-template-columns: 1fr;
        gap: 0.65rem;
      }
      .tech-minimal .skill-group {
        grid-template-columns: 1fr;
        gap: 0.12rem;
      }
      .tech-minimal .skill-group strong {
        color: var(--heading);
      }
      .tech-executive {
        padding: 16mm 18mm;
        font-family: Arial, Helvetica, sans-serif;
      }
      .tech-executive .identity {
        grid-template-columns: minmax(0, 1fr);
        gap: 0;
        padding-bottom: 4mm;
        border-bottom: 1.4px solid #1d2427;
      }
      .tech-executive.has-photo .identity {
        grid-template-columns: minmax(0, 1fr) 24mm;
        column-gap: 7mm;
      }
      .tech-executive .profile-photo {
        grid-column: 2;
        grid-row: 1 / span 2;
        justify-self: end;
      }
      .tech-executive .identity-main {
        grid-column: 1;
        grid-row: 1;
      }
      .tech-executive h1 {
        font-size: 2.2rem;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: 0.01em;
      }
      .tech-executive .identity-main > p {
        margin-top: 1.4mm;
        color: var(--accent);
        font-size: 0.82rem;
        line-height: 1.35;
        font-weight: 800;
      }
      .tech-executive address {
        display: flex;
        grid-column: 1;
        flex-wrap: wrap;
        gap: 1.4mm 4mm;
        margin-top: 3mm;
        font-size: 0.59rem;
        line-height: 1.25;
        text-align: left;
      }
      .tech-executive .resume-body {
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) minmax(0, 0.92fr);
        align-items: start;
        gap: 9mm;
        margin-top: 6mm;
      }
      .tech-executive .resume-section {
        margin-top: 0;
      }
      .tech-executive .resume-section[data-section='summary'],
      .tech-executive .resume-section[data-section='experience'],
      .tech-executive .resume-section[data-section='projects'],
      .tech-executive .resume-section[data-section='languages'] {
        grid-column: 1;
      }
      .tech-executive .resume-section[data-section='skills'],
      .tech-executive .resume-section[data-section='education'],
      .tech-executive .resume-section[data-section='certifications'],
      .tech-executive .resume-section[data-section='awards'],
      .tech-executive .resume-section[data-section='interests'],
      .tech-executive .resume-section[data-section='custom'] {
        grid-column: 2;
      }
      .tech-executive h2 {
        padding-bottom: 1.5mm;
        border-bottom: 1.3px solid #1d2427;
        color: var(--heading);
        font-size: 0.72rem;
        letter-spacing: 0.02em;
        line-height: 1.2;
      }
      .tech-executive .summary,
      .tech-executive li,
      .tech-executive .block p,
      .tech-executive .skill-grid p {
        font-size: 0.67rem;
        line-height: 1.38;
      }
      .tech-executive h3 {
        margin-top: 3mm;
        font-size: 0.75rem;
      }
      .tech-executive h3 > span:last-child,
      .tech-executive em {
        font-size: 0.6rem;
      }
      .tech-executive .position-line strong {
        color: var(--accent);
        font-size: 0.68rem;
      }
      .tech-executive .technologies {
        color: var(--accent);
      }
      .tech-executive .skill-grid {
        grid-template-columns: 1fr;
        gap: 2.4mm;
        margin-top: 3mm;
      }
      .tech-executive .skill-group {
        grid-template-columns: 1fr;
        gap: 0.8mm;
      }
      .tech-executive .skill-group strong {
        color: var(--accent);
        font-size: 0.67rem;
      }
      .tech-executive h2 {
        color: var(--heading);
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
      .tech-creative .identity.has-photo,
      .tech-creative.has-photo .identity {
        grid-template-columns: 24mm 1.4fr 1fr;
      }
      .tech-creative .identity-main > p {
        color: color-mix(in srgb, var(--accent), white 48%);
      }
      .tech-creative .identity h1 {
        color: #ffffff;
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
        .tech-minimal {
          padding: 1.3rem;
        }
        .tech-executive {
          padding: 1.3rem;
        }
        .tech-executive.has-photo .identity {
          grid-template-columns: minmax(0, 1fr) 4.5rem;
          gap: 1rem;
        }
        .tech-executive .profile-photo {
          width: 4.5rem;
          height: 4.5rem;
        }
        .tech-executive .resume-body {
          grid-template-columns: 1fr;
          gap: 1.4rem;
        }
        .tech-executive .resume-section[data-section='summary'],
        .tech-executive .resume-section[data-section='experience'],
        .tech-executive .resume-section[data-section='projects'],
        .tech-executive .resume-section[data-section='languages'],
        .tech-executive .resume-section[data-section='skills'],
        .tech-executive .resume-section[data-section='education'],
        .tech-executive .resume-section[data-section='certifications'],
        .tech-executive .resume-section[data-section='awards'],
        .tech-executive .resume-section[data-section='interests'],
        .tech-executive .resume-section[data-section='custom'] {
          grid-column: 1;
        }
        .tech-minimal .identity,
        .tech-minimal .identity.has-photo,
        .tech-minimal.has-photo .identity {
          grid-template-columns: 1fr;
          gap: 1rem;
        }
        .tech-minimal .profile-photo {
          margin: 0 auto;
        }
        .tech-minimal address {
          grid-template-columns: 1fr;
          margin: 1rem -1.3rem 0;
          padding: 1rem 1.3rem;
        }
        .tech-minimal .resume-body {
          grid-template-columns: 1fr;
          gap: 1.4rem;
        }
        .tech-minimal .resume-section[data-section='summary'],
        .tech-minimal .resume-section[data-section='experience'],
        .tech-minimal .resume-section[data-section='projects'],
        .tech-minimal .resume-section[data-section='education'],
        .tech-minimal .resume-section[data-section='skills'],
        .tech-minimal .resume-section[data-section='languages'],
        .tech-minimal .resume-section[data-section='interests'],
        .tech-minimal .resume-section[data-section='certifications'],
        .tech-minimal .resume-section[data-section='awards'],
        .tech-minimal .resume-section[data-section='custom'] {
          grid-column: 1;
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

  get colors() {
    return this.resume
      ? resolveResumeColors(this.resume)
      : { accent: '#0f9fb8', heading: '#20272a', body: '#30383b' };
  }

  get showPhoto() {
    if (!this.resume?.content.profile.photoDataUrl || !this.resume.content.profile.photoVisible) {
      return false;
    }
    return true;
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
