import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  inject,
} from '@angular/core';
import { LucideLink, LucideMail, LucideMapPin, LucidePhone } from '@lucide/angular';
import type { ResumeColors, ResumeRecord, ResumeSection } from '@nexus/shared';
import { resolveResumeColors } from '@nexus/shared';

export type ResumeColorRole = Exclude<keyof ResumeColors, 'accent' | 'heading' | 'body'>;

export interface ResumeColorSelection {
  key: string;
  label: string;
  role: ResumeColorRole;
  background: string;
  left: number;
  top: number;
  textSelected?: boolean;
  fontWeight?: number;
}

@Component({
  selector: 'nexus-resume-renderer',
  host: { '[class.reference-preview]': 'referencePreview' },
  standalone: true,
  imports: [CommonModule, LucideMail, LucidePhone, LucideMapPin, LucideLink],
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
        [style.--name-color]="colors.name"
        [style.--headline-color]="colors.headline"
        [style.--contact-color]="colors.contact"
        [style.--section-title-color]="colors.sectionTitle"
        [style.--organization-color]="colors.organization"
        [style.--role-color]="colors.role"
        [style.--meta-color]="colors.meta"
        [style.--description-color]="colors.description"
        [style.--bullet-color]="colors.bullet"
        [style.--skill-label-color]="colors.skillLabel"
        [style.--skill-text-color]="colors.skillText"
        (paste)="pastePlainText($event)"
        (focusin)="selectColorField($event)"
        (mouseup)="captureTextSelection()"
        (keyup)="captureTextSelection()"
        (input)="syncRichTextFromInput($event)"
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
              data-color-key="profile.fullName"
              data-color-label="Name"
              data-color-role="name"
              [attr.contenteditable]="editable ? 'true' : null"
              [attr.tabindex]="editable ? 0 : null"
              [style.color]="fieldColor('profile.fullName', 'name')"
              [ngStyle]="textStyle('profile.fullName', 'name')"
              (keydown.enter)="singleLine($event)"
              (blur)="editField(resume.content.profile, 'fullName', $event)"
            >
              {{ resume.content.profile.fullName }}
            </h1>
            <p
              data-color-key="profile.headline"
              data-color-label="Headline"
              data-color-role="headline"
              [attr.contenteditable]="editable ? 'true' : null"
              [attr.tabindex]="editable ? 0 : null"
              [style.color]="fieldColor('profile.headline', 'headline')"
              [ngStyle]="textStyle('profile.headline', 'headline')"
              (keydown.enter)="singleLine($event)"
              (blur)="editField(resume.content.profile, 'headline', $event)"
            >
              {{ resume.content.profile.headline }}
            </p>
            @if (minimalSummarySection; as summarySection) {
              @if (!summarySection.hidden) {
                <section class="minimal-header-summary" data-section="summary">
                  <p
                    class="summary"
                    data-paste-multiline="true"
                    data-max-length="300"
                    data-max-lines="4"
                    [attr.data-color-key]="'section:' + summarySection.id + ':body'"
                    [attr.data-color-label]="summarySection.title + ' text'"
                    data-color-role="description"
                    [attr.contenteditable]="editable ? 'true' : null"
                    (beforeinput)="limitTextInput($event, 300)"
                    (input)="enforceTextLayout($event, 300, 4)"
                    [style.color]="
                      fieldColor('section:' + summarySection.id + ':body', 'description')
                    "
                    [ngStyle]="textStyle('section:' + summarySection.id + ':body', 'description')"
                    (blur)="editLimitedField(summarySection, 'body', $event, 300)"
                  >
                    {{ summarySection.body.slice(0, 300) }}
                  </p>
                </section>
              }
            }
          </div>
          <address>
            <span
              class="contact-item"
              [style.color]="fieldColor('profile.email', 'contact')"
              [ngStyle]="textStyle('profile.email', 'contact')"
            >
              <svg lucideMail aria-hidden="true"></svg>
              <span
                data-color-key="profile.email"
                data-color-label="Email"
                data-color-role="contact"
                [attr.contenteditable]="editable ? 'true' : null"
                (keydown.enter)="singleLine($event)"
                (blur)="editField(resume.content.profile, 'email', $event)"
                >{{ resume.content.profile.email }}</span
              >
            </span>
            <span
              class="contact-item"
              [style.color]="fieldColor('profile.phone', 'contact')"
              [ngStyle]="textStyle('profile.phone', 'contact')"
            >
              <svg lucidePhone aria-hidden="true"></svg>
              <span
                data-color-key="profile.phone"
                data-color-label="Phone"
                data-color-role="contact"
                [attr.contenteditable]="editable ? 'true' : null"
                (keydown.enter)="singleLine($event)"
                (blur)="editField(resume.content.profile, 'phone', $event)"
                >{{ resume.content.profile.phone }}</span
              >
            </span>
            <span
              class="contact-item"
              [style.color]="fieldColor('profile.location', 'contact')"
              [ngStyle]="textStyle('profile.location', 'contact')"
            >
              <svg lucideMapPin aria-hidden="true"></svg>
              <span
                data-color-key="profile.location"
                data-color-label="Address"
                data-color-role="contact"
                [attr.contenteditable]="editable ? 'true' : null"
                (keydown.enter)="singleLine($event)"
                (blur)="editField(resume.content.profile, 'location', $event)"
                >{{ resume.content.profile.location }}</span
              >
            </span>
            @if (editable || resume.content.profile.github) {
              <span
                class="contact-item"
                [style.color]="fieldColor('profile.github', 'contact')"
                [ngStyle]="textStyle('profile.github', 'contact')"
              >
                <svg lucideLink aria-hidden="true"></svg>
                <span
                  data-color-key="profile.github"
                  data-color-label="Website or profile link"
                  data-color-role="contact"
                  [attr.contenteditable]="editable ? 'true' : null"
                  (keydown.enter)="singleLine($event)"
                  (blur)="editField(resume.content.profile, 'github', $event)"
                  >{{ resume.content.profile.github }}</span
                >
              </span>
            }
          </address>
        </header>

        @if (usesIndependentColumns) {
          <div class="resume-body two-column-body">
            <div class="resume-column resume-column-main">
              @for (section of mainColumnSections; track section.id) {
                <ng-container
                  [ngTemplateOutlet]="resumeSection"
                  [ngTemplateOutletContext]="{ $implicit: section }"
                />
              }
            </div>
            <div class="resume-column resume-column-side">
              @for (section of sideColumnSections; track section.id) {
                <ng-container
                  [ngTemplateOutlet]="resumeSection"
                  [ngTemplateOutletContext]="{ $implicit: section }"
                />
              }
            </div>
          </div>
        } @else {
          <div class="resume-body">
            @for (section of orderedSections; track section.id) {
              <ng-container
                [ngTemplateOutlet]="resumeSection"
                [ngTemplateOutletContext]="{ $implicit: section }"
              />
            }
          </div>
        }

        <ng-template #resumeSection let-section>
          @if (!section.hidden) {
            <section class="resume-section" [attr.data-section]="section.type">
              <h2
                [attr.data-color-key]="'section:' + section.id + ':title'"
                [attr.data-color-label]="section.title + ' section title'"
                data-color-role="sectionTitle"
                [attr.contenteditable]="editable ? 'true' : null"
                [style.color]="fieldColor('section:' + section.id + ':title', 'sectionTitle')"
                [ngStyle]="textStyle('section:' + section.id + ':title', 'sectionTitle')"
                (keydown.enter)="singleLine($event)"
                (blur)="editField(section, 'title', $event)"
              >
                {{ section.title }}
              </h2>

              @switch (section.type) {
                @case ('summary') {
                  <p
                    class="summary"
                    data-paste-multiline="true"
                    [attr.data-color-key]="'section:' + section.id + ':body'"
                    [attr.data-color-label]="section.title + ' text'"
                    data-color-role="description"
                    [attr.contenteditable]="editable ? 'true' : null"
                    [style.color]="fieldColor('section:' + section.id + ':body', 'description')"
                    [ngStyle]="textStyle('section:' + section.id + ':body', 'description')"
                    (blur)="editField(section, 'body', $event)"
                  >
                    {{ section.body }}
                  </p>
                }
                @case ('experience') {
                  @for (item of section.items; track item.id) {
                    <div class="block experience-block">
                      @if (editable) {
                        <span class="company-actions" contenteditable="false">
                          <button
                            type="button"
                            title="Add company below"
                            aria-label="Add company below"
                            (mousedown)="$event.preventDefault()"
                            (click)="addExperienceCompany(section, $index + 1)"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            title="Delete company"
                            aria-label="Delete company"
                            [disabled]="section.items.length === 1"
                            (mousedown)="$event.preventDefault()"
                            (click)="removeExperienceCompany(section, $index)"
                          >
                            ×
                          </button>
                        </span>
                      }
                      <h3>
                        <span
                          class="primary-field"
                          [attr.data-color-key]="
                            'section:' + section.id + ':experience:' + item.id + ':company'
                          "
                          data-color-label="Company"
                          data-color-role="organization"
                          [attr.contenteditable]="editable ? 'true' : null"
                          [style.color]="
                            fieldColor(
                              'section:' + section.id + ':experience:' + item.id + ':company',
                              'organization'
                            )
                          "
                          [ngStyle]="
                            textStyle(
                              'section:' + section.id + ':experience:' + item.id + ':company',
                              'organization'
                            )
                          "
                          (keydown.enter)="singleLine($event)"
                          (blur)="editField(item, 'company', $event)"
                          >{{ item.company }}</span
                        >
                        <span
                          [attr.data-color-key]="
                            'section:' + section.id + ':experience:' + item.id + ':location'
                          "
                          data-color-label="Experience location"
                          data-color-role="meta"
                          [attr.contenteditable]="editable ? 'true' : null"
                          [style.color]="
                            fieldColor(
                              'section:' + section.id + ':experience:' + item.id + ':location',
                              'meta'
                            )
                          "
                          [ngStyle]="
                            textStyle(
                              'section:' + section.id + ':experience:' + item.id + ':location',
                              'meta'
                            )
                          "
                          (keydown.enter)="singleLine($event)"
                          (blur)="editField(item, 'location', $event)"
                          >{{ item.location }}</span
                        >
                      </h3>
                      @for (position of item.positions; track position.id) {
                        <div class="position">
                          <div class="position-line">
                            <strong
                              [attr.data-color-key]="
                                'section:' + section.id + ':position:' + position.id + ':title'
                              "
                              data-color-label="Position title"
                              data-color-role="role"
                              [attr.contenteditable]="editable ? 'true' : null"
                              [style.color]="
                                fieldColor(
                                  'section:' + section.id + ':position:' + position.id + ':title',
                                  'role'
                                )
                              "
                              [ngStyle]="
                                textStyle(
                                  'section:' + section.id + ':position:' + position.id + ':title',
                                  'role'
                                )
                              "
                              (keydown.enter)="singleLine($event)"
                              (blur)="editField(position, 'title', $event)"
                              >{{ position.title }}</strong
                            >
                            <em class="date-field">
                              <span
                                class="date-field"
                                [attr.data-color-key]="
                                  'section:' +
                                  section.id +
                                  ':position:' +
                                  position.id +
                                  ':startDate'
                                "
                                data-color-label="Start date"
                                data-color-role="meta"
                                [attr.contenteditable]="editable ? 'true' : null"
                                [style.color]="
                                  fieldColor(
                                    'section:' +
                                      section.id +
                                      ':position:' +
                                      position.id +
                                      ':startDate',
                                    'meta'
                                  )
                                "
                                [ngStyle]="
                                  textStyle(
                                    'section:' +
                                      section.id +
                                      ':position:' +
                                      position.id +
                                      ':startDate',
                                    'meta'
                                  )
                                "
                                (keydown.enter)="singleLine($event)"
                                (blur)="editField(position, 'startDate', $event)"
                                >{{ position.startDate }}</span
                              >
                              -
                              <span
                                class="date-field"
                                [attr.data-color-key]="
                                  'section:' + section.id + ':position:' + position.id + ':endDate'
                                "
                                data-color-label="End date"
                                data-color-role="meta"
                                [attr.contenteditable]="editable ? 'true' : null"
                                [style.color]="
                                  fieldColor(
                                    'section:' +
                                      section.id +
                                      ':position:' +
                                      position.id +
                                      ':endDate',
                                    'meta'
                                  )
                                "
                                [ngStyle]="
                                  textStyle(
                                    'section:' +
                                      section.id +
                                      ':position:' +
                                      position.id +
                                      ':endDate',
                                    'meta'
                                  )
                                "
                                (keydown.enter)="singleLine($event)"
                                (blur)="editField(position, 'endDate', $event)"
                                >{{ position.endDate }}</span
                              >
                            </em>
                          </div>
                          <ul class="editable-list">
                            @for (bullet of position.bullets; track $index) {
                              <li
                                class="editable-list-item"
                                [style.color]="
                                  fieldColor(
                                    bulletColorKey(section.id, position.id, $index),
                                    'bullet'
                                  )
                                "
                                [ngStyle]="
                                  textStyle(
                                    bulletColorKey(section.id, position.id, $index),
                                    'bullet'
                                  )
                                "
                              >
                                <span
                                  [attr.data-color-key]="
                                    bulletColorKey(section.id, position.id, $index)
                                  "
                                  data-color-label="Experience bullet"
                                  data-color-role="bullet"
                                  data-paste-sync="true"
                                  [attr.contenteditable]="editable ? 'true' : null"
                                  [style.color]="
                                    fieldColor(
                                      bulletColorKey(section.id, position.id, $index),
                                      'bullet'
                                    )
                                  "
                                  [ngStyle]="
                                    textStyle(
                                      bulletColorKey(section.id, position.id, $index),
                                      'bullet'
                                    )
                                  "
                                  (keydown)="
                                    listItemKeydown(
                                      $event,
                                      position.bullets,
                                      $index,
                                      bulletColorPrefix(section.id, position.id)
                                    )
                                  "
                                  (input)="syncArrayItemInput(position.bullets, $index, $event)"
                                  (blur)="editArrayItem(position.bullets, $index, $event)"
                                  >{{ bullet }}</span
                                >
                                @if (editable) {
                                  <span class="list-item-actions" contenteditable="false">
                                    <button
                                      type="button"
                                      title="Add bullet below"
                                      aria-label="Add bullet below"
                                      (mousedown)="$event.preventDefault()"
                                      (click)="
                                        addListItem(
                                          position.bullets,
                                          $index + 1,
                                          bulletColorPrefix(section.id, position.id)
                                        )
                                      "
                                    >
                                      +
                                    </button>
                                    <button
                                      type="button"
                                      title="Delete bullet"
                                      aria-label="Delete bullet"
                                      [disabled]="position.bullets.length === 1"
                                      (mousedown)="$event.preventDefault()"
                                      (click)="
                                        removeListItem(
                                          position.bullets,
                                          $index,
                                          bulletColorPrefix(section.id, position.id)
                                        )
                                      "
                                    >
                                      ×
                                    </button>
                                  </span>
                                }
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
                          [attr.data-color-key]="
                            'section:' + section.id + ':education:' + item.id + ':school'
                          "
                          data-color-label="School"
                          data-color-role="organization"
                          [attr.contenteditable]="editable ? 'true' : null"
                          [style.color]="
                            fieldColor(
                              'section:' + section.id + ':education:' + item.id + ':school',
                              'organization'
                            )
                          "
                          [ngStyle]="
                            textStyle(
                              'section:' + section.id + ':education:' + item.id + ':school',
                              'organization'
                            )
                          "
                          (keydown.enter)="singleLine($event)"
                          (blur)="editField(item, 'school', $event)"
                          >{{ item.school }}</span
                        >
                        <span
                          class="date-field"
                          [attr.data-color-key]="
                            'section:' + section.id + ':education:' + item.id + ':dates'
                          "
                          data-color-label="Education dates"
                          data-color-role="meta"
                          [attr.contenteditable]="editable ? 'true' : null"
                          [style.color]="
                            fieldColor(
                              'section:' + section.id + ':education:' + item.id + ':dates',
                              'meta'
                            )
                          "
                          [ngStyle]="
                            textStyle(
                              'section:' + section.id + ':education:' + item.id + ':dates',
                              'meta'
                            )
                          "
                          (keydown.enter)="singleLine($event)"
                          (blur)="editField(item, 'dates', $event)"
                          >{{ item.dates }}</span
                        >
                      </h3>
                      <p>
                        <span
                          [attr.data-color-key]="
                            'section:' + section.id + ':education:' + item.id + ':degree'
                          "
                          data-color-label="Degree"
                          data-color-role="role"
                          [attr.contenteditable]="editable ? 'true' : null"
                          [style.color]="
                            fieldColor(
                              'section:' + section.id + ':education:' + item.id + ':degree',
                              'role'
                            )
                          "
                          [ngStyle]="
                            textStyle(
                              'section:' + section.id + ':education:' + item.id + ':degree',
                              'role'
                            )
                          "
                          (keydown.enter)="singleLine($event)"
                          (blur)="editField(item, 'degree', $event)"
                          >{{ item.degree }}</span
                        >
                        ·
                        <span
                          [attr.data-color-key]="
                            'section:' + section.id + ':education:' + item.id + ':location'
                          "
                          data-color-label="Education location"
                          data-color-role="meta"
                          [attr.contenteditable]="editable ? 'true' : null"
                          [style.color]="
                            fieldColor(
                              'section:' + section.id + ':education:' + item.id + ':location',
                              'meta'
                            )
                          "
                          [ngStyle]="
                            textStyle(
                              'section:' + section.id + ':education:' + item.id + ':location',
                              'meta'
                            )
                          "
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
                          [attr.data-color-key]="
                            'section:' + section.id + ':project:' + project.id + ':name'
                          "
                          data-color-label="Project name"
                          data-color-role="organization"
                          [attr.contenteditable]="editable ? 'true' : null"
                          [style.color]="
                            fieldColor(
                              'section:' + section.id + ':project:' + project.id + ':name',
                              'organization'
                            )
                          "
                          [ngStyle]="
                            textStyle(
                              'section:' + section.id + ':project:' + project.id + ':name',
                              'organization'
                            )
                          "
                          (keydown.enter)="singleLine($event)"
                          (blur)="editField(project, 'name', $event)"
                          >{{ project.name }}</span
                        >
                        <span
                          class="date-field"
                          [attr.data-color-key]="
                            'section:' + section.id + ':project:' + project.id + ':dates'
                          "
                          data-color-label="Project dates"
                          data-color-role="meta"
                          [attr.contenteditable]="editable ? 'true' : null"
                          [style.color]="
                            fieldColor(
                              'section:' + section.id + ':project:' + project.id + ':dates',
                              'meta'
                            )
                          "
                          [ngStyle]="
                            textStyle(
                              'section:' + section.id + ':project:' + project.id + ':dates',
                              'meta'
                            )
                          "
                          (keydown.enter)="singleLine($event)"
                          (blur)="editField(project, 'dates', $event)"
                          >{{ project.dates }}</span
                        >
                      </h3>
                      <p>
                        <strong
                          [attr.data-color-key]="
                            'section:' + section.id + ':project:' + project.id + ':role'
                          "
                          data-color-label="Project role"
                          data-color-role="role"
                          [attr.contenteditable]="editable ? 'true' : null"
                          [style.color]="
                            fieldColor(
                              'section:' + section.id + ':project:' + project.id + ':role',
                              'role'
                            )
                          "
                          [ngStyle]="
                            textStyle(
                              'section:' + section.id + ':project:' + project.id + ':role',
                              'role'
                            )
                          "
                          (keydown.enter)="singleLine($event)"
                          (blur)="editField(project, 'role', $event)"
                          >{{ project.role }}</strong
                        >
                        <span
                          data-paste-multiline="true"
                          [attr.data-color-key]="
                            'section:' + section.id + ':project:' + project.id + ':description'
                          "
                          data-color-label="Project description"
                          data-color-role="description"
                          [attr.contenteditable]="editable ? 'true' : null"
                          [style.color]="
                            fieldColor(
                              'section:' + section.id + ':project:' + project.id + ':description',
                              'description'
                            )
                          "
                          [ngStyle]="
                            textStyle(
                              'section:' + section.id + ':project:' + project.id + ':description',
                              'description'
                            )
                          "
                          (blur)="editField(project, 'description', $event)"
                          >{{ project.description }}</span
                        >
                      </p>
                      <p
                        class="technologies"
                        [attr.data-color-key]="
                          'section:' + section.id + ':project:' + project.id + ':technologies'
                        "
                        data-color-label="Project technologies"
                        data-color-role="skillText"
                        [attr.contenteditable]="editable ? 'true' : null"
                        [style.color]="
                          fieldColor(
                            'section:' + section.id + ':project:' + project.id + ':technologies',
                            'skillText'
                          )
                        "
                        [ngStyle]="
                          textStyle(
                            'section:' + section.id + ':project:' + project.id + ':technologies',
                            'skillText'
                          )
                        "
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
                          [attr.data-color-key]="
                            'section:' + section.id + ':skills:' + group.id + ':name'
                          "
                          data-color-label="Skill category"
                          data-color-role="skillLabel"
                          [attr.contenteditable]="editable ? 'true' : null"
                          [style.color]="
                            fieldColor(
                              'section:' + section.id + ':skills:' + group.id + ':name',
                              'skillLabel'
                            )
                          "
                          [ngStyle]="
                            textStyle(
                              'section:' + section.id + ':skills:' + group.id + ':name',
                              'skillLabel'
                            )
                          "
                          (keydown.enter)="singleLine($event)"
                          (blur)="editField(group, 'name', $event)"
                          >{{ group.name }}</strong
                        >
                        <p
                          [attr.data-color-key]="
                            'section:' + section.id + ':skills:' + group.id + ':items'
                          "
                          data-color-label="Skills"
                          data-color-role="skillText"
                          [attr.contenteditable]="editable ? 'true' : null"
                          [style.color]="
                            fieldColor(
                              'section:' + section.id + ':skills:' + group.id + ':items',
                              'skillText'
                            )
                          "
                          [ngStyle]="
                            textStyle(
                              'section:' + section.id + ':skills:' + group.id + ':items',
                              'skillText'
                            )
                          "
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
                  <ul class="editable-list">
                    @for (item of section.items; track $index) {
                      <li
                        class="editable-list-item"
                        [style.color]="fieldColor(simpleItemColorKey(section.id, $index), 'bullet')"
                        [ngStyle]="textStyle(simpleItemColorKey(section.id, $index), 'bullet')"
                      >
                        <span
                          [attr.data-color-key]="simpleItemColorKey(section.id, $index)"
                          [attr.data-color-label]="section.title + ' item'"
                          data-color-role="bullet"
                          data-paste-sync="true"
                          [attr.contenteditable]="editable ? 'true' : null"
                          [style.color]="
                            fieldColor(simpleItemColorKey(section.id, $index), 'bullet')
                          "
                          [ngStyle]="textStyle(simpleItemColorKey(section.id, $index), 'bullet')"
                          (keydown)="
                            listItemKeydown(
                              $event,
                              section.items,
                              $index,
                              simpleItemColorPrefix(section.id)
                            )
                          "
                          (input)="syncArrayItemInput(section.items, $index, $event)"
                          (blur)="editArrayItem(section.items, $index, $event)"
                          >{{ item }}</span
                        >
                        @if (editable) {
                          <span class="list-item-actions" contenteditable="false">
                            <button
                              type="button"
                              title="Add item below"
                              aria-label="Add item below"
                              (mousedown)="$event.preventDefault()"
                              (click)="
                                addListItem(
                                  section.items,
                                  $index + 1,
                                  simpleItemColorPrefix(section.id)
                                )
                              "
                            >
                              +
                            </button>
                            <button
                              type="button"
                              title="Delete item"
                              aria-label="Delete item"
                              [disabled]="section.items.length === 1"
                              (mousedown)="$event.preventDefault()"
                              (click)="
                                removeListItem(
                                  section.items,
                                  $index,
                                  simpleItemColorPrefix(section.id)
                                )
                              "
                            >
                              ×
                            </button>
                          </span>
                        }
                      </li>
                    }
                  </ul>
                }
              }
            </section>
          }
        </ng-template>
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
        --name-color: var(--heading);
        --headline-color: var(--accent);
        --contact-color: var(--body);
        --section-title-color: var(--accent);
        --organization-color: var(--heading);
        --role-color: var(--heading);
        --meta-color: var(--body);
        --description-color: var(--body);
        --bullet-color: var(--body);
        --skill-label-color: var(--heading);
        --skill-text-color: var(--body);
        --template-inline-padding: 50px;
        --font-name: 2rem;
        --font-headline: 0.95rem;
        --font-contact: 0.75rem;
        --font-section-title: 0.82rem;
        --font-organization: 0.9rem;
        --font-meta: 0.72rem;
        --font-body: 0.82rem;
        --font-role: 0.82rem;
        --font-skill-label: 0.78rem;
        width: 210mm;
        min-height: 297mm;
        box-sizing: border-box;
        margin: 0 auto;
        padding: 44px var(--template-inline-padding);
        overflow: visible;
        background: #ffffff;
        color: var(--body);
        box-shadow: 0 22px 70px rgba(10, 18, 20, 0.18);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
          'PingFang SC', 'Microsoft YaHei', sans-serif;
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
        color: var(--name-color);
        font-size: var(--font-name);
        line-height: 1;
        font-weight: 720;
      }
      .identity-main > p {
        margin-top: 0.32rem;
        color: var(--headline-color);
        font-size: var(--font-headline);
        font-weight: 700;
      }
      address {
        display: grid;
        align-content: end;
        gap: 0.18rem;
        font-size: var(--font-contact);
        font-style: normal;
        text-align: right;
        color: var(--contact-color);
      }
      .contact-item {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.82rem;
        min-width: 0;
      }
      .contact-item svg {
        width: 1em;
        height: 1em;
        flex: 0 0 auto;
        stroke-width: 1.9;
      }
      h3 {
        color: var(--organization-color);
      }
      .position-line strong {
        color: var(--role-color);
      }
      .skill-group strong {
        color: var(--skill-label-color);
      }
      .resume-section {
        margin-top: 0.95rem;
        break-inside: avoid;
      }
      .block,
      .position,
      .skill-group,
      .editable-list-item {
        break-inside: avoid;
      }
      .experience-block {
        position: relative;
      }
      .experience-block + .experience-block {
        margin-top: 1.4rem;
      }
      .is-editable .experience-block {
        padding-right: 3.2rem;
      }
      .company-actions {
        position: absolute;
        top: 0.35rem;
        right: 0;
        display: inline-flex;
        gap: 0.18rem;
        opacity: 0;
        pointer-events: none;
        transition: opacity 120ms ease;
      }
      .experience-block:hover > .company-actions,
      .experience-block:focus-within > .company-actions {
        opacity: 1;
        pointer-events: auto;
      }
      .company-actions button {
        display: inline-grid;
        width: 1.35rem;
        height: 1.35rem;
        place-items: center;
        padding: 0;
        border: 1px solid color-mix(in srgb, var(--accent), white 55%);
        border-radius: 50%;
        background: #ffffff;
        color: var(--heading);
        font:
          700 0.72rem/1 Roboto,
          'Helvetica Neue',
          sans-serif;
        cursor: pointer;
      }
      .company-actions button:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
      .resume-column {
        display: flex;
        min-width: 0;
        flex-direction: column;
      }
      h2 {
        padding-bottom: 0.2rem;
        border-bottom: 1px solid #d8ddde;
        color: var(--section-title-color);
        font-size: var(--font-section-title);
        font-weight: 800;
        text-transform: uppercase;
        break-after: avoid;
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
        font-size: var(--font-organization);
      }
      h3 > span:last-child,
      em {
        color: var(--meta-color);
        font-size: var(--font-meta);
        font-style: normal;
        font-weight: 500;
      }
      .date-field {
        font-style: italic;
      }
      .summary,
      .block p,
      .skill-grid p {
        color: var(--description-color);
        font-size: var(--font-body);
        line-height: 1.45;
      }
      li {
        color: var(--bullet-color);
        font-size: var(--font-body);
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
        font-size: var(--font-role);
      }
      .technologies {
        margin-top: 0.15rem;
        color: var(--skill-text-color);
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
        font-size: var(--font-skill-label);
      }
      .skill-group p {
        color: var(--skill-text-color);
      }
      .editable-list-item {
        position: relative;
        list-style: none;
      }
      .editable-list-item::before {
        content: '•';
        position: absolute;
        top: 0;
        left: -0.95rem;
        color: inherit;
        font-size: 1.8em;
        line-height: 1;
      }
      .editable-list-item > [contenteditable='true'] {
        display: inline-block;
        min-width: 2rem;
        min-height: 1em;
      }
      .list-item-actions {
        position: absolute;
        top: 50%;
        right: 0;
        display: inline-flex;
        gap: 0.18rem;
        opacity: 0;
        pointer-events: none;
        transform: translateY(-50%);
        transition: opacity 120ms ease;
      }
      .editable-list-item:hover .list-item-actions,
      .editable-list-item:focus-within .list-item-actions {
        opacity: 1;
        pointer-events: auto;
      }
      .list-item-actions button {
        display: inline-grid;
        width: 1.35rem;
        height: 1.35rem;
        place-items: center;
        padding: 0;
        border: 1px solid color-mix(in srgb, var(--accent), white 55%);
        border-radius: 50%;
        background: #ffffff;
        color: var(--heading);
        font:
          700 0.72rem/1 Roboto,
          'Helvetica Neue',
          sans-serif;
        cursor: pointer;
      }
      .list-item-actions button:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
      [data-paste-multiline='true'] {
        white-space: pre-line;
      }
      .is-editable [contenteditable='true'] {
        border-radius: 2px;
        background: transparent;
        outline: 1px solid transparent;
        transition: outline-color 120ms ease;
      }
      .is-editable [contenteditable='true']:empty::before {
        content: 'Enter ' attr(data-color-label);
        color: color-mix(in srgb, currentColor, transparent 48%);
        font-style: italic;
        font-weight: 400;
        pointer-events: none;
      }
      .is-editable [contenteditable='true'] * {
        background: transparent !important;
        color: inherit !important;
        font-family: inherit !important;
        font-size: inherit !important;
        letter-spacing: inherit !important;
        line-height: inherit !important;
        -webkit-text-fill-color: currentColor !important;
      }
      .is-editable [contenteditable='true']:hover {
        background: transparent;
        outline-color: color-mix(in srgb, var(--accent), white 60%);
      }
      .is-editable [contenteditable='true']:focus {
        background: transparent;
        outline: 2px solid color-mix(in srgb, var(--accent), white 28%);
        outline-offset: 2px;
      }
      .tech-modern {
        --font-name: 1.75rem;
        display: grid;
        grid-template-columns: 46mm 1fr;
        padding: 0;
      }
      .tech-modern .identity {
        display: flex;
        min-height: 297mm;
        min-width: 0;
        box-sizing: border-box;
        flex-direction: column;
        grid-column: 1;
        padding: 44px 20px;
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
      }
      .tech-modern .identity-main > p {
        color: #8ed8df;
        line-height: 1.35;
      }
      .tech-modern address {
        width: 100%;
        min-width: 0;
        margin-top: auto;
        text-align: left;
        color: #c2ced0;
      }
      .tech-modern .contact-item {
        display: grid;
        grid-template-columns: 1em minmax(0, 1fr);
        align-items: start;
        width: 100%;
        gap: 0.65rem;
      }
      .tech-modern .contact-item > span {
        min-width: 0;
        max-width: 100%;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .tech-minimal .contact-item,
      .tech-executive .contact-item {
        justify-content: flex-start;
      }
      .tech-modern .resume-body {
        grid-column: 2;
        padding: 44px var(--template-inline-padding);
      }
      .tech-modern .skill-grid {
        grid-template-columns: 1fr;
      }
      .tech-minimal {
        --font-name: 2.15rem;
        --font-headline: 1rem;
        --font-contact: 0.75rem;
        --font-organization: 0.88rem;
        --font-meta: 0.72rem;
        --font-body: 0.82rem;
        --font-role: 0.82rem;
        --font-skill-label: 0.78rem;
        --font-section-title: 0.82rem;
        padding: 44px var(--template-inline-padding);
      }
      .tech-minimal .identity,
      .tech-minimal .identity.has-photo,
      .tech-minimal.has-photo .identity {
        grid-template-columns: var(--minimal-photo-size, 28mm) minmax(0, 1fr);
        align-items: start;
        gap: 7mm;
        padding-bottom: 0;
        border-bottom: 0;
      }
      .tech-minimal:not(.has-photo) .identity {
        grid-template-columns: minmax(0, 1fr);
      }
      .tech-minimal .identity-main h1 {
        font-weight: 500;
      }
      .tech-minimal .identity-main > p {
        font-weight: 600;
      }
      .tech-minimal .minimal-header-summary {
        margin-top: 4mm;
      }
      .tech-minimal .minimal-header-summary .summary {
        color: var(--description-color);
        font-size: var(--font-body);
        line-height: 1.45;
        font-weight: 400;
        max-height: calc(1.45em * 4);
        overflow: hidden;
      }
      .tech-minimal .profile-photo {
        width: var(--minimal-photo-size, 28mm);
        height: var(--minimal-photo-size, 28mm);
        aspect-ratio: 1;
        border-width: 1px;
      }
      .tech-minimal address {
        display: grid;
        grid-column: 1 / -1;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.55rem 1.4rem;
        margin: 4mm calc(var(--template-inline-padding) * -1) 0;
        padding: 4mm var(--template-inline-padding);
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
      .tech-minimal .resume-column {
        gap: 8mm;
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
        --font-name: 2rem;
        --font-headline: 0.88rem;
        --font-contact: 0.68rem;
        --font-section-title: 0.78rem;
        --font-organization: 0.82rem;
        --font-meta: 0.68rem;
        --font-body: 0.75rem;
        --font-role: 0.76rem;
        --font-skill-label: 0.74rem;
        padding: 44px var(--template-inline-padding);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
          'PingFang SC', 'Microsoft YaHei', sans-serif;
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
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: 0.01em;
      }
      .tech-executive .identity-main > p {
        margin-top: 1.4mm;
        color: var(--accent);
        line-height: 1.35;
        font-weight: 800;
      }
      .tech-executive address {
        display: flex;
        grid-column: 1;
        flex-wrap: wrap;
        gap: 1.4mm 4mm;
        margin-top: 3mm;
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
      .tech-executive .resume-column {
        gap: 6mm;
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
        letter-spacing: 0.02em;
        line-height: 1.2;
      }
      .tech-executive .summary,
      .tech-executive li,
      .tech-executive .block p,
      .tech-executive .skill-grid p {
        line-height: 1.38;
      }
      .tech-executive h3 {
        margin-top: 3mm;
      }
      .tech-executive .position-line strong {
        color: var(--accent);
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
      }
      .tech-executive h2 {
        color: var(--heading);
        border-bottom-color: var(--accent);
      }
      .tech-creative {
        padding: 0 var(--template-inline-padding) 44px;
      }
      .tech-creative .identity {
        margin: 0 calc(var(--template-inline-padding) * -1) 1.2rem;
        padding: 44px var(--template-inline-padding);
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
      @page {
        size: A4;
        margin: 44px 0;
      }
      @media print {
        .sheet {
          width: 210mm;
          min-height: calc(297mm - 88px);
          padding-top: 0;
          padding-bottom: 0;
          overflow: visible;
          box-shadow: none;
        }
        .is-editable [contenteditable='true'] {
          outline: 0;
          background: transparent;
        }
        .list-item-actions,
        .company-actions {
          display: none !important;
        }
        .is-editable .experience-block {
          padding-right: 0;
        }
      }
    `,
  ],
  styleUrls: ['./resume-renderer.reference.scss'],
})
export class ResumeRendererComponent implements AfterViewInit, AfterViewChecked, OnDestroy {
  private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;
  private readonly lastValidText = new WeakMap<HTMLElement, string>();
  private identityResizeObserver?: ResizeObserver;
  private selectedTextKey = '';
  private selectedTextOffsets?: { start: number; end: number };

  @Input({ required: true }) resume?: ResumeRecord;
  @Input() editable = false;
  @Input() referencePreview = false;
  @Output() edited = new EventEmitter<void>();
  @Output() colorSelected = new EventEmitter<ResumeColorSelection>();

  ngAfterViewInit() {
    this.hydrateRichText();
    if (typeof ResizeObserver === 'undefined') return;
    const identityMain = this.host.nativeElement.querySelector<HTMLElement>('.identity-main');
    if (!identityMain) return;
    this.identityResizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const pixelsPerMillimetre = 96 / 25.4;
      const minimum = 28 * pixelsPerMillimetre;
      const maximum = 42 * pixelsPerMillimetre;
      const size = Math.min(maximum, Math.max(minimum, entry.contentRect.height));
      this.host.nativeElement.style.setProperty('--minimal-photo-size', `${size}px`);
    });
    this.identityResizeObserver.observe(identityMain);
  }

  ngAfterViewChecked() {
    this.hydrateRichText();
  }

  ngOnDestroy() {
    this.identityResizeObserver?.disconnect();
  }

  get colors() {
    return this.resume
      ? resolveResumeColors(this.resume)
      : resolveResumeColors({ templateId: 'tech-core', themeId: 'signal-cyan' });
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
      return section &&
        !(
          this.referencePreview &&
          this.resume?.templateId === 'tech-minimal' &&
          section.type === 'summary'
        )
        ? [section]
        : [];
    });
  }

  get usesIndependentColumns() {
    return (
      !this.referencePreview &&
      (this.resume?.templateId === 'tech-minimal' || this.resume?.templateId === 'tech-executive')
    );
  }

  get mainColumnSections() {
    return this.orderedSections.filter(
      (section) =>
        !this.isSideColumnSection(section) &&
        !(this.resume?.templateId === 'tech-minimal' && section.type === 'summary'),
    );
  }

  get minimalSummarySection() {
    if (this.resume?.templateId !== 'tech-minimal') return undefined;
    return this.orderedSections.find((section) => section.type === 'summary');
  }

  get sideColumnSections() {
    return this.orderedSections.filter((section) => this.isSideColumnSection(section));
  }

  protected editField(target: object, field: string, event: Event) {
    if (!this.editable) return;
    const value = this.readText(event);
    this.syncEditableText(event.currentTarget as HTMLElement, value);
    (target as Record<string, unknown>)[field] = value;
    this.edited.emit();
  }

  protected editLimitedField(target: object, field: string, event: Event, maxLength: number) {
    if (!this.editable) return;
    const element = event.currentTarget as HTMLElement;
    const value = this.readText(event).slice(0, maxLength);
    this.syncEditableText(element, value);
    (target as Record<string, unknown>)[field] = value;
    this.edited.emit();
  }

  protected limitTextInput(event: InputEvent, maxLength: number) {
    if (!this.editable) return;
    const target = event.currentTarget as HTMLElement;
    this.lastValidText.set(target, target.innerText);
    if (event.inputType.startsWith('delete')) return;
    const selection = window.getSelection();
    const selectedLength =
      selection?.rangeCount && target.contains(selection.anchorNode)
        ? selection.getRangeAt(0).toString().length
        : 0;
    const insertedLength = event.data?.length ?? 0;
    if (target.innerText.length - selectedLength + insertedLength > maxLength) {
      event.preventDefault();
    }
  }

  protected enforceTextLayout(event: Event, maxLength: number, maxLines: number) {
    const target = event.currentTarget as HTMLElement;
    if (target.innerText.length <= maxLength && this.renderedLineCount(target) <= maxLines) {
      this.lastValidText.set(target, target.innerText);
      return;
    }
    target.innerText = this.lastValidText.get(target) ?? target.innerText.slice(0, maxLength);
    this.placeCaretAtEnd(target);
  }

  protected editArrayItem(items: string[], index: number, event: Event) {
    if (!this.editable) return;
    const target = event.currentTarget as HTMLElement;
    if (target.dataset['skipBlur'] === 'true') {
      delete target.dataset['skipBlur'];
      return;
    }
    const value = this.readText(event);
    this.syncEditableText(target, value);
    items[index] = value;
    this.edited.emit();
  }

  protected syncArrayItemInput(items: string[], index: number, event: Event) {
    // Native contenteditable input must remain DOM-owned while typing. Updating
    // the Angular interpolation on every keypress rewrites its text node and
    // moves the browser caret back to the beginning. The paste handler emits an
    // untrusted input event specifically to synchronize its manual DOM change.
    if (!this.editable || event.isTrusted) return;
    const target = event.currentTarget as HTMLElement;
    items[index] = target.innerText.replace(/\u00a0/g, ' ');
  }

  protected textStyle(key: string, role: ResumeColorRole) {
    const typography = this.resume?.typography ?? {};
    const field = this.resume?.fieldTypography?.[key] ?? {};
    const value = { ...typography, ...field };
    const sizes: Record<ResumeColorRole, string> = {
      name: 'name',
      headline: 'headline',
      contact: 'contact',
      sectionTitle: 'section-title',
      organization: 'organization',
      role: 'role',
      meta: 'meta',
      description: 'body',
      bullet: 'body',
      skillLabel: 'skill-label',
      skillText: 'body',
    };
    return {
      'font-family': value.fontFamily ?? null,
      'font-size':
        field.fontSize != null
          ? `${field.fontSize}pt`
          : typography.fontScale != null
            ? `calc(var(--font-${sizes[role]}) * ${typography.fontScale})`
            : null,
      'font-weight': value.fontWeight ?? null,
      'font-style': value.fontStyle ?? null,
      'letter-spacing': value.letterSpacing != null ? `${value.letterSpacing}px` : null,
    };
  }

  protected fieldColor(key: string, role: ResumeColorRole) {
    return this.resume?.fieldColors?.[key] ?? this.colors[role];
  }

  protected selectColorField(event: FocusEvent) {
    if (!this.editable) return;
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-color-key]');
    const key = target?.dataset['colorKey'];
    const role = target?.dataset['colorRole'] as ResumeColorRole | undefined;
    if (!target || !key || !role) return;
    const rect = target.getBoundingClientRect();
    this.colorSelected.emit({
      key,
      role,
      label: target.dataset['colorLabel'] ?? 'Text',
      background: this.findBackgroundColor(target),
      left: rect.left,
      top: rect.bottom + 8,
      textSelected: false,
    });
  }

  @HostListener('document:selectionchange')
  protected captureTextSelection() {
    if (!this.editable) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const ancestor =
      range.commonAncestorContainer instanceof Element
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    const target = ancestor?.closest<HTMLElement>('[data-color-key][contenteditable="true"]');
    const key = target?.dataset['colorKey'];
    const role = target?.dataset['colorRole'] as ResumeColorRole | undefined;
    if (
      !target ||
      !key ||
      !role ||
      !target.contains(range.startContainer) ||
      !target.contains(range.endContainer)
    ) {
      return;
    }
    const before = document.createRange();
    before.selectNodeContents(target);
    before.setEnd(range.startContainer, range.startOffset);
    this.selectedTextOffsets = {
      start: before.toString().length,
      end: before.toString().length + range.toString().length,
    };
    this.selectedTextKey = key;
    const rect = range.getBoundingClientRect();
    const selectionElement =
      range.startContainer instanceof HTMLElement
        ? range.startContainer
        : range.startContainer.parentElement;
    const computedWeight = Number.parseInt(
      selectionElement ? window.getComputedStyle(selectionElement).fontWeight : '400',
      10,
    );
    this.colorSelected.emit({
      key,
      role,
      label: target.dataset['colorLabel'] ?? 'Text',
      background: this.findBackgroundColor(target),
      left: rect.left + rect.width / 2,
      top: rect.top,
      textSelected: true,
      fontWeight: Number.isFinite(computedWeight) ? computedWeight : 400,
    });
  }

  applyInlineStyle(command: { kind: 'weight' | 'italic'; value: number | boolean }) {
    const key = this.selectedTextKey;
    const target = key
      ? this.host.nativeElement.querySelector<HTMLElement>(
          `[data-color-key="${CSS.escape(key)}"][contenteditable="true"]`,
        )
      : null;
    const liveSelection = window.getSelection();
    const liveRange = liveSelection?.rangeCount ? liveSelection.getRangeAt(0) : undefined;
    const range =
      target &&
      liveRange &&
      !liveRange.collapsed &&
      target.contains(liveRange.startContainer) &&
      target.contains(liveRange.endContainer)
        ? liveRange.cloneRange()
        : target && this.selectedTextOffsets
          ? this.rangeFromOffsets(
              target,
              this.selectedTextOffsets.start,
              this.selectedTextOffsets.end,
            )
          : undefined;
    if (!range || !target || range.collapsed) return;

    const selection = liveSelection;
    selection?.removeAllRanges();
    selection?.addRange(range);
    if (command.kind === 'italic') {
      document.execCommand('italic', false);
    } else {
      const span = document.createElement('span');
      span.style.fontWeight = String(command.value);
      const contents = range.extractContents();
      for (const element of [...contents.querySelectorAll('b, strong, span')]) {
        if (element instanceof HTMLElement && element.tagName === 'SPAN') {
          element.style.removeProperty('font-weight');
          if (element.getAttribute('style')) continue;
        }
        element.replaceWith(...element.childNodes);
      }
      span.append(contents);
      range.insertNode(span);
      for (const emptySpan of [...target.querySelectorAll('span:empty')]) emptySpan.remove();
      const parent = span.parentElement;
      if (
        parent &&
        parent !== target &&
        ['B', 'STRONG', 'SPAN'].includes(parent.tagName) &&
        parent.textContent === span.textContent
      ) {
        parent.replaceWith(span);
      }
      range.selectNodeContents(span);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    this.selectedTextOffsets = {
      start: this.selectedTextOffsets?.start ?? 0,
      end: (this.selectedTextOffsets?.start ?? 0) + range.toString().length,
    };
    this.storeRichText(target);
    this.edited.emit();
  }

  protected syncRichTextFromInput(event: Event) {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      '[data-color-key][contenteditable="true"]',
    );
    if (target) this.storeRichText(target);
  }

  protected bulletColorPrefix(sectionId: string, positionId: string) {
    return `section:${sectionId}:position:${positionId}:bullet`;
  }

  protected bulletColorKey(sectionId: string, positionId: string, index: number) {
    return `${this.bulletColorPrefix(sectionId, positionId)}:${index}`;
  }

  protected simpleItemColorPrefix(sectionId: string) {
    return `section:${sectionId}:item`;
  }

  protected simpleItemColorKey(sectionId: string, index: number) {
    return `${this.simpleItemColorPrefix(sectionId)}:${index}`;
  }

  protected listItemKeydown(
    event: KeyboardEvent,
    items: string[],
    index: number,
    colorPrefix: string,
  ) {
    if (!this.editable) return;
    const target = event.currentTarget as HTMLElement;
    const value = target.innerText.replace(/\u00a0/g, ' ').trim();

    if (event.key === 'Enter') {
      // IMEs use Enter to confirm composed text. Treating that confirmation as
      // list navigation creates an extra item and can replay the committed text.
      if (event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      // The new editable is focused on the next task so Angular can render it
      // first. Ignore another Enter received by the old node in that short gap.
      if (event.repeat || target.dataset['listInsertPending'] === 'true') return;
      target.dataset['listInsertPending'] = 'true';
      target.dataset['skipBlur'] = 'true';
      // Native typing adds a text node beside Angular's interpolation node.
      // Collapse both into one node before changing the bound array value, or
      // Angular updates its old node too and visibly duplicates the bullet.
      this.syncEditableText(target, value);
      items[index] = value;
      if (value) {
        this.addListItem(items, index + 1, colorPrefix);
      } else {
        if (items.length > 1) {
          items.splice(index, 1);
          this.shiftIndexedFieldColors(colorPrefix, index, -1);
        }
        this.edited.emit();
        this.focusOutsideList(target);
      }
      window.setTimeout(() => delete target.dataset['listInsertPending']);
      return;
    }

    if (event.key === 'Backspace' && !value && items.length > 1) {
      event.preventDefault();
      target.dataset['skipBlur'] = 'true';
      this.removeListItem(items, index, colorPrefix, Math.max(0, index - 1));
    }
  }

  protected addListItem(items: string[], index: number, colorPrefix: string) {
    const insertionIndex = Math.min(index, items.length);
    this.shiftIndexedFieldColors(colorPrefix, insertionIndex, 1);
    items.splice(insertionIndex, 0, '');
    this.edited.emit();
    this.focusColorKey(`${colorPrefix}:${insertionIndex}`);
  }

  protected addExperienceCompany(
    section: Extract<ResumeSection, { type: 'experience' }>,
    index: number,
  ) {
    const item = {
      id: crypto.randomUUID(),
      company: 'Company',
      location: 'Location',
      positions: [
        {
          id: crypto.randomUUID(),
          title: 'Position',
          startDate: 'Start',
          endDate: 'End',
          bullets: ['Describe your impact.'],
        },
      ],
    };
    section.items.splice(Math.min(index, section.items.length), 0, item);
    this.edited.emit();
    this.focusColorKey(`section:${section.id}:experience:${item.id}:company`);
  }

  protected removeExperienceCompany(
    section: Extract<ResumeSection, { type: 'experience' }>,
    index: number,
  ) {
    if (section.items.length <= 1) return;
    const [removed] = section.items.splice(index, 1);
    if (!removed) return;
    const removedPrefixes = [
      `section:${section.id}:experience:${removed.id}:`,
      ...removed.positions.flatMap((position) => [
        `section:${section.id}:position:${position.id}:`,
      ]),
    ];
    if (this.resume?.fieldColors) {
      this.resume.fieldColors = Object.fromEntries(
        Object.entries(this.resume.fieldColors).filter(
          ([key]) => !removedPrefixes.some((prefix) => key.startsWith(prefix)),
        ),
      );
    }
    if (this.resume?.fieldTypography) {
      this.resume.fieldTypography = Object.fromEntries(
        Object.entries(this.resume.fieldTypography).filter(
          ([key]) => !removedPrefixes.some((prefix) => key.startsWith(prefix)),
        ),
      );
    }
    if (this.resume?.richText) {
      this.resume.richText = Object.fromEntries(
        Object.entries(this.resume.richText).filter(
          ([key]) => !removedPrefixes.some((prefix) => key.startsWith(prefix)),
        ),
      );
    }
    this.edited.emit();
  }

  protected removeListItem(
    items: string[],
    index: number,
    colorPrefix: string,
    focusIndex = Math.max(0, index - 1),
  ) {
    if (items.length <= 1) return;
    items.splice(index, 1);
    this.shiftIndexedFieldColors(colorPrefix, index, -1);
    this.edited.emit();
    this.focusColorKey(`${colorPrefix}:${Math.min(focusIndex, items.length - 1)}`);
  }

  protected editStringList(target: object, field: string, event: Event) {
    if (!this.editable) return;
    const value = this.readText(event);
    this.syncEditableText(event.currentTarget as HTMLElement, value);
    (target as Record<string, unknown>)[field] = value
      .split(/[·,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    this.edited.emit();
  }

  protected singleLine(event: KeyboardEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).blur();
  }

  protected pastePlainText(event: ClipboardEvent) {
    if (!this.editable) return;

    const eventTarget = event.target;
    const target =
      eventTarget instanceof Element
        ? eventTarget.closest<HTMLElement>('[contenteditable="true"]')
        : null;
    const clipboardText = event.clipboardData?.getData('text/plain');
    if (!target || clipboardText == null) {
      return;
    }

    event.preventDefault();
    const allowsMultipleLines = target.dataset['pasteMultiline'] === 'true';
    const text = allowsMultipleLines
      ? clipboardText.replace(/\r\n?/g, '\n').trim()
      : clipboardText.replace(/\s+/g, ' ').trim();
    const maxLength = Number(target.dataset['maxLength'] ?? 0);
    const selection = window.getSelection();
    const selectedLength =
      selection?.rangeCount && target.contains(selection.anchorNode)
        ? selection.getRangeAt(0).toString().length
        : 0;
    const availableLength = maxLength
      ? Math.max(0, maxLength - target.innerText.length + selectedLength)
      : text.length;
    this.lastValidText.set(target, target.innerText);
    this.insertTextAtCaret(target, text.slice(0, availableLength));
    const maxLines = Number(target.dataset['maxLines'] ?? 0);
    if (maxLines) {
      this.enforceTextLayout({ currentTarget: target } as unknown as Event, maxLength, maxLines);
    }
    // The paste operation splits Angular's interpolation text node. Merge the
    // result immediately, before the paste event finishes and change detection
    // can reconcile the old interpolation with the manually inserted node.
    const pastedValue = target.innerText.replace(/\u00a0/g, ' ');
    const caretOffset = this.caretOffsetWithin(target);
    this.syncEditableText(target, pastedValue);
    this.placeCaretAtOffset(target, caretOffset);
    if (target.dataset['pasteSync'] === 'true') {
      target.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: text.slice(0, availableLength),
        }),
      );
    }
  }

  private renderedLineCount(target: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(target);
    const lineTops = new Set(
      [...range.getClientRects()]
        .filter((rect) => rect.width > 0)
        .map((rect) => Math.round(rect.top)),
    );
    return Math.max(1, lineTops.size);
  }

  private placeCaretAtEnd(target: HTMLElement) {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private caretOffsetWithin(target: HTMLElement) {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !target.contains(selection.anchorNode)) {
      return target.textContent?.length ?? 0;
    }
    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(target);
    range.setEnd(selection.anchorNode!, selection.anchorOffset);
    return range.toString().length;
  }

  private placeCaretAtOffset(target: HTMLElement, offset: number) {
    const selection = window.getSelection();
    if (!selection) return;
    const textNode = target.firstChild;
    if (!(textNode instanceof Text)) {
      this.placeCaretAtEnd(target);
      return;
    }
    const range = document.createRange();
    range.setStart(textNode, Math.min(offset, textNode.length));
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private readText(event: Event) {
    return (event.currentTarget as HTMLElement).innerText.replace(/\u00a0/g, ' ').trim();
  }

  /**
   * Angular renders editable values as interpolation text nodes. Manual paste
   * can split that node and add another one, so collapse the DOM before the
   * model update causes Angular to refresh the interpolation.
   */
  private syncEditableText(target: HTMLElement, value: string) {
    this.storeRichText(target);
    // Assign even when the string is unchanged: paste can split Angular's
    // interpolation node into several nodes whose combined text is identical.
    target.textContent = value;
  }

  private hydrateRichText() {
    if (!this.resume?.richText) return;
    for (const [key, html] of Object.entries(this.resume.richText)) {
      const target = this.host.nativeElement.querySelector<HTMLElement>(
        `[data-color-key="${CSS.escape(key)}"][contenteditable="true"]`,
      );
      if (target && target.innerHTML !== html && document.activeElement !== target) {
        target.innerHTML = html;
      }
    }
  }

  private storeRichText(target: HTMLElement) {
    const key = target.dataset['colorKey'];
    if (!this.resume || !key) return;
    const html = this.sanitizeRichText(target.innerHTML);
    const plain = target.innerText.replace(/\u00a0/g, ' ');
    const unformatted = document.createElement('div');
    unformatted.textContent = plain;
    const next = { ...this.resume.richText };
    if (html === unformatted.innerHTML || !/<(?:b|strong|i|em|span)\b/i.test(html))
      delete next[key];
    else next[key] = html;
    this.resume.richText = next;
  }

  private sanitizeRichText(html: string) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'SPAN', 'BR']);
    for (const element of [...wrapper.querySelectorAll('*')]) {
      if (!allowed.has(element.tagName)) {
        element.replaceWith(...element.childNodes);
        continue;
      }
      const weight = element instanceof HTMLElement ? element.style.fontWeight : '';
      const style = element instanceof HTMLElement ? element.style.fontStyle : '';
      for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
      if (element.tagName === 'SPAN' && element instanceof HTMLElement) {
        if (/^(?:[1-9]00|normal|bold)$/.test(weight)) element.style.fontWeight = weight;
        if (/^(?:normal|italic)$/.test(style)) element.style.fontStyle = style;
        if (!element.getAttribute('style')) element.replaceWith(...element.childNodes);
      }
    }
    return wrapper.innerHTML;
  }

  private rangeFromOffsets(target: HTMLElement, start: number, end: number) {
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let offset = 0;
    let startSet = false;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const length = node.textContent?.length ?? 0;
      if (!startSet && start <= offset + length) {
        range.setStart(node, Math.max(0, start - offset));
        startSet = true;
      }
      if (startSet && end <= offset + length) {
        range.setEnd(node, Math.max(0, end - offset));
        return range;
      }
      offset += length;
    }
    return undefined;
  }

  private insertTextAtCaret(target: HTMLElement, text: string) {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !target.contains(selection.anchorNode)) {
      target.textContent = `${target.textContent ?? ''}${text}`;
      return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private shiftIndexedFieldColors(prefix: string, fromIndex: number, delta: -1 | 1) {
    this.shiftIndexedFieldTypography(prefix, fromIndex, delta);
    this.shiftIndexedRichText(prefix, fromIndex, delta);
    if (!this.resume?.fieldColors) return;
    const next = { ...this.resume.fieldColors };
    const entries = Object.entries(next)
      .filter(([key]) => key.startsWith(`${prefix}:`))
      .map(([key, value]) => ({ key, value, index: Number(key.slice(prefix.length + 1)) }))
      .filter((entry) => Number.isInteger(entry.index) && entry.index >= fromIndex)
      .sort((a, b) => (delta > 0 ? b.index - a.index : a.index - b.index));

    if (delta < 0) delete next[`${prefix}:${fromIndex}`];
    for (const entry of entries) {
      if (delta < 0 && entry.index === fromIndex) continue;
      delete next[entry.key];
      next[`${prefix}:${entry.index + delta}`] = entry.value;
    }
    this.resume.fieldColors = next;
  }

  private shiftIndexedFieldTypography(prefix: string, fromIndex: number, delta: -1 | 1) {
    if (!this.resume?.fieldTypography) return;
    const next = { ...this.resume.fieldTypography };
    const entries = Object.entries(next)
      .filter(([key]) => key.startsWith(`${prefix}:`))
      .map(([key, value]) => ({ key, value, index: Number(key.slice(prefix.length + 1)) }))
      .filter((entry) => Number.isInteger(entry.index) && entry.index >= fromIndex)
      .sort((a, b) => (delta > 0 ? b.index - a.index : a.index - b.index));

    if (delta < 0) delete next[`${prefix}:${fromIndex}`];
    for (const entry of entries) {
      if (delta < 0 && entry.index === fromIndex) continue;
      delete next[entry.key];
      next[`${prefix}:${entry.index + delta}`] = entry.value;
    }
    this.resume.fieldTypography = next;
  }

  private shiftIndexedRichText(prefix: string, fromIndex: number, delta: -1 | 1) {
    if (!this.resume?.richText) return;
    const next = { ...this.resume.richText };
    const entries = Object.entries(next)
      .filter(([key]) => key.startsWith(`${prefix}:`))
      .map(([key, value]) => ({ key, value, index: Number(key.slice(prefix.length + 1)) }))
      .filter((entry) => Number.isInteger(entry.index) && entry.index >= fromIndex)
      .sort((a, b) => (delta > 0 ? b.index - a.index : a.index - b.index));
    if (delta < 0) delete next[`${prefix}:${fromIndex}`];
    for (const entry of entries) {
      if (delta < 0 && entry.index === fromIndex) continue;
      delete next[entry.key];
      next[`${prefix}:${entry.index + delta}`] = entry.value;
    }
    this.resume.richText = next;
  }

  private focusColorKey(key: string) {
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-color-key="${CSS.escape(key)}"]`)?.focus();
    });
  }

  private focusOutsideList(target: HTMLElement) {
    const editables = [...document.querySelectorAll<HTMLElement>('[contenteditable="true"]')];
    const list = target.closest('ul');
    const currentIndex = editables.indexOf(target);
    const next = editables.slice(currentIndex + 1).find((item) => !list?.contains(item));
    target.blur();
    window.setTimeout(() => next?.focus());
  }

  private findBackgroundColor(target: HTMLElement) {
    let current: HTMLElement | null = target;
    while (current) {
      const color = getComputedStyle(current).backgroundColor;
      if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
      current = current.parentElement;
    }
    return '#ffffff';
  }

  private isSideColumnSection(section: ResumeSection) {
    return ['skills', 'languages', 'interests', 'certifications', 'awards', 'custom'].includes(
      section.type,
    );
  }
}
