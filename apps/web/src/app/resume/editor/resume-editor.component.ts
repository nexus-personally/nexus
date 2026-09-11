import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideTrash2, LucideUpload, LucideUserRound } from '@lucide/angular';
import type {
  ResumeRecord,
  ResumeSection,
  ResumeSectionType,
  ResumeTemplateId,
} from '@nexus/shared';
import { RESUME_TEMPLATES, RESUME_THEMES } from '@nexus/shared';
import { ApiService } from '../../core/api.service';
import { prepareProfilePhoto } from '../profile-photo';
import { ResumeRendererComponent } from '../renderer/resume-renderer.component';

@Component({
  selector: 'nexus-resume-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ResumeRendererComponent,
    LucideTrash2,
    LucideUpload,
    LucideUserRound,
  ],
  template: `
    @if (resume) {
      <main class="editor-shell">
        <header class="command-bar">
          <div class="document-identity">
            <a routerLink="/resume" class="back-button" aria-label="Back to dashboard">←</a>
            <span class="studio-mark">N</span>
            <input
              [(ngModel)]="resume.name"
              (ngModelChange)="markDirty()"
              aria-label="Resume name"
            />
          </div>

          <div class="document-controls">
            <label>
              <span>Template</span>
              <select
                [(ngModel)]="resume.templateId"
                (ngModelChange)="markDirty()"
                aria-label="Template"
              >
                @for (template of templates; track template.id) {
                  <option [value]="template.id">{{ template.name }}</option>
                }
              </select>
            </label>
            <div class="theme-swatches" role="group" aria-label="Resume accent color">
              @for (theme of themes; track theme.id) {
                <button
                  type="button"
                  [class.selected]="resume.themeId === theme.id"
                  [style.--swatch]="theme.accent"
                  [title]="theme.name"
                  [attr.aria-label]="theme.name"
                  (click)="setTheme(theme.id)"
                ></button>
              }
            </div>
          </div>

          <div class="save-controls">
            <span
              class="save-state"
              [class.unsaved]="saveState.includes('Unsaved') || saveState.includes('Unable')"
              ><i></i>{{ saveState }}</span
            >
            <button type="button" (click)="save()">Save</button>
            <button class="publish" type="button" (click)="publish()">Publish</button>
            <button
              class="more-button"
              type="button"
              (click)="unpublish()"
              title="Unpublish public link"
              aria-label="Unpublish public link"
            >
              •••
            </button>
          </div>
        </header>

        <div class="editor-workspace">
          <aside class="structure-panel">
            <header>
              <div>
                <span>DOCUMENT</span>
                <h2>Sections</h2>
              </div>
              <small>{{ visibleSectionCount }}/{{ orderedSections.length }}</small>
            </header>

            <section class="profile-photo-control" aria-labelledby="profile-photo-title">
              <div class="profile-photo-heading">
                <span id="profile-photo-title">PROFILE PHOTO</span>
                <small>Optional</small>
              </div>
              <div class="profile-photo-row">
                @if (resume.content.profile.photoDataUrl) {
                  <img
                    [src]="resume.content.profile.photoDataUrl"
                    [alt]="resume.content.profile.fullName + ' profile photo'"
                  />
                } @else {
                  <span class="profile-photo-placeholder"
                    ><svg lucideUserRound size="20"></svg
                  ></span>
                }
                <div>
                  <input
                    #editorPhotoInput
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    (change)="onPhotoSelected($event)"
                  />
                  <button type="button" (click)="editorPhotoInput.click()">
                    <svg lucideUpload size="14"></svg>
                    {{ resume.content.profile.photoDataUrl ? 'Replace' : 'Upload' }}
                  </button>
                  @if (resume.content.profile.photoDataUrl) {
                    <button
                      class="photo-delete"
                      type="button"
                      title="Remove profile photo"
                      aria-label="Remove profile photo"
                      (click)="removePhoto()"
                    >
                      <svg lucideTrash2 size="14"></svg>
                    </button>
                  }
                </div>
              </div>
              <label class="photo-visibility">
                <span>Show in supported templates</span>
                <input
                  type="checkbox"
                  [(ngModel)]="resume.content.profile.photoVisible"
                  [disabled]="!resume.content.profile.photoDataUrl"
                  (ngModelChange)="markDirty()"
                />
              </label>
              @if (photoError) {
                <p class="photo-error">{{ photoError }}</p>
              }
            </section>

            <div class="section-list">
              @for (section of orderedSections; track section.id) {
                <div
                  class="section-row"
                  [class.active]="selectedSectionId === section.id"
                  [class.hidden]="section.hidden"
                  draggable="true"
                  (dragstart)="startDrag(section.id)"
                  (dragover)="allowDrop($event)"
                  (drop)="dropOn(section.id)"
                >
                  <button
                    class="section-main"
                    type="button"
                    (click)="selectedSectionId = section.id"
                  >
                    <span class="drag-handle" aria-hidden="true">⋮⋮</span>
                    <span
                      ><strong>{{ section.title }}</strong
                      ><small>{{ section.type }}</small></span
                    >
                  </button>
                  <div class="section-actions">
                    <button
                      type="button"
                      (click)="move(section.id, -1)"
                      title="Move up"
                      [attr.aria-label]="'Move ' + section.title + ' up'"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      (click)="move(section.id, 1)"
                      title="Move down"
                      [attr.aria-label]="'Move ' + section.title + ' down'"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      (click)="toggleHidden(section)"
                      [title]="section.hidden ? 'Show section' : 'Hide section'"
                      [attr.aria-label]="(section.hidden ? 'Show ' : 'Hide ') + section.title"
                    >
                      {{ section.hidden ? '○' : '●' }}
                    </button>
                    <button
                      type="button"
                      (click)="duplicateSection(section)"
                      title="Duplicate section"
                      [attr.aria-label]="'Duplicate ' + section.title"
                    >
                      ＋
                    </button>
                    <button
                      class="danger"
                      type="button"
                      (click)="deleteSection(section)"
                      title="Delete section"
                      [attr.aria-label]="'Delete ' + section.title"
                    >
                      ×
                    </button>
                  </div>
                </div>
              }
            </div>

            <div class="add-section">
              <select [(ngModel)]="newSectionType" aria-label="Section type">
                @for (option of sectionOptions; track option.type) {
                  <option [value]="option.type">{{ option.label }}</option>
                }
              </select>
              <button type="button" (click)="addSection()">Add</button>
            </div>

            <footer>
              <span>PAGE</span>
              <strong>A4 / 210 × 297 mm</strong>
            </footer>
          </aside>

          <section class="page-stage">
            <div class="page-meta">
              <span>PAGE 01</span><span>{{ templateName(resume.templateId) }}</span>
            </div>
            <nexus-resume-renderer [resume]="resume" [editable]="true" (edited)="markDirty()" />
          </section>
        </div>
      </main>
    } @else {
      <main class="loading-state">
        <span>N</span>
        <p>Loading workspace</p>
      </main>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        background: #dfe4e2;
        color: #1d2224;
      }
      .editor-shell {
        min-height: 100svh;
      }
      .command-bar {
        position: sticky;
        top: 0;
        z-index: 8;
        display: grid;
        grid-template-columns: minmax(16rem, 1fr) auto minmax(18rem, 1fr);
        min-height: 4rem;
        align-items: center;
        gap: 1rem;
        padding: 0 1rem;
        background: #f8faf9;
        border-bottom: 1px solid #cbd2cf;
        box-shadow: 0 2px 12px rgba(20, 29, 30, 0.05);
      }
      .document-identity,
      .document-controls,
      .save-controls {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        min-width: 0;
      }
      .document-controls {
        justify-content: center;
      }
      .save-controls {
        justify-content: flex-end;
      }
      button,
      input,
      select {
        font: inherit;
      }
      button {
        border: 1px solid #c4ccc8;
        border-radius: 5px;
        padding: 0.5rem 0.7rem;
        background: #ffffff;
        color: #252a2c;
        cursor: pointer;
      }
      .back-button {
        display: grid;
        width: 2.2rem;
        height: 2.2rem;
        place-items: center;
        color: #303638;
        text-decoration: none;
      }
      .studio-mark {
        display: grid;
        width: 2rem;
        height: 2rem;
        place-items: center;
        background: #111618;
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 800;
      }
      .document-identity input {
        min-width: 0;
        width: min(18rem, 28vw);
        border: 0;
        padding: 0.45rem;
        background: transparent;
        color: #1c2123;
        font-weight: 650;
      }
      .document-identity input:hover,
      .document-identity input:focus {
        background: #eef1f0;
        outline: none;
      }
      .document-controls label {
        display: grid;
        grid-template-columns: auto auto;
        align-items: center;
        gap: 0.45rem;
        color: #76807d;
        font-size: 0.68rem;
      }
      .document-controls select,
      .add-section select {
        border: 1px solid #c4ccc8;
        border-radius: 5px;
        padding: 0.48rem 1.8rem 0.48rem 0.6rem;
        background: #ffffff;
        color: #252a2c;
      }
      .theme-swatches {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding-left: 0.55rem;
        border-left: 1px solid #d7dcda;
      }
      .theme-swatches button {
        position: relative;
        width: 1.65rem;
        height: 1.65rem;
        padding: 0;
        border-color: transparent;
        border-radius: 50%;
        background: var(--swatch);
      }
      .theme-swatches button.selected::after {
        content: '';
        position: absolute;
        inset: -4px;
        border: 1px solid #606b68;
        border-radius: 50%;
      }
      .save-state {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        max-width: 14rem;
        overflow: hidden;
        color: #69736f;
        font-size: 0.68rem;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .save-state i {
        flex: 0 0 auto;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #65ad8c;
      }
      .save-state.unsaved i {
        background: #cc9951;
      }
      .publish {
        border-color: #171c1e;
        background: #171c1e;
        color: #ffffff;
        font-weight: 650;
      }
      .more-button {
        width: 2.2rem;
        padding-inline: 0;
        color: #66706d;
      }
      .editor-workspace {
        display: grid;
        grid-template-columns: 17rem minmax(0, 1fr);
        min-height: calc(100svh - 4rem);
      }
      .structure-panel {
        position: sticky;
        top: 4rem;
        display: flex;
        height: calc(100svh - 4rem);
        flex-direction: column;
        background: #f4f6f5;
        border-right: 1px solid #c9d0cd;
      }
      .structure-panel > header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        padding: 1.25rem 1rem 0.9rem;
        border-bottom: 1px solid #d6dcda;
      }
      .structure-panel header span,
      .structure-panel footer span {
        color: #6b898b;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.58rem;
        letter-spacing: 0.08em;
      }
      .structure-panel h2 {
        margin: 0.25rem 0 0;
        font-size: 1rem;
      }
      .structure-panel header > small {
        color: #7d8783;
        font-size: 0.68rem;
      }
      .section-list {
        flex: 1;
        overflow: auto;
        padding: 0.65rem;
      }
      .profile-photo-control {
        display: grid;
        gap: 0.6rem;
        padding: 0.8rem 1rem;
        border-bottom: 1px solid #d6dcda;
        background: #eef2f0;
      }
      .profile-photo-heading,
      .profile-photo-row,
      .photo-visibility {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.55rem;
      }
      .profile-photo-heading > span {
        color: #6b898b;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.58rem;
        letter-spacing: 0.08em;
      }
      .profile-photo-heading small,
      .photo-visibility {
        color: #7a8581;
        font-size: 0.62rem;
      }
      .profile-photo-row {
        justify-content: flex-start;
      }
      .profile-photo-row img,
      .profile-photo-placeholder {
        display: grid;
        width: 2.8rem;
        height: 2.8rem;
        flex: 0 0 auto;
        place-items: center;
        border-radius: 50%;
        object-fit: cover;
      }
      .profile-photo-row img {
        border: 2px solid #75bcc2;
      }
      .profile-photo-placeholder {
        background: #dce4e1;
        color: #65736f;
      }
      .profile-photo-row > div {
        display: flex;
        gap: 0.3rem;
      }
      .profile-photo-row input {
        display: none;
      }
      .profile-photo-row button {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.42rem 0.55rem;
        font-size: 0.66rem;
      }
      .profile-photo-row .photo-delete {
        width: 2rem;
        justify-content: center;
        padding-inline: 0;
        color: #9a5148;
      }
      .photo-visibility input {
        accent-color: #278e97;
      }
      .photo-error {
        margin: 0;
        color: #a04740;
        font-size: 0.62rem;
        line-height: 1.4;
      }
      .section-row {
        margin-bottom: 0.35rem;
        border: 1px solid transparent;
        border-radius: 5px;
        background: #ffffff;
      }
      .section-row.active {
        border-color: #7aa7aa;
        box-shadow: 0 0 0 1px rgba(122, 167, 170, 0.18);
      }
      .section-row.hidden {
        opacity: 0.52;
      }
      .section-main {
        display: grid;
        grid-template-columns: 1.2rem 1fr;
        align-items: center;
        gap: 0.45rem;
        width: 100%;
        padding: 0.62rem;
        border: 0;
        background: transparent;
        text-align: left;
      }
      .section-main > span:last-child {
        display: grid;
        min-width: 0;
        gap: 0.1rem;
      }
      .section-main strong {
        overflow: hidden;
        font-size: 0.76rem;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .section-main small {
        color: #7c8582;
        font-size: 0.58rem;
        text-transform: uppercase;
      }
      .drag-handle {
        color: #9aa3a0;
        cursor: grab;
      }
      .section-actions {
        display: none;
        grid-template-columns: repeat(5, 1fr);
        padding: 0.2rem 0.35rem 0.4rem 2rem;
      }
      .section-row.active .section-actions,
      .section-row:focus-within .section-actions {
        display: grid;
      }
      .section-actions button {
        height: 1.7rem;
        padding: 0;
        border: 0;
        background: transparent;
        color: #6c7672;
        font-size: 0.7rem;
      }
      .section-actions .danger {
        color: #9a5148;
      }
      .add-section {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.4rem;
        padding: 0.75rem;
        border-top: 1px solid #d6dcda;
      }
      .add-section select {
        min-width: 0;
        width: 100%;
        font-size: 0.7rem;
      }
      .add-section button {
        font-size: 0.7rem;
        font-weight: 700;
      }
      .structure-panel > footer {
        display: grid;
        gap: 0.15rem;
        padding: 0.8rem 1rem 1rem;
        color: #66716d;
        font-size: 0.65rem;
      }
      .page-stage {
        min-width: 0;
        overflow: auto;
        padding: 2rem clamp(1rem, 4vw, 4rem) 5rem;
      }
      .page-meta {
        display: flex;
        width: min(100%, 210mm);
        justify-content: space-between;
        margin: 0 auto 0.65rem;
        color: #64706d;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.58rem;
        letter-spacing: 0.05em;
      }
      .loading-state {
        display: grid;
        min-height: 100svh;
        place-items: center;
        align-content: center;
        gap: 0.75rem;
        background: #111618;
        color: #ffffff;
      }
      .loading-state span {
        display: grid;
        width: 3rem;
        height: 3rem;
        place-items: center;
        border: 1px solid #557176;
        font-weight: 800;
      }
      .loading-state p {
        margin: 0;
        color: #8fa0a2;
        font-size: 0.75rem;
      }
      @media (max-width: 1100px) {
        .command-bar {
          grid-template-columns: 1fr auto;
          padding-block: 0.65rem;
        }
        .document-controls {
          grid-column: 1 / -1;
          grid-row: 2;
          justify-content: flex-start;
        }
        .editor-workspace {
          grid-template-columns: 14rem minmax(0, 1fr);
        }
        .structure-panel {
          top: 6.8rem;
          height: calc(100svh - 6.8rem);
        }
      }
      @media (max-width: 760px) {
        .command-bar {
          position: relative;
          display: flex;
          flex-wrap: wrap;
        }
        .document-identity {
          flex: 1 1 100%;
        }
        .document-identity input {
          width: 100%;
        }
        .document-controls,
        .save-controls {
          flex: 1 1 auto;
        }
        .save-state {
          display: none;
        }
        .editor-workspace {
          grid-template-columns: 1fr;
        }
        .structure-panel {
          position: relative;
          top: 0;
          height: auto;
          max-height: 24rem;
        }
        .page-stage {
          padding: 1rem 0.5rem 3rem;
        }
      }
    `,
  ],
})
export class ResumeEditorComponent implements OnInit, OnDestroy {
  protected readonly templates = RESUME_TEMPLATES;
  protected readonly themes = RESUME_THEMES;
  protected readonly sectionOptions: Array<{ type: ResumeSectionType; label: string }> = [
    { type: 'summary', label: 'Summary' },
    { type: 'experience', label: 'Experience' },
    { type: 'education', label: 'Education' },
    { type: 'projects', label: 'Projects' },
    { type: 'skills', label: 'Skills' },
    { type: 'certifications', label: 'Certifications' },
    { type: 'languages', label: 'Languages' },
    { type: 'awards', label: 'Awards' },
    { type: 'interests', label: 'Interests' },
    { type: 'custom', label: 'Custom section' },
  ];
  protected resume?: ResumeRecord;
  protected saveState = 'Loading';
  protected selectedSectionId = '';
  protected newSectionType: ResumeSectionType = 'education';
  protected photoError = '';
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private saveTimer?: number;
  private draggedSectionId = '';

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const recovery = localStorage.getItem(this.recoveryKey(id));
    if (recovery) {
      this.resume = JSON.parse(recovery) as ResumeRecord;
      this.selectedSectionId = this.resume.sectionOrder[0] ?? '';
      this.saveState = 'Recovered local draft';
      return;
    }

