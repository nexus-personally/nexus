import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LucideCheck,
  LucideCrop,
  LucidePalette,
  LucideRotateCcw,
  LucideTrash2,
  LucideUpload,
  LucideUserRound,
} from '@lucide/angular';
import type {
  ResumeColors,
  ResumePhotoCrop,
  ResumeRecord,
  ResumeSection,
  ResumeSectionType,
  ResumeTemplateId,
} from '@nexus/shared';
import {
  RESUME_TEMPLATE_COLOR_DEFAULTS,
  RESUME_TEMPLATES,
  resolveResumeColors,
} from '@nexus/shared';
import { ApiService } from '../../core/api.service';
import {
  cropProfilePhoto,
  drawProfilePhotoCrop,
  loadProfileImage,
  photoCropTravel,
  prepareProfilePhotoSource,
} from '../profile-photo';
import { ResumeRendererComponent } from '../renderer/resume-renderer.component';

type ColorTarget = keyof ResumeColors;

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
    LucidePalette,
    LucideCrop,
    LucideRotateCcw,
    LucideCheck,
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
            <div class="color-control">
              <button
                class="colors-button"
                type="button"
                [attr.aria-expanded]="colorsOpen"
                aria-controls="resume-colors-panel"
                (click)="colorsOpen = !colorsOpen"
              >
                <svg lucidePalette size="15"></svg>
                Colors
                <i [style.background]="currentColors.accent"></i>
              </button>
              @if (colorsOpen) {
                <section id="resume-colors-panel" class="colors-panel" aria-label="Resume colors">
                  <header>
                    <div>
                      <span>APPEARANCE</span>
                      <h2>Resume colors</h2>
                    </div>
                    <button
                      type="button"
                      aria-label="Close colors"
                      title="Close"
                      (click)="colorsOpen = false"
                    >
                      ×
                    </button>
                  </header>
                  @for (group of colorGroups; track group.key) {
                    <div class="color-group">
                      <div class="color-group-heading">
                        <strong>{{ group.label }}</strong>
                        <span
                          [class.low-contrast]="
                            contrastRatio(colorValue(group.key)) < group.minimum
                          "
                        >
                          {{ contrastRatio(colorValue(group.key)) }}:1
                        </span>
                      </div>
                      <div
                        class="preset-grid"
                        role="group"
                        [attr.aria-label]="group.label + ' presets'"
                      >
                        @for (preset of presetsFor(group.key); track preset) {
                          <button
                            type="button"
                            class="color-preset"
                            [class.selected]="colorValue(group.key) === preset"
                            [style.--swatch]="preset"
                            [title]="preset"
                            [attr.aria-label]="'Use ' + preset + ' for ' + group.label"
                            (click)="setColor(group.key, preset)"
                          ></button>
                        }
                      </div>
                      <div class="custom-color-row">
                        <input
                          type="color"
                          [value]="colorValue(group.key)"
                          [attr.aria-label]="'Custom ' + group.label + ' color'"
                          (input)="onNativeColor(group.key, $event)"
                        />
                        <input
                          class="hex-input"
                          [value]="colorValue(group.key)"
                          [attr.aria-label]="group.label + ' hex color'"
                          maxlength="7"
                          spellcheck="false"
                          (input)="onHexColor(group.key, $event)"
                        />
                      </div>
                      @if (contrastRatio(colorValue(group.key)) < group.minimum) {
                        <p class="contrast-warning">
                          Low contrast on white. This color is still allowed.
                        </p>
                      }
                    </div>
                  }
                  <button class="reset-colors" type="button" (click)="resetTemplateColors()">
                    <svg lucideRotateCcw size="14"></svg>
                    Reset to template defaults
                  </button>
                </section>
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
                    <button type="button" (click)="openCropEditor()">
                      <svg lucideCrop size="14"></svg>
                      Adjust
                    </button>
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
                <span>Show profile photo</span>
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
        @if (cropOpen) {
          <div class="crop-backdrop" (click)="closeCropEditor()">
            <section
              class="crop-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="crop-dialog-title"
              (click)="$event.stopPropagation()"
            >
              <header>
                <div>
                  <span>PROFILE PHOTO</span>
                  <h2 id="crop-dialog-title">Position and crop</h2>
                </div>
                <button
                  type="button"
                  aria-label="Close crop editor"
                  title="Close"
                  (click)="closeCropEditor()"
                >
                  ×
                </button>
              </header>
              <div
                class="crop-viewport"
                (pointerdown)="startCropDrag($event)"
                (pointermove)="moveCropDrag($event)"
                (pointerup)="endCropDrag($event)"
                (pointercancel)="endCropDrag($event)"
              >
                <canvas #cropCanvas width="480" height="480"></canvas>
                <span class="crop-safe-area" aria-hidden="true"></span>
              </div>
              <label class="zoom-control">
                <span>Zoom</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  [value]="cropDraft.zoom"
                  (input)="setCropZoom($event)"
                />
                <output>{{ cropDraft.zoom.toFixed(2) }}×</output>
              </label>
              <footer>
                <button type="button" (click)="resetCrop()">
                  <svg lucideRotateCcw size="14"></svg>
                  Reset
                </button>
                <span></span>
                <button type="button" (click)="closeCropEditor()">Cancel</button>
                <button
                  class="apply-crop"
                  type="button"
                  [disabled]="cropApplying"
                  (click)="applyCrop()"
                >
                  <svg lucideCheck size="14"></svg>
                  {{ cropApplying ? 'Applying' : 'Apply crop' }}
                </button>
              </footer>
            </section>
          </div>
        }
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
        border-radius: var(--radius-button, 25px);
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
      .color-control {
        position: relative;
      }
      .colors-button,
      .reset-colors,
      .crop-dialog footer button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
      }
      .colors-button i {
        width: 0.72rem;
        height: 0.72rem;
        border: 1px solid rgba(0, 0, 0, 0.18);
        border-radius: 50%;
      }
      .colors-panel {
        position: absolute;
        top: calc(100% + 0.75rem);
        left: 50%;
        z-index: 20;
        width: min(25rem, calc(100vw - 2rem));
        max-height: calc(100svh - 6rem);
        overflow: auto;
        padding: 1rem;
        border: 1px solid #bac4c0;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 18px 55px rgba(21, 29, 29, 0.2);
        transform: translateX(-50%);
      }
      .colors-panel > header,
      .crop-dialog > header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding-bottom: 0.8rem;
        border-bottom: 1px solid #e0e5e3;
      }
      .colors-panel header span,
      .crop-dialog header span {
        color: #71827d;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.56rem;
        letter-spacing: 0.08em;
      }
      .colors-panel h2,
      .crop-dialog h2 {
        margin: 0.2rem 0 0;
        font-size: 1rem;
      }
      .colors-panel header button,
      .crop-dialog header button {
        width: 2rem;
        height: 2rem;
        padding: 0;
        border-radius: 50%;
      }
      .color-group {
        padding: 0.85rem 0;
        border-bottom: 1px solid #edf0ef;
      }
      .color-group-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.55rem;
        font-size: 0.72rem;
      }
      .color-group-heading span {
        color: #658078;
        font-size: 0.63rem;
      }
      .color-group-heading span.low-contrast,
      .contrast-warning {
        color: #a04c43;
      }
      .preset-grid {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 0.42rem;
      }
      .preset-grid .color-preset {
        position: relative;
        width: 1.55rem;
        height: 1.55rem;
        padding: 0;
        border: 1px solid color-mix(in srgb, var(--swatch), black 15%);
        border-radius: 50%;
        background: var(--swatch);
      }
      .preset-grid .color-preset.selected::after {
        content: '';
        position: absolute;
        inset: -4px;
        border: 1px solid #202729;
        border-radius: 50%;
      }
      .custom-color-row {
        display: grid;
        grid-template-columns: 2.5rem minmax(0, 1fr);
        gap: 0.5rem;
        margin-top: 0.65rem;
      }
      .custom-color-row input[type='color'] {
        width: 2.5rem;
        height: 2rem;
        padding: 0.1rem;
        border: 1px solid #c4ccc8;
        border-radius: 5px;
        background: #ffffff;
        cursor: pointer;
      }
      .hex-input {
        min-width: 0;
        border: 1px solid #c4ccc8;
        border-radius: 5px;
        padding: 0.35rem 0.55rem;
        color: #242b2d;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.72rem;
        text-transform: uppercase;
      }
      .contrast-warning {
        margin: 0.45rem 0 0;
        font-size: 0.62rem;
      }
      .reset-colors {
        width: 100%;
        margin-top: 0.9rem;
        font-size: 0.7rem;
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
        border-radius: 50%;
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
        border-radius: 50%;
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
        border-radius: inherit;
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
        border-radius: 50%;
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
      .crop-backdrop {
        position: fixed;
        inset: 0;
        z-index: 40;
        display: grid;
        place-items: center;
        padding: 1rem;
        background: rgba(12, 17, 18, 0.68);
      }
      .crop-dialog {
        width: min(31rem, 100%);
        max-height: calc(100svh - 2rem);
        overflow: auto;
        padding: 1.1rem;
        border-radius: 8px;
        background: #f8faf9;
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.34);
      }
      .crop-viewport {
        position: relative;
        width: min(100%, 25rem);
        aspect-ratio: 1;
        margin: 1rem auto;
        overflow: hidden;
        background: #171d1f;
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      .crop-viewport:active {
        cursor: grabbing;
      }
      .crop-viewport canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
      .crop-safe-area {
        position: absolute;
        inset: 4%;
        border: 2px solid rgba(255, 255, 255, 0.92);
        border-radius: 50%;
        box-shadow: 0 0 0 999px rgba(9, 14, 15, 0.3);
        pointer-events: none;
      }
      .zoom-control {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) 3rem;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.72rem;
      }
      .zoom-control input {
        accent-color: #278e97;
      }
      .zoom-control output {
        text-align: right;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      }
      .crop-dialog footer {
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        gap: 0.5rem;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #dce2df;
      }
      .apply-crop {
        border-color: #171c1e;
        background: #171c1e;
        color: #ffffff;
        font-weight: 700;
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
  @ViewChild('cropCanvas') private cropCanvas?: ElementRef<HTMLCanvasElement>;
  protected readonly templates = RESUME_TEMPLATES;
  protected readonly colorGroups: Array<{
    key: ColorTarget;
    label: string;
    minimum: number;
  }> = [
    { key: 'accent', label: 'Accent', minimum: 3 },
    { key: 'heading', label: 'Heading', minimum: 4.5 },
    { key: 'body', label: 'Body text', minimum: 4.5 },
  ];
  protected readonly accentPresets = [
    '#0F9FB8',
    '#167D8D',
    '#205E74',
    '#1D6F5F',
    '#34785F',
    '#4F772D',
    '#6B7D2C',
    '#9A7B24',
    '#B87912',
    '#A85D19',
    '#B4522D',
    '#B43737',
    '#9F3F52',
    '#A94672',
    '#8A4772',
    '#754C9B',
    '#5D55A5',
    '#4257A6',
    '#315F9B',
    '#38769A',
    '#3A7771',
    '#6B6F76',
    '#4E636B',
    '#D45A69',
  ];
  protected readonly headingPresets = [
    '#111416',
    '#171C1E',
    '#1D2427',
    '#20272A',
    '#252A2D',
    '#282C2E',
    '#2C3235',
    '#303638',
    '#24343A',
    '#18333B',
    '#26352F',
    '#373026',
    '#38282D',
    '#30283A',
    '#263047',
    '#333333',
  ];
  protected readonly bodyPresets = [
    '#252A2C',
    '#2B3133',
    '#303638',
    '#30383B',
    '#373D3F',
    '#3E4446',
    '#344348',
    '#35433E',
    '#48423A',
    '#453B3E',
    '#3D3B48',
    '#4A4A4A',
  ];
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
  protected colorsOpen = false;
  protected cropOpen = false;
  protected cropApplying = false;
  protected cropDraft: ResumePhotoCrop = { x: 0, y: 0, zoom: 1 };
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private saveTimer?: number;
  private draggedSectionId = '';
  private pendingPhotoSource = '';
  private cropImage?: HTMLImageElement;
  private cropPointer?: { id: number; x: number; y: number };

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

  protected get currentColors(): ResumeColors {
    return this.resume
      ? resolveResumeColors(this.resume)
      : { accent: '#0f9fb8', heading: '#20272a', body: '#30383b' };
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

  protected presetsFor(target: ColorTarget) {
    if (target === 'accent') return this.accentPresets;
    if (target === 'heading') return this.headingPresets;
    return this.bodyPresets;
  }

  protected colorValue(target: ColorTarget) {
    return this.currentColors[target].toUpperCase();
  }

  protected setColor(target: ColorTarget, value: string) {
    if (!this.resume || !/^#[0-9a-f]{6}$/i.test(value)) return;
    this.resume.colors = { ...this.currentColors, [target]: value.toLowerCase() };
    this.markDirty();
  }

  protected onNativeColor(target: ColorTarget, event: Event) {
    this.setColor(target, (event.target as HTMLInputElement).value);
  }

  protected onHexColor(target: ColorTarget, event: Event) {
    const value = (event.target as HTMLInputElement).value.trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) this.setColor(target, value);
  }

  protected resetTemplateColors() {
    if (!this.resume) return;
    this.resume.colors = { ...RESUME_TEMPLATE_COLOR_DEFAULTS[this.resume.templateId] };
    this.markDirty();
  }

  protected contrastRatio(color: string) {
    const rgb = color
      .slice(1)
      .match(/.{2}/g)
      ?.map((part) => Number.parseInt(part, 16) / 255);
    if (!rgb || rgb.some(Number.isNaN)) return 1;
    const luminance = rgb.reduce((sum, channel, index) => {
      const linear = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      return sum + linear * [0.2126, 0.7152, 0.0722][index];
    }, 0);
    return Number((1.05 / (luminance + 0.05)).toFixed(2));
  }

  protected async onPhotoSelected(event: Event) {
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
    try {
      const source = await prepareProfilePhotoSource(file);
      await this.openCropEditor(source, { x: 0, y: 0, zoom: 1 });
    } catch {
      this.photoError = 'The image could not be read.';
    }
  }

  protected removePhoto() {
    if (!this.resume) return;
    this.resume.content.profile.photoSourceDataUrl = undefined;
    this.resume.content.profile.photoDataUrl = undefined;
    this.resume.content.profile.photoVisible = false;
    this.resume.content.profile.photoCrop = undefined;
    this.photoError = '';
    this.markDirty();
  }

  protected async openCropEditor(source?: string, crop?: ResumePhotoCrop) {
    if (!this.resume) return;
    const resolvedSource =
      source ??
      this.resume.content.profile.photoSourceDataUrl ??
      this.resume.content.profile.photoDataUrl;
    if (!resolvedSource) return;

    this.pendingPhotoSource = resolvedSource;
    this.cropDraft = {
      ...(crop ?? this.resume.content.profile.photoCrop ?? { x: 0, y: 0, zoom: 1 }),
    };
    this.cropOpen = true;
    try {
      this.cropImage = await loadProfileImage(resolvedSource);
      requestAnimationFrame(() => this.drawCropPreview());
    } catch {
      this.closeCropEditor();
      this.photoError = 'The image could not be read.';
    }
  }

  protected closeCropEditor() {
    if (this.cropApplying) return;
    this.cropOpen = false;
    this.pendingPhotoSource = '';
    this.cropImage = undefined;
    this.cropPointer = undefined;
  }

  protected resetCrop() {
    this.cropDraft = { x: 0, y: 0, zoom: 1 };
    this.drawCropPreview();
  }

  protected setCropZoom(event: Event) {
    this.cropDraft = {
      ...this.cropDraft,
      zoom: Number((event.target as HTMLInputElement).value),
    };
    this.drawCropPreview();
  }

  protected startCropDrag(event: PointerEvent) {
    if (!this.cropImage) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.cropPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  protected moveCropDrag(event: PointerEvent) {
    if (!this.cropPointer || this.cropPointer.id !== event.pointerId || !this.cropImage) return;
    const canvas = this.cropCanvas?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const travel = photoCropTravel(this.cropImage, canvas.width, this.cropDraft.zoom);
    const deltaX = (event.clientX - this.cropPointer.x) * scale;
    const deltaY = (event.clientY - this.cropPointer.y) * scale;
    this.cropDraft = {
      ...this.cropDraft,
      x: travel.x ? this.clamp(this.cropDraft.x + deltaX / travel.x, -1, 1) : 0,
      y: travel.y ? this.clamp(this.cropDraft.y + deltaY / travel.y, -1, 1) : 0,
    };
    this.cropPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.drawCropPreview();
  }

  protected endCropDrag(event: PointerEvent) {
    if (this.cropPointer?.id !== event.pointerId) return;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    this.cropPointer = undefined;
  }

  protected async applyCrop() {
    if (!this.resume || !this.pendingPhotoSource) return;
    this.cropApplying = true;
    try {
      const cropped = await cropProfilePhoto(this.pendingPhotoSource, this.cropDraft);
      this.resume.content.profile.photoSourceDataUrl = this.pendingPhotoSource;
      this.resume.content.profile.photoDataUrl = cropped;
      this.resume.content.profile.photoCrop = { ...this.cropDraft };
      this.resume.content.profile.photoVisible = true;
      this.markDirty();
      this.cropApplying = false;
      this.closeCropEditor();
    } catch {
      this.cropApplying = false;
      this.photoError = 'The crop could not be applied.';
    }
  }

  @HostListener('document:keydown.escape')
  protected closeFloatingPanels() {
    this.colorsOpen = false;
    this.closeCropEditor();
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

  private drawCropPreview() {
    const canvas = this.cropCanvas?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !this.cropImage) return;
    drawProfilePhotoCrop(context, this.cropImage, this.cropDraft, canvas.width);
  }

  private clamp(value: number, minimum: number, maximum: number) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  private recoveryKey(id: string) {
    return 'nexus:resume-recovery:' + id;
  }
}