    this.api.getResume(id).subscribe((resume) => {
      this.resume = resume;
      this.selectedSectionId = resume.sectionOrder[0] ?? '';
      this.saveState = 'Saved';
    });
  }

  ngOnDestroy() {
    window.clearTimeout(this.saveTimer);
  }

  protected get orderedSections(): ResumeSection[] {
    if (!this.resume) return [];
    const byId = new Map(this.resume.content.sections.map((section) => [section.id, section]));
    return this.resume.sectionOrder.flatMap((id) => {
      const section = byId.get(id);
      return section ? [section] : [];
    });
  }

  protected get visibleSectionCount() {
    return this.orderedSections.filter((section) => !section.hidden).length;
  }

  protected markDirty() {
    if (!this.resume) return;
    localStorage.setItem(this.recoveryKey(this.resume.id), JSON.stringify(this.resume));
    this.saveState = 'Unsaved local draft';
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), 900);
  }

  protected save() {
    if (!this.resume) return;
    this.saveState = 'Saving';
    this.api.saveResume(this.resume).subscribe({
      next: (saved) => {
        this.resume = saved;
        localStorage.removeItem(this.recoveryKey(saved.id));
        this.saveState = 'Saved';
      },
      error: () => {
        this.saveState = 'Unable to save. Changes are stored locally.';
      },
    });
  }

  protected move(sectionId: string, direction: -1 | 1) {
    if (!this.resume) return;
    const order = [...this.resume.sectionOrder];
    const index = order.indexOf(sectionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    this.resume.sectionOrder = order;
    this.markDirty();
  }

  protected startDrag(sectionId: string) {
    this.draggedSectionId = sectionId;
  }
  protected allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  protected dropOn(sectionId: string) {
    if (!this.resume || !this.draggedSectionId || this.draggedSectionId === sectionId) return;
    const order = [...this.resume.sectionOrder];
    const from = order.indexOf(this.draggedSectionId);
    const to = order.indexOf(sectionId);
    if (from < 0 || to < 0) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
    this.resume.sectionOrder = order;
    this.draggedSectionId = '';
    this.markDirty();
  }

  protected toggleHidden(section: ResumeSection) {
    section.hidden = !section.hidden;
    this.markDirty();
  }

  protected duplicateSection(section: ResumeSection) {
    if (!this.resume) return;
    const duplicate = structuredClone(section);
    duplicate.id = crypto.randomUUID();
    duplicate.title = section.title + ' Copy';
    this.resume.content.sections.push(duplicate);
    const index = this.resume.sectionOrder.indexOf(section.id);
    this.resume.sectionOrder.splice(index + 1, 0, duplicate.id);
    this.selectedSectionId = duplicate.id;
    this.markDirty();
  }

  protected deleteSection(section: ResumeSection) {
    if (!this.resume || !window.confirm('Delete the "' + section.title + '" section?')) return;
    this.resume.content.sections = this.resume.content.sections.filter(
      (item) => item.id !== section.id,
    );
    this.resume.sectionOrder = this.resume.sectionOrder.filter((id) => id !== section.id);
    this.selectedSectionId = this.resume.sectionOrder[0] ?? '';
    this.markDirty();
  }

  protected addSection() {
    if (!this.resume) return;
    const section = this.createSection(this.newSectionType);
    this.resume.content.sections.push(section);
    this.resume.sectionOrder.push(section.id);
    this.selectedSectionId = section.id;
    this.markDirty();
  }

  protected setTheme(themeId: string) {
    if (this.resume) {
      this.resume.themeId = themeId;
      this.markDirty();
    }
  }

  protected onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.resume) return;
    this.photoError = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.photoError = 'Choose a JPG, PNG or WebP image.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.photoError = 'The image must be smaller than 5 MB.';
      return;
    }
    prepareProfilePhoto(file)
      .then((dataUrl) => {
        if (!this.resume) return;
        this.resume.content.profile.photoDataUrl = dataUrl;
        this.resume.content.profile.photoVisible = true;
        this.markDirty();
      })
      .catch(() => (this.photoError = 'The image could not be read.'));
  }

  protected removePhoto() {
    if (!this.resume) return;
    this.resume.content.profile.photoDataUrl = undefined;
    this.resume.content.profile.photoVisible = false;
    this.photoError = '';
    this.markDirty();
  }
  protected templateName(id: ResumeTemplateId) {
    return this.templates.find((template) => template.id === id)?.name ?? id;
  }

  protected publish() {
    if (!this.resume) return;
    const slug = this.resume.content.profile.fullName || this.resume.name;
    this.api.publishResume(this.resume.id, slug).subscribe({
      next: (publication) => {
        this.saveState = 'Published at /r/' + publication.slug;
      },
      error: (error: { error?: { message?: string } }) => {
        this.saveState = error.error?.message ?? 'Publish failed.';
      },
    });
  }

  protected unpublish() {
    if (!this.resume) return;
    this.api.unpublishResume(this.resume.id).subscribe({
      next: () => {
        this.saveState = 'Public link disabled';
      },
      error: () => {
        this.saveState = 'No active publication to unpublish.';
      },
    });
  }

  private createSection(type: ResumeSectionType): ResumeSection {
    const id = crypto.randomUUID();
    if (type === 'summary')
      return {
        id,
        type,
        title: 'Summary',
        hidden: false,
        body: 'Add a concise professional summary.',
      };
    if (type === 'experience')
      return {
        id,
        type,
        title: 'Experience',
        hidden: false,
        items: [
          {
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
          },
        ],
      };
    if (type === 'education')
      return {
        id,
        type,
        title: 'Education',
        hidden: false,
        items: [
          {
            id: crypto.randomUUID(),
            school: 'School',
            degree: 'Degree',
            location: 'Location',
            dates: 'Dates',
          },
        ],
      };
    if (type === 'projects')
      return {
        id,
        type,
        title: 'Projects',
        hidden: false,
        items: [
          {
            id: crypto.randomUUID(),
            name: 'Project name',
            role: 'Role',
            description: 'Describe the project and its impact.',
            technologies: ['Technology'],
            dates: 'Dates',
          },
        ],
      };
    if (type === 'skills')
      return {
        id,
        type,
        title: 'Skills',
        hidden: false,
        groups: [{ id: crypto.randomUUID(), name: 'Category', skills: ['Skill'] }],
      };
    const labels: Record<string, string> = {
      certifications: 'Certifications',
      languages: 'Languages',
      awards: 'Awards',
      interests: 'Interests',
      custom: 'Custom Section',
    };
    return { id, type, title: labels[type], hidden: false, items: ['Add an item.'] };
  }

  private recoveryKey(id: string) {
    return 'nexus:resume-recovery:' + id;
  }
}
