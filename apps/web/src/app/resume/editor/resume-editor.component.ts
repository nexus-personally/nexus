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
  LucideType,
  LucideArrowLeft,
  LucideBriefcaseBusiness,
  LucideChartNoAxesColumnIncreasing,
  LucideCheck,
  LucideChevronDown,
  LucideCrop,
  LucideDownload,
  LucideFileText,
  LucideFolder,
  LucideGripVertical,
  LucideMoreHorizontal,
  LucidePencil,
  LucidePlus,
  LucideRotateCcw,
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
import {
  ResumeRendererComponent,
  type ResumeColorRole,
  type ResumeColorSelection,
} from '../renderer/resume-renderer.component';

import { TypographyPanelComponent } from './typography-panel.component';

type ColorTarget = keyof ResumeColors;

@Component({
  selector: 'nexus-resume-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ResumeRendererComponent,
    TypographyPanelComponent,
    LucideType,
    LucideArrowLeft,
    LucideBriefcaseBusiness,
    LucideChartNoAxesColumnIncreasing,
    LucideUpload,
    LucideUserRound,
    LucideCrop,
    LucideDownload,
    LucideRotateCcw,
    LucideCheck,
    LucideChevronDown,
    LucideFileText,
    LucideFolder,
    LucideGripVertical,
    LucideMoreHorizontal,
    LucidePlus,
    LucidePencil,
  ],
  template: `
    @if (resume) {
      <main class="editor-shell">
        <header class="command-bar">
          <div class="document-identity">
            <a routerLink="/resume" class="back-button" aria-label="Back to dashboard">
              <svg lucideArrowLeft size="17"></svg>
            </a>
            <span class="studio-mark">NEXUS</span>
            <label class="document-name-control">
              <input
                [(ngModel)]="resume.name"
                (ngModelChange)="markDirty()"
                aria-label="Resume name"
                placeholder="Resume name"
              />
              <svg lucidePencil size="15" aria-hidden="true"></svg>
            </label>
          </div>

          <div class="document-controls">
            <div class="typography-anchor">
              <button
                #typographyTrigger
                class="typography-trigger"
                type="button"
                aria-controls="typography-inspector"
                [attr.aria-expanded]="typographyOpen"
                (click)="
                  typographyOpen = true;
                  inspectorTab = 'typography';
                  colorsOpen = false;
                  fieldColorOpen = false
                "
              >
                <svg lucideType size="17"></svg> Fonts <svg lucideChevronDown size="14"></svg>
              </button>
            </div>
            <label>
              <span>Template</span>
              <span class="template-picker template-picker-compact">
                <button
                  type="button"
                  class="template-picker-trigger"
                  role="combobox"
                  aria-haspopup="listbox"
                  [attr.aria-expanded]="templateMenuOpen"
                  [attr.aria-label]="'Template. Selected: ' + templateName(resume.templateId)"
                  (click)="templateMenuOpen = !templateMenuOpen; inspectorTemplateMenuOpen = false"
                >
                  <span>{{ templateName(resume.templateId) }}</span>
                  <svg lucideChevronDown size="14" [class.open]="templateMenuOpen"></svg>
                </button>
                @if (templateMenuOpen) {
                  <span class="template-options" role="listbox">
                    @for (template of templates; track template.id) {
                      <button
                        type="button"
                        role="option"
                        [class.selected]="resume.templateId === template.id"
                        [attr.aria-selected]="resume.templateId === template.id"
                        (click)="chooseTemplate(template.id)"
                      >
                        <svg lucideFileText size="16"></svg>
                        <span>{{ template.name }}</span>
                        @if (resume.templateId === template.id) {
                          <svg lucideCheck size="15"></svg>
                        }
                      </button>
                    }
                  </span>
                }
              </span>
            </label>
            <div class="color-control">
              <span class="control-label">Document accent</span>
              <button
                class="colors-button"
                type="button"
                [attr.aria-expanded]="colorsOpen"
                aria-controls="resume-colors-panel"
                (click)="colorsOpen = !colorsOpen"
              >
                <i [style.background]="currentColors.accent"></i>
                <code>{{ currentColors.accent }}</code>
                <svg lucideChevronDown size="15"></svg>
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
                          [placeholder]="'#000000'"
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
              ><i></i>{{ displaySaveState }}</span
            >
            <button type="button" (click)="save()">Save</button>
            <button type="button" (click)="publish()">Share</button>
            <div class="more-actions-anchor">
              <button
                class="more-button"
                type="button"
                (click)="moreOpen = !moreOpen"
                [attr.aria-expanded]="moreOpen"
                title="More actions"
                aria-label="More actions"
              >
                •••
              </button>
              @if (moreOpen) {
                <div class="more-menu">
                  <button type="button" (click)="unpublish(); moreOpen = false">
                    Disable public link
                  </button>
                </div>
              }
            </div>
            <button class="download-button" type="button" (click)="downloadPdf()">
              <svg lucideDownload size="14"></svg>
              Export PDF
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
            <p class="sections-help">
              Drag to reorder sections. Toggle visibility and customize each section.
            </p>

            <section class="profile-photo-control" aria-labelledby="profile-photo-title">
              <div class="profile-photo-heading">
                <span class="profile-title-wrap">
                  <svg class="drag-handle" lucideGripVertical size="16" aria-hidden="true"></svg>
                  <svg lucideUserRound size="17" aria-hidden="true"></svg>
                  <strong id="profile-photo-title">Profile Photo</strong>
                </span>
                <span class="profile-heading-actions">
                  <input
                    class="visibility-toggle"
                    type="checkbox"
                    [(ngModel)]="resume.content.profile.photoVisible"
                    [disabled]="!resume.content.profile.photoDataUrl"
                    aria-label="Show profile photo"
                    (ngModelChange)="markDirty()"
                  />
                </span>
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
                  }
                </div>
              </div>
              <label class="photo-visibility">
                <span>Show profile photo on resume</span>
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
                  <button class="section-main" type="button" (click)="selectSection(section.id)">
                    <svg class="drag-handle" lucideGripVertical size="16" aria-hidden="true"></svg>
                    @switch (section.type) {
                      @case ('experience') {
                        <svg lucideBriefcaseBusiness size="17" aria-hidden="true"></svg>
                      }
                      @case ('projects') {
                        <svg lucideFolder size="17" aria-hidden="true"></svg>
                      }
                      @case ('skills') {
                        <svg lucideChartNoAxesColumnIncreasing size="17" aria-hidden="true"></svg>
                      }
                      @default {
                        <svg lucideFileText size="17" aria-hidden="true"></svg>
                      }
                    }
                    <span
                      ><strong>{{ section.title }}</strong></span
                    >
                  </button>
                  <div class="section-actions">
                    <input
                      class="visibility-toggle"
                      type="checkbox"
                      [checked]="!section.hidden"
                      [attr.aria-label]="(section.hidden ? 'Show ' : 'Hide ') + section.title"
                      (change)="toggleHidden(section)"
                    />
                    <button
                      type="button"
                      (click)="toggleSectionMenu(section.id, $event)"
                      title="Section actions"
                      [attr.aria-label]="section.title + ' actions'"
                      [attr.aria-expanded]="sectionMenuId === section.id"
                    >
                      <svg lucideMoreHorizontal size="17"></svg>
                    </button>
                    @if (sectionMenuId === section.id) {
                      <div class="section-menu">
                        <button type="button" (click)="move(section.id, -1); sectionMenuId = ''">
                          Move up
                        </button>
                        <button type="button" (click)="move(section.id, 1); sectionMenuId = ''">
                          Move down
                        </button>
                        @if (section.type === 'experience') {
                          <button type="button" (click)="addCompany(section); sectionMenuId = ''">
                            Add company
                          </button>
                        } @else {
                          <button
                            type="button"
                            (click)="duplicateSection(section); sectionMenuId = ''"
                          >
                            Duplicate section
                          </button>
                        }
                        <button
                          class="danger"
                          type="button"
                          (click)="deleteSection(section); sectionMenuId = ''"
                        >
                          Delete section
                        </button>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <div class="add-section">
              <label class="add-section-type">
                <span>Section type</span>
                <span class="add-section-select">
                  <button
                    type="button"
                    class="add-section-select-trigger"
                    role="combobox"
                    aria-haspopup="listbox"
                    aria-controls="section-type-options"
                    [attr.aria-expanded]="addSectionMenuOpen"
                    [attr.aria-label]="'Section type. Selected: ' + selectedSectionTypeLabel"
                    [title]="'Selected section type: ' + selectedSectionTypeLabel"
                    (click)="addSectionMenuOpen = !addSectionMenuOpen"
                  >
                    <span>{{ selectedSectionTypeLabel }}</span>
                    <svg
                      lucideChevronDown
                      size="15"
                      aria-hidden="true"
                      [class.open]="addSectionMenuOpen"
                    ></svg>
                  </button>
                  @if (addSectionMenuOpen) {
                    <span id="section-type-options" class="add-section-options" role="listbox">
                      @for (option of sectionOptions; track option.type) {
                        <button
                          type="button"
                          role="option"
                          [class.selected]="newSectionType === option.type"
                          [attr.aria-selected]="newSectionType === option.type"
                          (click)="chooseSectionType(option.type)"
                        >
                          <span class="section-option-icon">
                            @switch (option.type) {
                              @case ('experience') {
                                <svg lucideBriefcaseBusiness size="16"></svg>
                              }
                              @case ('projects') {
                                <svg lucideFolder size="16"></svg>
                              }
                              @case ('skills') {
                                <svg lucideChartNoAxesColumnIncreasing size="16"></svg>
                              }
                              @default {
                                <svg lucideFileText size="16"></svg>
                              }
                            }
                          </span>
                          <span>{{ option.label }}</span>
                          @if (newSectionType === option.type) {
                            <svg class="section-option-check" lucideCheck size="15"></svg>
                          }
                        </button>
                      }
                    </span>
                  }
                </span>
              </label>
              <button type="button" class="add-section-button" (click)="addSection()">
                <svg lucidePlus size="17"></svg>
                {{ addSectionActionLabel }}
              </button>
            </div>

            <footer>
              <span>PAGE</span>
              <strong>A4 / 210 × 297 mm</strong>
            </footer>
          </aside>

          <section class="page-stage">
            <div #previewArea class="preview-area">
              <div class="page-meta" [style.width.px]="a4Width * previewScale">
                <span>Page 1 / 1 (A4)</span><span>{{ templateName(resume.templateId) }}</span>
              </div>
              <div
                class="a4-viewport"
                [style.width.px]="a4Width * previewScale"
                [style.height.px]="previewContentHeight * previewScale"
              >
                <div
                  #previewCanvas
                  class="a4-canvas"
                  [style.transform]="'scale(' + previewScale + ')'"
                >
                  <nexus-resume-renderer
                    #resumeRenderer
                    [resume]="resume"
                    [editable]="true"
                    (edited)="markDirty()"
                    (colorSelected)="openFieldColor($event)"
                  />
                </div>
              </div>
            </div>
            <div class="preview-controls" aria-label="Resume preview zoom">
              <button type="button" (click)="useFitPreview()">Fit</button>
              <button type="button" aria-label="Zoom out" (click)="adjustPreviewScale(-0.05)">
                −
              </button>
              <output>{{ (previewScale * 100).toFixed(0) }}%</output>
              <button type="button" aria-label="Zoom in" (click)="adjustPreviewScale(0.05)">
                +
              </button>
            </div>
          </section>

          <aside
            class="design-panel"
            [class.typography-active]="inspectorTab === 'typography'"
            aria-label="Resume inspector"
          >
            <nav class="inspector-tabs" aria-label="Inspector view">
              <button
                type="button"
                [class.active]="inspectorTab === 'design'"
                (click)="inspectorTab = 'design'; typographyOpen = false"
              >
                Design
              </button>
              <button
                type="button"
                [class.active]="inspectorTab === 'typography'"
                (click)="inspectorTab = 'typography'; typographyOpen = true"
              >
                Typography
              </button>
              <button
                type="button"
                [class.active]="inspectorTab === 'section'"
                (click)="inspectorTab = 'section'; typographyOpen = false"
              >
                Section
              </button>
            </nav>

            @if (inspectorTab === 'design') {
              <section class="inspector-group">
                <label>Template</label>
                <div class="template-card-picker">
                  <button
                    type="button"
                    class="template-control-card"
                    role="combobox"
                    aria-haspopup="listbox"
                    [attr.aria-expanded]="inspectorTemplateMenuOpen"
                    [attr.aria-label]="'Template. Selected: ' + templateName(resume.templateId)"
                    (click)="
                      inspectorTemplateMenuOpen = !inspectorTemplateMenuOpen;
                      templateMenuOpen = false
                    "
                  >
                    <span class="template-thumbnail" aria-hidden="true">
                      <span class="template-thumbnail-canvas">
                        <nexus-resume-renderer [resume]="resume" />
                      </span>
                    </span>
                    <span class="template-card-copy">
                      <strong>{{ templateName(resume.templateId) }}</strong>
                      <small>Clean and professional layout with a focus on content.</small>
                    </span>
                    <svg
                      class="template-chevron"
                      lucideChevronDown
                      size="15"
                      [class.open]="inspectorTemplateMenuOpen"
                    ></svg>
                  </button>
                  @if (inspectorTemplateMenuOpen) {
                    <span class="template-options template-options-rich" role="listbox">
                      @for (template of templates; track template.id) {
                        <button
                          type="button"
                          role="option"
                          [class.selected]="resume.templateId === template.id"
                          [attr.aria-selected]="resume.templateId === template.id"
                          (click)="chooseTemplate(template.id)"
                        >
                          <span class="section-option-icon"
                            ><svg lucideFileText size="16"></svg
                          ></span>
                          <span
                            ><strong>{{ template.name }}</strong
                            ><small>{{ template.description }}</small></span
                          >
                          @if (resume.templateId === template.id) {
                            <svg class="section-option-check" lucideCheck size="15"></svg>
                          }
                        </button>
                      }
                    </span>
                  }
                </div>
              </section>

              <section class="inspector-group">
                <label>Document accent</label>
                <button
                  type="button"
                  class="inspector-color-control"
                  [attr.aria-expanded]="colorsOpen"
                  (click)="colorsOpen = !colorsOpen"
                >
                  <i [style.background]="currentColors.accent"></i>
                  <code>{{ currentColors.accent }}</code>
                  <svg lucideChevronDown size="15"></svg>
                </button>
                <p>Controls accents, headers and highlights across your resume.</p>
              </section>

              <section class="inspector-group text-color-inspector">
                <label>Text color</label>
                <button
                  #textColorButton
                  type="button"
                  class="inspector-color-control"
                  [disabled]="!selectedColorField"
                  [attr.aria-expanded]="fieldColorOpen"
                  (click)="toggleFieldPalette(textColorButton)"
                >
                  <i [style.background]="selectedFieldColor"></i>
                  <code>{{ selectedFieldColor }}</code>
                  <svg lucideChevronDown size="15"></svg>
                </button>
                <p>
                  {{
                    selectedColorField
                      ? 'Color for the selected text or section content.'
                      : 'Select text in the resume to customize its color.'
                  }}
                </p>
                <button
                  type="button"
                  class="inspector-reset"
                  [disabled]="!selectedColorField"
                  (click)="clearFieldColor()"
                >
                  <svg lucideRotateCcw size="15"></svg>
                  Reset to default
                </button>
              </section>
            } @else if (inspectorTab === 'typography') {
              <section id="typography-inspector" class="typography-inspector">
                <nexus-typography-panel
                  [embedded]="true"
                  [resume]="resume"
                  [selection]="selectedColorField ?? undefined"
                  (changed)="markDirty()"
                  (closed)="
                    typographyOpen = false; inspectorTab = 'design'; typographyTrigger.focus()
                  "
                />
              </section>
            } @else {
              <section class="inspector-group section-inspector">
                <label>Selected section</label>
                <strong>{{ selectedSection?.title ?? 'No section selected' }}</strong>
                <p>Reorder, show, duplicate or remove this section from the left panel menu.</p>
              </section>
            }

            @if (inspectorTab !== 'typography') {
              <section class="page-size-card">
                <label for="page-size">Page size</label>
                <select id="page-size" aria-label="Page size">
                  <option>A4 (210 × 297 mm)</option>
                </select>
                <small>Optimized for job applications worldwide.</small>
              </section>
            }
          </aside>

          @if (fieldColorOpen) {
            <section
              class="field-color-panel"
              aria-label="Selected text color"
              [style.left.px]="activeColorField?.left ?? 8"
              [style.top.px]="activeColorField?.top ?? 8"
              [style.max-height.px]="fieldColorMaxHeight"
              (mousedown)="$event.stopPropagation()"
            >
              <header>
                <div>
                  <span>TEXT COLOR</span>
                  <strong>{{ activeColorField?.label ?? 'Text' }}</strong>
                </div>
                <button
                  type="button"
                  aria-label="Close text color"
                  (click)="fieldColorOpen = false"
                >
                  ×
                </button>
              </header>
              @for (collection of fieldPaletteGroups; track collection.label) {
                <p class="palette-label">{{ collection.label }}</p>
                <div class="field-preset-grid" role="group" [attr.aria-label]="collection.label">
                  @for (preset of collection.colors; track preset) {
                    <button
                      type="button"
                      class="color-preset"
                      [class.selected]="selectedFieldColor === preset"
                      [style.--swatch]="preset"
                      [title]="preset"
                      [attr.aria-label]="'Use ' + preset"
                      (click)="setFieldColor(preset)"
                    ></button>
                  }
                </div>
              }
              <div class="custom-color-row">
                <input
                  type="color"
                  [value]="selectedFieldColor"
                  aria-label="Custom text color"
                  (input)="onFieldNativeColor($event)"
                />
                <input
                  class="hex-input"
                  [value]="selectedFieldColor"
                  aria-label="Text color hex"
                  placeholder="#000000"
                  maxlength="7"
                  spellcheck="false"
                  (input)="onFieldHexColor($event)"
                />
              </div>
              <div class="field-color-footer">
                <span
                  >{{
                    contrastRatio(selectedFieldColor, activeColorField?.background ?? '#ffffff')
                  }}:1 contrast</span
                >
                <button type="button" (click)="clearFieldColor()" class="restore-color">
                  <i [style.background]="selectedRoleColor"></i> Reset to default
                </button>
              </div>
            </section>
          }
          @if (inlineToolbarOpen) {
            <div
              class="inline-text-toolbar"
              [class.weight-menu-left]="inlineWeightMenuAlignLeft"
              role="toolbar"
              aria-label="Format selected text"
              [style.left.px]="inlineToolbarLeft"
              [style.top.px]="inlineToolbarTop"
              (mousedown)="$event.preventDefault(); $event.stopPropagation()"
            >
              <span class="inline-toolbar-accent" aria-hidden="true"></span>
              <div class="inline-weight-action">
                <button
                  type="button"
                  class="inline-format-button inline-bold-button"
                  [class.is-active]="inlineWeight >= 600"
                  aria-label="Bold selected text"
                  title="Bold"
                  (click)="setInlineWeight(inlineWeight >= 600 ? 400 : 700)"
                >
                  <span aria-hidden="true">B</span>
                </button>
                <button
                  type="button"
                  class="inline-weight-menu-trigger"
                  aria-label="Choose font weight"
                  title="Font weight"
                  [attr.aria-expanded]="inlineWeightMenuOpen"
                  (click)="inlineWeightMenuOpen = !inlineWeightMenuOpen"
                >
                  <span>{{ inlineWeight }}</span>
                  <svg lucideChevronDown size="12"></svg>
                </button>
                @if (inlineWeightMenuOpen) {
                  <div class="inline-weight-menu" role="menu" aria-label="Font weight">
                    @for (option of inlineWeightOptions; track option.value) {
                      <button
                        type="button"
                        role="menuitemradio"
                        [attr.aria-checked]="inlineWeight === option.value"
                        [class.is-selected]="inlineWeight === option.value"
                        [style.font-weight]="option.value"
                        (click)="setInlineWeight(option.value); inlineWeightMenuOpen = false"
                      >
                        <span>{{ option.label }}</span>
                        <small>{{ option.value }}</small>
                      </button>
                    }
                  </div>
                }
              </div>
              <button
                type="button"
                class="inline-format-button inline-italic-button"
                aria-label="Italicize selected text"
                title="Italic"
                (click)="applyInlineStyle({ kind: 'italic', value: true })"
              >
                <span aria-hidden="true">I</span>
              </button>
            </div>
          }
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
                <button class="crop-action crop-action-reset" type="button" (click)="resetCrop()">
                  <svg lucideRotateCcw size="14"></svg>
                  Reset
                </button>
                <span></span>
                <button
                  class="crop-action crop-action-cancel"
                  type="button"
                  (click)="closeCropEditor()"
                >
                  Cancel
                </button>
                <button
                  class="crop-action apply-crop"
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
  styleUrls: ['./typography-editor.scss'],
  styles: [
    `
      :host {
        display: block;
        background: #dfe4e2;
        color: #1d2224;
        font-family: Roboto, 'Helvetica Neue', sans-serif;
      }
      .editor-shell {
        min-height: 100svh;
      }
      .command-bar {
        position: sticky;
        top: 0;
        z-index: 30;
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
        min-height: 0;
        aspect-ratio: 1;
        box-sizing: border-box;
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
      .download-button {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
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
      .preview-controls {
        position: relative;
        top: auto;
        z-index: 6;
        display: flex;
        width: fit-content;
        align-items: center;
        gap: 0.55rem;
        margin: 0 auto 0.9rem;
        padding: 0.4rem 0.55rem;
        border: 1px solid #c5cfcb;
        border-radius: 25px;
        background: rgba(248, 250, 249, 0.96);
        box-shadow: 0 5px 18px rgba(20, 29, 30, 0.08);
      }
      .preview-controls button {
        min-width: 3rem;
        padding: 0.35rem 0.7rem;
        font-size: 0.68rem;
      }
      .preview-controls button.active {
        border-color: #172231;
        background: #172231;
        color: #ffffff;
      }
      .preview-controls input {
        width: 8rem;
        accent-color: #278e97;
      }
      .preview-controls output {
        min-width: 2.8rem;
        color: #52605c;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.66rem;
        text-align: right;
      }
      .preview-area {
        min-width: 100%;
      }
      .page-meta {
        display: flex;
        justify-content: space-between;
        margin: 0 auto 0.65rem;
        color: #64706d;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.58rem;
        letter-spacing: 0.05em;
      }
      .a4-viewport {
        position: relative;
        margin: 0 auto;
        overflow: visible;
      }
      .a4-canvas {
        width: 210mm;
        transform-origin: top left;
      }
      .field-color-panel {
        position: fixed;
        z-index: 35;
        width: min(19rem, calc(100vw - 1rem));
        padding: 0.8rem;
        border: 1px solid #b9c5c1;
        border-radius: 8px;
        background: #ffffff;
        max-height: min(580px, 65svh);
        overflow-y: auto;
        box-shadow: 0 18px 50px rgba(18, 27, 28, 0.24);
      }
      .field-color-panel > header,
      .field-color-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
      }
      .field-color-panel > header div {
        display: grid;
        gap: 0.12rem;
      }
      .field-color-panel > header span {
        color: #6b898b;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.55rem;
        letter-spacing: 0.08em;
      }
      .field-color-panel > header strong {
        font-size: 0.76rem;
      }
      .field-color-panel > header button {
        width: 1.8rem;
        height: 1.8rem;
        padding: 0;
        border: 0;
        border-radius: 50%;
      }
      .field-preset-grid {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 0.4rem;
        margin: 0.75rem 0;
      }
      .field-preset-grid .color-preset {
        width: 100%;
        aspect-ratio: 1;
        padding: 0;
        border: 1px solid color-mix(in srgb, var(--swatch), black 15%);
        border-radius: 50%;
        background: var(--swatch);
      }
      .field-preset-grid .color-preset.selected {
        box-shadow:
          0 0 0 2px #ffffff,
          0 0 0 4px #172231;
      }
      .field-color-panel .custom-color-row {
        margin-bottom: 0.75rem;
      }
      .field-color-footer {
        padding-top: 0.7rem;
        border-top: 1px solid #e1e6e4;
      }
      .field-color-footer span {
        color: #66736f;
        font-size: 0.62rem;
      }
      .field-color-footer span.low-contrast {
        color: #a04c43;
      }
      .field-color-footer button {
        padding: 0.38rem 0.65rem;
        font-size: 0.64rem;
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
        align-items: center;
        gap: 0.65rem;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #dce2df;
      }
      .crop-dialog footer .crop-action {
        min-height: 2.5rem;
        border-radius: var(--radius-button, 25px);
        padding: 0.55rem 1rem;
        font-size: 0.75rem;
        font-weight: 650;
        line-height: 1;
        transition:
          border-color 120ms ease,
          background 120ms ease,
          color 120ms ease,
          transform 120ms ease;
      }
      .crop-action-reset {
        border-color: #9dc9ca;
        background: #edf8f8;
        color: #176b72;
      }
      .crop-action-reset:hover {
        border-color: #278e97;
        background: #dff2f3;
      }
      .crop-action-cancel {
        border-color: #c9d2cf;
        background: #ffffff;
        color: #3f4947;
      }
      .crop-action-cancel:hover {
        border-color: #8e9b97;
        background: #f0f4f2;
      }
      .apply-crop {
        border-color: #237f87;
        background: #278e97;
        color: #ffffff;
        font-weight: 700;
        box-shadow: 0 6px 16px rgba(39, 142, 151, 0.22);
      }
      .apply-crop:hover:not(:disabled) {
        border-color: #176b72;
        background: #207d85;
      }
      .crop-dialog footer .crop-action:active:not(:disabled) {
        transform: scale(0.98);
      }
      .crop-dialog footer .apply-crop:disabled {
        border-color: #b9c7c4;
        background: #dfe6e4;
        color: #87928f;
        box-shadow: none;
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
        .preview-controls {
          top: 0.5rem;
        }
      }
      .text-toolbar {
        position: sticky;
        top: 4rem;
        z-index: 9;
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 20px;
        background: #ffffff;
        border-bottom: 1px solid #d6dcda;
        font-size: 13px;
      }
      .text-toolbar > span {
        min-width: 120px;
      }
      .text-color-trigger,
      .restore-color {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .text-color-trigger i,
      .restore-color i {
        width: 16px;
        height: 16px;
        border: 1px solid #b9c5c1;
        border-radius: 50%;
      }
      button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      button:focus-visible {
        outline: 2px solid #278e97;
        outline-offset: 3px;
      }
      .command-bar button,
      .text-toolbar button {
        min-height: 38px;
        border-radius: 25px;
      }
      .download-button {
        background: #172231;
        color: #ffffff;
        border-color: #172231;
        font-weight: 650;
      }
      .save-controls {
        position: relative;
      }
      .more-actions-anchor {
        position: relative;
        display: inline-flex;
        align-items: center;
      }
      .more-menu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        min-width: 10.5rem;
        padding: 0.35rem;
        background: white;
        border: 1px solid #c5cfcb;
        border-radius: 10px;
        box-shadow: 0 8px 24px #0002;
        z-index: 25;
      }
      .more-menu button {
        width: 100%;
        min-height: 2.5rem;
        padding: 0.55rem 0.7rem;
        border: 0;
        border-radius: 6px;
        background: transparent;
        text-align: left;
        white-space: nowrap;
        color: #a04740;
      }
      .more-menu button:hover {
        background: #fff2f0;
      }
      .palette-label {
        margin: 14px 0 6px;
        font-size: 12px;
        color: #52605c;
      }
      .field-preset-grid {
        margin: 6px 0 12px;
      }
      .section-actions {
        gap: 3px;
        padding-left: 4px;
      }
      .section-actions button {
        min-height: 32px;
        min-width: 28px;
        border-radius: 25px;
      }
      /* Structured Studio: faithful implementation of the selected three-column concept. */
      :host {
        --editor-accent: #277f84;
        --editor-accent-soft: #e8f5f5;
        --editor-text: #1f2329;
        --editor-text-secondary: #646a73;
        --editor-border: #dfe3e6;
        --editor-surface: #ffffff;
        --editor-workspace: #eef2f3;
      }
      .editor-shell {
        background: var(--editor-workspace);
      }
      .command-bar {
        grid-template-columns: minmax(18rem, 1fr) auto minmax(24rem, 1fr);
        min-height: 4.25rem;
        gap: 1.25rem;
        padding: 0 1.25rem;
        border-bottom-color: var(--editor-border);
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 1px 5px rgba(31, 35, 41, 0.06);
      }
      .command-bar button,
      .command-bar select,
      .command-bar input {
        min-height: 2.5rem;
        border-radius: 6px;
        font-size: 0.875rem;
      }
      .back-button {
        width: 2rem;
        height: 2rem;
        font-size: 1.1rem;
      }
      .studio-mark {
        width: auto;
        height: auto;
        padding-right: 1rem;
        border-right: 1px solid var(--editor-border);
        background: transparent;
        color: #172231;
        font-size: 1.18rem;
        letter-spacing: 0.025em;
      }
      .document-identity input {
        width: min(16rem, 24vw);
        border: 1px solid transparent;
        padding-inline: 0.75rem;
        color: var(--editor-text);
        font-size: 0.9rem;
        font-weight: 650;
      }
      .document-identity input:hover,
      .document-identity input:focus {
        border-color: var(--editor-border);
        background: #ffffff;
      }
      .document-controls label {
        gap: 0.6rem;
        color: var(--editor-text-secondary);
        font-size: 0.75rem;
      }
      .colors-button {
        flex-direction: row-reverse;
        border-color: var(--editor-border);
      }
      .colors-button i {
        width: 1.35rem;
        height: 1.35rem;
      }
      .save-controls {
        gap: 0.65rem;
        font-weight: 700;
      }
      .save-state {
        font-size: 0.72rem;
      }
      .save-controls > button:not(.download-button):not(.more-button) {
        border-color: var(--editor-border);
        background: #ffffff;
      }
      .save-controls > button:nth-of-type(2) {
        border-color: transparent;
        background: transparent;
        color: var(--editor-accent);
      }
      .save-controls .more-button {
        width: 2.5rem;
        border-color: var(--editor-border);
      }
      .download-button {
        min-width: 8.5rem;
        justify-content: center;
        border-color: #236f74;
        background: var(--editor-accent);
        color: #ffffff;
        font-weight: 700;
      }
      .editor-workspace {
        grid-template-columns: 16.25rem minmax(30rem, 1fr) 17rem;
        height: calc(100svh - 4.25rem);
        min-height: 0;
        overflow: hidden;
      }
      .structure-panel,
      .design-panel {
        position: relative;
        top: 0;
        height: 100%;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        background: #fbfcfc;
      }
      .structure-panel {
        border-right: 1px solid var(--editor-border);
      }
      .structure-panel > header {
        padding: 1.5rem 1.25rem 0.45rem;
        border-bottom: 0;
      }
      .structure-panel header span {
        display: none;
      }
      .structure-panel h2 {
        margin: 0;
        color: var(--editor-text);
        font-size: 1.05rem;
      }
      .structure-panel header > small {
        font-size: 0.75rem;
      }
      .sections-help {
        margin: 0;
        padding: 0 1.25rem 1.1rem;
        border-bottom: 1px solid var(--editor-border);
        color: var(--editor-text-secondary);
        font-size: 0.75rem;
        line-height: 1.5;
      }
      .profile-photo-control {
        margin: 0;
        padding: 1.15rem 1.25rem;
        border-bottom: 1px solid var(--editor-border);
        background: transparent;
      }
      .profile-photo-heading span {
        color: var(--editor-text);
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 650;
        letter-spacing: 0;
      }
      .profile-photo-row {
        display: grid;
        grid-template-columns: 3.25rem minmax(0, 1fr);
        margin-top: 0.85rem;
      }
      .profile-photo-row > div {
        flex-wrap: wrap;
        min-width: 0;
      }
      .profile-photo-row > img,
      .profile-photo-placeholder {
        width: 3.25rem;
        height: 3.25rem;
      }
      .profile-photo-row button {
        min-height: 2rem;
        border-color: var(--editor-border);
        border-radius: 6px;
        font-size: 0.72rem;
      }
      .photo-visibility {
        margin-top: 0.8rem;
        color: var(--editor-text-secondary);
        font-size: 0.72rem;
      }
      .section-list {
        padding: 0.75rem 1rem;
      }
      .section-row {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        min-height: 3.5rem;
        margin-bottom: 0.35rem;
        border-color: var(--editor-border);
        border-radius: 6px;
        box-shadow: none;
      }
      .section-row.active {
        border-color: #bee1e2;
        background: var(--editor-accent-soft);
        box-shadow: inset 3px 0 0 var(--editor-accent);
      }
      .section-main {
        grid-template-columns: 1rem 1.1rem minmax(0, 1fr);
        gap: 0.55rem;
        min-width: 0;
        padding: 0.62rem 0.45rem;
      }
      .section-main strong {
        color: var(--editor-text);
        font-size: 0.78rem;
      }
      .section-main small {
        color: #7b8490;
        font-size: 0.65rem;
        text-transform: none;
      }
      .section-actions,
      .section-row.active .section-actions,
      .section-row:focus-within .section-actions {
        position: relative;
        display: flex;
        grid-template-columns: none;
        gap: 0.1rem;
        padding: 0 0.35rem 0 0;
      }
      .section-actions button {
        min-width: 1.8rem;
        min-height: 1.8rem;
        border: 0;
        border-radius: 5px;
      }
      .visibility-toggle {
        appearance: none;
        position: relative;
        width: 2rem;
        height: 1.15rem;
        flex: 0 0 auto;
        border: 0;
        border-radius: 999px;
        background: #cbd2d5;
        cursor: pointer;
        transition: background 140ms ease;
      }
      .visibility-toggle::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 0.9rem;
        height: 0.9rem;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 1px 2px rgba(31, 35, 41, 0.2);
        transition: transform 140ms ease;
      }
      .visibility-toggle:checked {
        background: var(--editor-accent);
      }
      .visibility-toggle:checked::after {
        transform: translateX(0.85rem);
      }
      .section-menu {
        position: absolute;
        top: calc(100% + 0.35rem);
        right: 0;
        z-index: 24;
        display: grid;
        width: 10.5rem;
        padding: 0.35rem;
        border: 1px solid var(--editor-border);
        border-radius: 7px;
        background: #ffffff;
        box-shadow: 0 8px 24px rgba(31, 35, 41, 0.14);
      }
      .section-menu button {
        justify-content: flex-start;
        width: 100%;
        padding-inline: 0.65rem;
        color: var(--editor-text);
        text-align: left;
      }
      .section-menu button:hover {
        background: #f3f5f5;
      }
      .section-menu button.danger {
        color: #c53b3f;
      }
      .add-section {
        position: relative;
        grid-template-columns: minmax(0, 1fr) 2.75rem;
        margin-top: auto;
        padding: 1rem;
        border-top-color: var(--editor-border);
      }
      .add-section-button {
        display: inline-flex;
        min-height: 2.5rem;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        border-color: var(--editor-border);
        border-radius: 6px 0 0 6px;
        color: var(--editor-text);
      }
      .add-section select {
        box-sizing: border-box;
        min-height: 2.5rem;
        border-color: var(--editor-border);
        border-radius: 0 6px 6px 0;
        border-left: 0;
        padding: 0;
        color: transparent;
      }
      .add-section select option {
        color: var(--editor-text);
      }
      .add-section-chevron {
        position: absolute;
        right: 1.85rem;
        top: 50%;
        pointer-events: none;
        transform: translateY(-50%);
      }
      .structure-panel > footer {
        display: none;
      }
      .page-stage {
        position: relative;
        min-height: 0;
        overflow: auto;
        padding: 1.3rem 2rem 5rem;
        background: var(--editor-workspace);
      }
      .page-meta {
        margin-bottom: 0.65rem;
        color: #7b8490;
        font-family: inherit;
        font-size: 0.72rem;
        letter-spacing: 0;
        text-transform: none;
      }
      .preview-controls {
        position: fixed;
        right: calc(17rem + 1.5rem);
        bottom: 1rem;
        z-index: 8;
        gap: 0;
        margin: 0;
        padding: 0.3rem;
        border-color: var(--editor-border);
        border-radius: 7px;
        background: #ffffff;
        box-shadow: 0 4px 16px rgba(31, 35, 41, 0.1);
      }
      .preview-controls button {
        min-width: 2.7rem;
        min-height: 2rem;
        border-color: transparent;
        border-radius: 5px;
        padding: 0.25rem 0.65rem;
        background: transparent;
        font-size: 0.75rem;
      }
      .preview-controls button:hover {
        background: #f2f4f5;
      }
      .preview-controls output {
        display: grid;
        min-width: 3.8rem;
        place-items: center;
        color: var(--editor-text);
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 650;
      }
      .design-panel {
        display: flex;
        flex-direction: column;
        border-left: 1px solid var(--editor-border);
      }
      .inspector-tabs {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        border-bottom: 1px solid var(--editor-border);
      }
      .inspector-tabs button {
        min-height: 3.5rem;
        border: 0;
        border-bottom: 2px solid transparent;
        border-radius: 0;
        background: transparent;
        color: var(--editor-text-secondary);
        font-size: 0.78rem;
      }
      .inspector-tabs button.active {
        border-bottom-color: var(--editor-accent);
        color: var(--editor-accent);
        font-weight: 700;
      }
      .inspector-group {
        padding: 1.35rem 1rem;
        border-bottom: 1px solid var(--editor-border);
      }
      .inspector-group > label,
      .page-size-card > label {
        display: block;
        margin-bottom: 0.7rem;
        color: var(--editor-text);
        font-size: 0.78rem;
        font-weight: 700;
      }
      .inspector-group > p,
      .page-size-card > small {
        display: block;
        margin: 0.65rem 0 0;
        color: #7b8490;
        font-size: 0.7rem;
        line-height: 1.5;
      }
      .template-control-card {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 1.2rem;
        align-items: center;
        gap: 0.7rem;
        min-height: 5rem;
        padding: 0.65rem;
        border: 1px solid var(--editor-border);
        border-radius: 7px;
        background: #ffffff;
      }
      .template-thumbnail {
        display: none;
      }
      .template-control-card div {
        display: grid;
        gap: 0.25rem;
      }
      .template-control-card strong {
        font-size: 0.76rem;
      }
      .template-control-card small {
        color: #7b8490;
        font-size: 0.65rem;
        line-height: 1.35;
      }
      .template-control-card select {
        position: absolute;
        inset: 0;
        width: 100%;
        opacity: 0;
        cursor: pointer;
      }
      .inspector-color-control {
        display: grid;
        grid-template-columns: 2.1rem minmax(0, 1fr) auto;
        width: 100%;
        min-height: 2.65rem;
        align-items: center;
        gap: 0.65rem;
        border-color: var(--editor-border);
        border-radius: 7px;
        background: #ffffff;
        text-align: left;
      }
      .inspector-color-control i {
        width: 1.8rem;
        height: 1.8rem;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 50%;
      }
      .inspector-color-control code {
        color: var(--editor-text);
        font-family: inherit;
        font-size: 0.74rem;
      }
      .inspector-reset {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        margin-top: 0.8rem;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--editor-accent);
        font-size: 0.72rem;
      }
      .section-inspector > strong {
        color: var(--editor-text);
        font-size: 0.9rem;
      }
      .typography-inspector {
        min-height: 0;
        background: #ffffff;
      }
      .page-size-card {
        margin: auto 1rem 1rem;
        padding: 0.9rem;
        border: 1px solid var(--editor-border);
        border-radius: 7px;
        background: #ffffff;
      }
      .page-size-card select {
        width: 100%;
        min-height: 2.5rem;
        border: 1px solid var(--editor-border);
        border-radius: 6px;
        padding: 0.45rem 0.6rem;
        background: #ffffff;
        color: var(--editor-text);
        font-size: 0.72rem;
      }
      .colors-panel {
        position: fixed;
        top: 4.75rem;
        right: 19.5rem;
        left: auto;
        width: 19rem;
        transform: none;
      }
      .field-color-panel {
        width: 18.5rem;
      }

      /* Screenshot-aligned refinements for the Structured Studio shell. */
      .document-name-control {
        position: relative;
        display: flex;
        align-items: center;
      }
      .document-name-control input {
        padding-right: 2.35rem;
      }
      .document-name-control > svg {
        position: absolute;
        right: 0.8rem;
        pointer-events: none;
        color: #172231;
      }
      .color-control {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }
      .control-label {
        color: var(--editor-text-secondary);
        font-size: 0.75rem;
        white-space: nowrap;
      }
      .colors-button {
        display: grid;
        grid-template-columns: 1.35rem minmax(4.9rem, auto) 1rem;
        gap: 0.55rem;
        padding-inline: 0.65rem;
      }
      .select-control {
        position: relative;
        display: block;
      }
      .select-control select {
        min-width: 9rem;
        padding-right: 2.15rem;
        appearance: none;
      }
      .select-control > svg {
        position: absolute;
        top: 50%;
        right: 0.7rem;
        pointer-events: none;
        transform: translateY(-50%);
        color: var(--editor-text);
      }
      .template-picker,
      .template-card-picker {
        position: relative;
        display: block;
      }
      .template-picker-trigger {
        display: flex;
        min-width: 9rem;
        min-height: 2.5rem;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.5rem 0.7rem 0.5rem 0.85rem;
        border: 1px solid var(--editor-border);
        border-radius: 7px;
        background: #ffffff;
        color: var(--editor-text);
        font-size: 0.8rem;
        font-weight: 600;
      }
      .template-picker-trigger:hover,
      .template-picker-trigger:focus-visible {
        border-color: #aeb8bd;
        background: #fbfcfc;
      }
      .template-picker-trigger:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--editor-accent), transparent 72%);
        outline-offset: 2px;
      }
      .template-picker-trigger svg,
      .template-chevron {
        transition: transform 150ms ease;
      }
      .template-picker-trigger svg.open,
      .template-chevron.open {
        transform: rotate(180deg);
      }
      .template-options {
        position: absolute;
        top: calc(100% + 0.45rem);
        right: 0;
        left: 0;
        z-index: 40;
        display: grid;
        min-width: 12rem;
        padding: 0.35rem;
        border: 1px solid var(--editor-border);
        border-radius: 9px;
        background: #ffffff;
        box-shadow: 0 12px 32px rgba(31, 35, 41, 0.16);
      }
      .template-options > button {
        display: grid;
        grid-template-columns: 1.5rem minmax(0, 1fr) 1rem;
        min-height: 2.5rem;
        align-items: center;
        gap: 0.5rem;
        padding: 0.45rem 0.65rem;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--editor-text);
        font-size: 0.78rem;
        text-align: left;
      }
      .template-options > button:hover,
      .template-options > button:focus-visible {
        background: #f1f7f7;
        outline: none;
      }
      .template-options > button.selected {
        background: var(--editor-accent-soft);
        color: #17666b;
        font-weight: 700;
      }
      .colors-button code {
        color: var(--editor-text);
        font-family: inherit;
        font-size: 0.78rem;
      }
      .colors-panel header button,
      .field-color-panel header button {
        width: 1.75rem;
        height: 1.75rem;
        min-height: 1.75rem;
        padding: 0;
        border-radius: 50%;
        font-size: 0.9rem;
      }
      .profile-photo-control {
        margin: 1rem 1rem 0.75rem;
        padding: 0;
        overflow: hidden;
        border: 1px solid var(--editor-border);
        border-radius: 7px;
        background: #ffffff;
      }
      .profile-photo-heading {
        min-height: 3rem;
        padding: 0 0.6rem;
      }
      .profile-title-wrap,
      .profile-heading-actions {
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }
      .profile-title-wrap strong {
        color: var(--editor-text);
        font-size: 0.78rem;
      }
      .profile-heading-actions button {
        display: grid;
        width: 1.8rem;
        height: 1.8rem;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--editor-text-secondary);
      }
      .profile-photo-row {
        grid-template-columns: 4.15rem minmax(0, 1fr);
        margin: 0;
        padding: 0.35rem 0.75rem 0.6rem;
      }
      .profile-photo-row > img,
      .profile-photo-placeholder {
        width: 4.5rem;
        height: 4.5rem;
      }
      .photo-visibility {
        margin: 0;
        padding: 0.65rem 0.75rem;
        border-top: 1px solid #edf0f1;
      }
      .photo-visibility input {
        width: 1rem;
        height: 1rem;
      }
      .section-list {
        padding-top: 0;
      }
      .section-row {
        min-height: 3.25rem;
      }
      .section-main > span:last-child {
        display: block;
      }
      .template-control-card {
        grid-template-columns: 2.4rem minmax(0, 1fr) 1rem;
        width: 100%;
        text-align: left;
      }
      .template-card-copy {
        display: grid;
        min-width: 0;
        gap: 0.25rem;
      }
      .template-thumbnail {
        position: relative;
        display: block;
        width: 2.25rem;
        height: 3rem;
        overflow: hidden;
        border: 1px solid #aeb8bd;
        background: #ffffff;
        box-shadow: 0 1px 2px rgba(31, 35, 41, 0.08);
      }
      .template-thumbnail-canvas {
        position: absolute;
        inset: 0 auto auto 0;
        display: block;
        width: 210mm;
        transform: scale(0.0453);
        transform-origin: top left;
        pointer-events: none;
      }
      .template-thumbnail-canvas nexus-resume-renderer {
        display: block;
      }
      .template-chevron {
        color: var(--editor-text);
      }
      .template-options-rich {
        min-width: 100%;
      }
      .template-options-rich > button {
        grid-template-columns: 1.75rem minmax(0, 1fr) 1rem;
        min-height: 3.25rem;
      }
      .template-options-rich > button > span:nth-child(2) {
        display: grid;
        min-width: 0;
        gap: 0.15rem;
      }
      .template-options-rich strong {
        font-size: 0.78rem;
      }
      .template-options-rich small {
        overflow: hidden;
        color: #7b8490;
        font-size: 0.65rem;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .preview-controls {
        right: auto;
        left: 50%;
        transform: translateX(-50%);
      }
      .add-section {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 0.65rem;
      }
      .add-section-type {
        display: grid;
        gap: 0.4rem;
        color: var(--editor-text-secondary);
        font-size: 0.72rem;
        font-weight: 650;
      }
      .add-section-select {
        position: relative;
        display: block;
      }
      .add-section-select-trigger {
        display: flex;
        width: 100%;
        min-height: 2.65rem;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.55rem 2.5rem 0.55rem 0.8rem;
        border: 1px solid var(--editor-border);
        border-radius: 7px;
        background: #ffffff;
        color: var(--editor-text);
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 600;
        text-align: left;
      }
      .add-section-select-trigger:hover {
        border-color: #aeb8bd;
        background: #fbfcfc;
      }
      .add-section-select-trigger:focus-visible {
        border-color: var(--editor-accent);
        outline: 2px solid color-mix(in srgb, var(--editor-accent), transparent 72%);
        outline-offset: 2px;
      }
      .add-section-select-trigger > svg {
        position: absolute;
        top: 50%;
        right: 0.8rem;
        pointer-events: none;
        transform: translateY(-50%);
        color: var(--editor-text-secondary);
        transition: transform 150ms ease;
      }
      .add-section-select-trigger > svg.open {
        transform: translateY(-50%) rotate(180deg);
      }
      .add-section-options {
        position: absolute;
        right: 0;
        bottom: calc(100% + 0.45rem);
        left: 0;
        z-index: 30;
        display: grid;
        max-height: 17.5rem;
        overflow-y: auto;
        padding: 0.35rem;
        border: 1px solid var(--editor-border);
        border-radius: 9px;
        background: #ffffff;
        box-shadow: 0 12px 32px rgba(31, 35, 41, 0.16);
      }
      .add-section-options > button {
        display: grid;
        grid-template-columns: 1.75rem minmax(0, 1fr) 1rem;
        min-height: 2.5rem;
        align-items: center;
        gap: 0.5rem;
        padding: 0.45rem 0.65rem;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--editor-text);
        font-size: 0.78rem;
        font-weight: 550;
        text-align: left;
      }
      .add-section-options > button:hover,
      .add-section-options > button:focus-visible {
        background: #f1f7f7;
        outline: none;
      }
      .add-section-options > button.selected {
        background: var(--editor-accent-soft);
        color: #17666b;
        font-weight: 700;
      }
      .section-option-icon {
        display: grid;
        width: 1.75rem;
        height: 1.75rem;
        place-items: center;
        border-radius: 6px;
        background: #f2f4f5;
        color: #53606a;
      }
      .selected .section-option-icon {
        background: #d7eded;
        color: var(--editor-accent);
      }
      .section-option-check {
        color: var(--editor-accent);
      }
      .add-section .add-section-button {
        width: 100%;
        min-height: 2.65rem;
        border: 1px solid var(--editor-accent);
        border-radius: 7px;
        background: var(--editor-accent);
        color: #ffffff;
      }
      @media (min-width: 1181px) {
        .editor-workspace {
          grid-template-columns: 19.5rem minmax(30rem, 1fr) 19.5rem;
        }
        .structure-panel > header {
          padding: 1.55rem 1.25rem 0.5rem;
        }
        .structure-panel h2 {
          font-size: 1rem;
          font-weight: 700;
        }
        .sections-help {
          font-size: 0.8rem;
        }
        .profile-title-wrap strong,
        .section-main strong {
          font-size: 0.82rem;
          font-weight: 650;
        }
        .profile-photo-row {
          grid-template-columns: 4.5rem minmax(0, 1fr);
          gap: 0.55rem;
        }
        .profile-photo-row > div {
          flex-wrap: nowrap;
        }
        .profile-photo-row button,
        .photo-visibility,
        .add-section-button {
          font-size: 0.76rem;
        }
        .profile-photo-row button {
          padding-inline: 0.48rem;
        }
        .section-list {
          flex: 0 0 auto;
          overflow: visible;
        }
        .section-row {
          min-height: 3.35rem;
        }
        .add-section {
          margin-top: 0;
          padding: 0 1rem 1rem;
          border-top: 0;
        }
        .add-section {
          grid-template-columns: minmax(0, 1fr);
          gap: 0.65rem;
        }
        .inspector-tabs button,
        .inspector-group > label,
        .page-size-card > label {
          font-size: 0.82rem;
        }
        .inspector-group > p,
        .page-size-card > small,
        .template-control-card small {
          font-size: 0.74rem;
        }
        .template-control-card strong,
        .inspector-color-control code {
          font-size: 0.8rem;
        }
        .colors-panel {
          position: absolute;
          top: calc(100% + 0.65rem);
          right: auto;
          left: 0;
          width: 19rem;
        }
        .field-color-panel {
          right: 1rem;
          left: auto !important;
          width: 17.5rem;
          box-sizing: border-box;
        }
      }
      @media (max-width: 980px) {
        .editor-workspace {
          grid-template-columns: 15rem minmax(32rem, 1fr);
        }
        .design-panel {
          display: none;
        }
        .design-panel.typography-active {
          position: fixed;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 70;
          display: flex;
          width: 100%;
          height: min(72dvh, 42rem);
          border-top: 1px solid var(--editor-border);
          border-left: 0;
          border-radius: 16px 16px 0 0;
          box-shadow: 0 -12px 32px rgba(31, 35, 41, 0.16);
        }
        .preview-controls {
          right: auto;
        }
      }
      @media (max-width: 1100px) {
        .text-toolbar {
          top: 0;
        }
      }
      @media (max-width: 760px) {
        .editor-workspace {
          display: block;
          height: auto;
          overflow: visible;
        }
        .structure-panel {
          max-height: none;
        }
        .page-stage {
          min-height: 100svh;
        }
        .preview-controls {
          top: auto;
          right: auto;
          left: 50%;
          bottom: 0.75rem;
        }
        .field-color-panel {
          left: 0 !important;
          top: auto !important;
          bottom: 0;
          width: 100%;
          max-height: 55svh;
          box-sizing: border-box;
          border-radius: 8px 8px 0 0;
          padding: 16px;
        }
        .text-toolbar {
          flex-wrap: wrap;
        }
        .document-controls {
          flex-wrap: wrap;
        }
      }
      @page {
        size: A4;
        margin: 44px 0;
      }
      @media print {
        :host,
        .editor-shell,
        .editor-workspace,
        .page-stage,
        .preview-area {
          display: block;
          min-height: 0;
          overflow: visible;
          padding: 0;
          background: #ffffff;
        }
        .command-bar,
        .text-toolbar,
        .more-menu,
        .structure-panel,
        .preview-controls,
        .page-meta,
        .field-color-panel,
        .crop-backdrop {
          display: none !important;
        }
        .a4-viewport {
          width: 210mm !important;
          height: auto !important;
          margin: 0;
        }
        .a4-canvas {
          width: 210mm;
          transform: none !important;
        }
      }
    `,
  ],
})
export class ResumeEditorComponent implements OnInit, OnDestroy {
  @ViewChild('cropCanvas') private cropCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('previewArea')
  private set previewAreaRef(value: ElementRef<HTMLElement> | undefined) {
    this.previewArea = value;
    this.observePreview();
  }
  @ViewChild('previewCanvas')
  private set previewCanvasRef(value: ElementRef<HTMLElement> | undefined) {
    this.previewCanvas = value;
    this.observePreview();
  }
  protected readonly templates = RESUME_TEMPLATES;
  protected readonly colorGroups: Array<{
    key: ColorTarget;
    label: string;
    minimum: number;
  }> = [{ key: 'accent', label: 'Accent', minimum: 3 }];
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
  protected sectionMenuId = '';
  protected inspectorTab: 'design' | 'typography' | 'section' = 'design';
  protected newSectionType: ResumeSectionType = 'education';
  protected addSectionMenuOpen = false;
  protected templateMenuOpen = false;
  protected inspectorTemplateMenuOpen = false;
  protected photoError = '';
  protected typographyOpen = false;
  protected colorsOpen = false;
  protected fieldColorOpen = false;
  protected inlineToolbarOpen = false;
  protected inlineToolbarLeft = 0;
  protected inlineToolbarTop = 0;
  protected inlineWeight = 400;
  protected inlineWeightMenuOpen = false;
  protected inlineWeightMenuAlignLeft = false;
  protected readonly inlineWeightOptions = [
    { value: 300, label: 'Light' },
    { value: 400, label: 'Regular' },
    { value: 500, label: 'Medium' },
    { value: 600, label: 'Semibold' },
    { value: 700, label: 'Bold' },
    { value: 800, label: 'Extra bold' },
    { value: 900, label: 'Black' },
  ];
  protected moreOpen = false;
  protected recentFieldColors: string[] = [];
  protected get fieldPaletteGroups() {
    const groups = [
      {
        label: 'Document colors',
        colors: [
          ...new Set(
            [
              ...Object.values(this.currentColors),
              ...Object.values(this.resume?.fieldColors ?? {}),
            ].map((color) => color.toUpperCase()),
          ),
        ],
      },
    ];
    if (this.recentFieldColors.length)
      groups.push({ label: 'Recently used', colors: this.recentFieldColors });
    groups.push({
      label: 'Palette',
      colors: ['#FFFFFF', '#20272A', '#69736F', '#A30034', ...this.accentPresets],
    });
    return groups;
  }
  protected cropOpen = false;
  protected cropApplying = false;
  protected cropDraft: ResumePhotoCrop = { x: 0, y: 0, zoom: 1 };
  protected selectedColorField?: ResumeColorSelection;
  private paletteTarget?: ResumeColorSelection;
  protected readonly a4Width = (210 / 25.4) * 96;
  protected readonly a4Height = (297 / 25.4) * 96;
  protected previewScale = 1;
  protected previewContentHeight = this.a4Height;
  protected previewMode: 'fit' | 'manual' = 'fit';
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private saveTimer?: number;
  private saveInFlight = false;
  private editRevision = 0;
  private draggedSectionId = '';
  private pendingPhotoSource = '';
  private cropImage?: HTMLImageElement;
  private cropPointer?: { id: number; x: number; y: number };
  private previewArea?: ElementRef<HTMLElement>;
  private previewCanvas?: ElementRef<HTMLElement>;
  @ViewChild('resumeRenderer') private resumeRenderer?: ResumeRendererComponent;
  private previewResizeObserver?: ResizeObserver;

  ngOnInit() {
    this.loadPreviewPreference();
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const recovery = localStorage.getItem(this.recoveryKey(id));
    if (recovery) {
      this.resume = JSON.parse(recovery) as ResumeRecord;
      this.consolidateExperienceSections(this.resume);
      this.selectedSectionId = this.resume.sectionOrder[0] ?? '';
      this.saveState = 'Recovered local draft';
      return;
    }

    this.api.getResume(id).subscribe((resume) => {
      const consolidated = this.consolidateExperienceSections(resume);
      this.resume = resume;
      this.selectedSectionId = resume.sectionOrder[0] ?? '';
      if (consolidated) {
        this.markDirty();
      } else {
        this.saveState = 'Saved';
      }
    });
  }

  ngOnDestroy() {
    window.clearTimeout(this.saveTimer);
    this.previewResizeObserver?.disconnect();
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

  protected get selectedSectionTypeLabel() {
    return (
      this.sectionOptions.find((option) => option.type === this.newSectionType)?.label ?? 'section'
    );
  }

  protected get addSectionActionLabel() {
    const hasExperience = this.orderedSections.some((section) => section.type === 'experience');
    return this.newSectionType === 'experience' && hasExperience ? 'Add company' : 'Add section';
  }

  protected chooseSectionType(type: ResumeSectionType) {
    this.newSectionType = type;
    this.addSectionMenuOpen = false;
  }

  protected chooseTemplate(templateId: ResumeTemplateId) {
    if (!this.resume) return;
    this.resume.templateId = templateId;
    this.templateMenuOpen = false;
    this.inspectorTemplateMenuOpen = false;
    this.markDirty();
  }

  protected get displaySaveState() {
    return this.saveState === 'Saved' ? 'Saved just now' : this.saveState;
  }

  protected get selectedSection() {
    return this.orderedSections.find((section) => section.id === this.selectedSectionId);
  }

  protected selectSection(sectionId: string) {
    this.selectedSectionId = sectionId;
    this.sectionMenuId = '';
    this.addSectionMenuOpen = false;
    this.templateMenuOpen = false;
    this.inspectorTemplateMenuOpen = false;
  }

  protected toggleSectionMenu(sectionId: string, event: MouseEvent) {
    event.stopPropagation();
    this.sectionMenuId = this.sectionMenuId === sectionId ? '' : sectionId;
  }

  protected sectionSubtitle(type: ResumeSectionType) {
    const subtitles: Record<ResumeSectionType, string> = {
      summary: 'Introduce yourself',
      experience: 'Work history',
      education: 'Qualifications',
      projects: 'Key projects',
      skills: 'Technical skills',
      certifications: 'Credentials',
      languages: 'Languages',
      awards: 'Recognition',
      interests: 'Interests',
      custom: 'Custom content',
    };
    return subtitles[type];
  }

  protected get currentColors(): ResumeColors {
    return this.resume
      ? resolveResumeColors(this.resume)
      : { ...RESUME_TEMPLATE_COLOR_DEFAULTS['tech-core'] };
  }

  protected get selectedFieldColor() {
    const target = this.activeColorField;
    if (!target) return '#30383B';
    const inheritedColor =
      this.currentColors[target.role] ?? this.currentColors.body ?? this.currentColors.heading;
    return (this.resume?.fieldColors?.[target.key] ?? inheritedColor ?? '#30383B').toUpperCase();
  }

  protected get activeColorField() {
    return this.selectedColorField ?? this.paletteTarget;
  }

  protected get fieldColorMaxHeight() {
    const top = this.activeColorField?.top ?? 8;
    return Math.max(220, window.innerHeight - top - 12);
  }

  protected get selectedRoleColor() {
    const roleColor = this.activeColorField
      ? this.currentColors[this.activeColorField.role]
      : undefined;
    return roleColor ?? this.currentColors.body ?? this.currentColors.heading ?? '#30383B';
  }

  protected markDirty() {
    if (!this.resume) return;
    this.editRevision++;
    localStorage.setItem(this.recoveryKey(this.resume.id), JSON.stringify(this.resume));
    this.saveState = 'Unsaved local draft';
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), 900);
  }

  protected applyInlineStyle(command: { kind: 'weight' | 'italic'; value: number | boolean }) {
    this.resumeRenderer?.applyInlineStyle(command);
  }

  protected setInlineWeight(weight: number) {
    this.inlineWeight = weight;
    this.applyInlineStyle({ kind: 'weight', value: weight });
  }

  protected save() {
    if (!this.resume || this.saveInFlight) return;
    window.clearTimeout(this.saveTimer);
    // The renderer intentionally keeps native contenteditable input DOM-owned
    // until Enter or blur. Saving while one is focused can replace the resume
    // with a server response that predates the text currently being typed.
    if (this.hasFocusedEditable()) {
      this.saveTimer = window.setTimeout(() => this.save(), 900);
      return;
    }
    const revision = this.editRevision;
    this.saveInFlight = true;
    this.saveState = 'Saving';
    this.api.saveResume(structuredClone(this.resume)).subscribe({
      next: (saved) => {
        this.saveInFlight = false;
        // The user may have focused and started typing after this request was
        // sent. Keep that DOM intact and save its committed value after blur.
        if (this.hasFocusedEditable()) {
          this.saveState = 'Unsaved local draft';
          this.saveTimer = window.setTimeout(() => this.save(), 900);
          return;
        }
        // Sliders can change while a request is in flight. Save the newer draft
        // before replacing local state with a server response.
        if (revision !== this.editRevision) {
          this.save();
          return;
        }
        this.resume = saved;
        localStorage.removeItem(this.recoveryKey(saved.id));
        this.saveState = 'Saved';
      },
      error: () => {
        this.saveInFlight = false;
        this.saveState = 'Unable to save. Changes are stored locally.';
      },
    });
  }

  private hasFocusedEditable() {
    return document.activeElement instanceof HTMLElement &&
      document.activeElement.matches('[contenteditable="true"]');
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
    const sourcePrefix = `section:${section.id}:`;
    const duplicatePrefix = `section:${duplicate.id}:`;
    const copiedColors = Object.fromEntries(
      Object.entries(this.resume.fieldColors ?? {})
        .filter(([key]) => key.startsWith(sourcePrefix))
        .map(([key, color]) => [duplicatePrefix + key.slice(sourcePrefix.length), color]),
    );
    this.resume.fieldColors = { ...this.resume.fieldColors, ...copiedColors };
    const copiedTypography = Object.fromEntries(
      Object.entries(this.resume.fieldTypography ?? {})
        .filter(([key]) => key.startsWith(sourcePrefix))
        .map(([key, color]) => [duplicatePrefix + key.slice(sourcePrefix.length), color]),
    );
    this.resume.fieldTypography = { ...this.resume.fieldTypography, ...copiedTypography };
    const copiedRichText = Object.fromEntries(
      Object.entries(this.resume.richText ?? {})
        .filter(([key]) => key.startsWith(sourcePrefix))
        .map(([key, html]) => [duplicatePrefix + key.slice(sourcePrefix.length), html]),
    );
    this.resume.richText = { ...this.resume.richText, ...copiedRichText };
    this.resume.content.sections.push(duplicate);
    const index = this.resume.sectionOrder.indexOf(section.id);
    this.resume.sectionOrder.splice(index + 1, 0, duplicate.id);
    this.selectedSectionId = duplicate.id;
    this.markDirty();
  }

  protected addCompany(section: Extract<ResumeSection, { type: 'experience' }>) {
    section.items.push(this.createExperienceItem());
    this.selectedSectionId = section.id;
    this.markDirty();
  }

  protected deleteSection(section: ResumeSection) {
    if (!this.resume || !window.confirm('Delete the "' + section.title + '" section?')) return;
    this.resume.content.sections = this.resume.content.sections.filter(
      (item) => item.id !== section.id,
    );
    this.resume.fieldColors = Object.fromEntries(
      Object.entries(this.resume.fieldColors ?? {}).filter(
        ([key]) => !key.startsWith(`section:${section.id}:`),
      ),
    );
    this.resume.fieldTypography = Object.fromEntries(
      Object.entries(this.resume.fieldTypography ?? {}).filter(
        ([key]) => !key.startsWith(`section:${section.id}:`),
      ),
    );
    this.resume.richText = Object.fromEntries(
      Object.entries(this.resume.richText ?? {}).filter(
        ([key]) => !key.startsWith(`section:${section.id}:`),
      ),
    );
    this.resume.sectionOrder = this.resume.sectionOrder.filter((id) => id !== section.id);
    this.selectedSectionId = this.resume.sectionOrder[0] ?? '';
    this.markDirty();
  }

  protected addSection() {
    if (!this.resume) return;
    if (this.newSectionType === 'experience') {
      const experience = this.orderedSections.find(
        (section): section is Extract<ResumeSection, { type: 'experience' }> =>
          section.type === 'experience',
      );
      if (experience) {
        this.addCompany(experience);
        return;
      }
    }
    const section = this.createSection(this.newSectionType);
    this.resume.content.sections.push(section);
    this.resume.sectionOrder.push(section.id);
    this.selectedSectionId = section.id;
    this.markDirty();
  }

  protected presetsFor(target: ColorTarget) {
    if (['accent', 'headline', 'sectionTitle'].includes(target)) return this.accentPresets;
    if (['heading', 'name', 'organization', 'role', 'skillLabel'].includes(target)) {
      return this.headingPresets;
    }
    return this.bodyPresets;
  }

  protected colorValue(target: ColorTarget) {
    return this.currentColors[target].toUpperCase();
  }

  protected setColor(target: ColorTarget, value: string) {
    if (!this.resume || !/^#[0-9a-f]{6}$/i.test(value)) return;
    const next = { ...this.currentColors };
    const previous = next[target];
    next[target] = value.toLowerCase();
    const linkedRoles: Partial<Record<ColorTarget, ColorTarget[]>> = {
      accent: ['headline', 'sectionTitle'],
      heading: ['name', 'organization', 'role', 'skillLabel'],
      body: ['contact', 'meta', 'description', 'bullet', 'skillText'],
    };
    for (const role of linkedRoles[target] ?? []) {
      if (next[role] === previous) next[role] = value.toLowerCase();
    }
    this.resume.colors = next;
    this.markDirty();
  }

  protected openFieldColor(selection: ResumeColorSelection) {
    this.inlineToolbarOpen = selection.textSelected === true;
    this.inlineWeightMenuOpen = false;
    if (this.inlineToolbarOpen) {
      this.inlineWeight = selection.fontWeight ?? 400;
      const halfWidth = Math.min(156, Math.max(120, window.innerWidth / 2 - 8));
      this.inlineToolbarLeft = this.clamp(
        selection.left,
        halfWidth,
        Math.max(halfWidth, window.innerWidth - halfWidth),
      );
      this.inlineToolbarTop = Math.max(72, selection.top - 10);
      this.inlineWeightMenuAlignLeft = selection.left > window.innerWidth - 300;
      this.fieldColorOpen = false;
    }
    const panelWidth = 304;
    const panelHeight = Math.min(580, window.innerHeight * 0.65);
    this.selectedColorField = {
      ...selection,
      left: this.clamp(selection.left, 8, Math.max(8, window.innerWidth - panelWidth - 8)),
      top: this.clamp(selection.top, 8, Math.max(8, window.innerHeight - panelHeight - 8)),
    };
    this.paletteTarget = this.selectedColorField;
    this.colorsOpen = false;
    this.fieldColorOpen = false;
  }

  protected toggleFieldPalette(button: HTMLElement) {
    const target = this.selectedColorField ?? this.paletteTarget;
    if (!target) return;
    const rect = button.getBoundingClientRect();
    const panelWidth = Math.min(304, window.innerWidth - 16);
    this.selectedColorField = {
      ...target,
      left: this.clamp(rect.left, 8, Math.max(8, window.innerWidth - panelWidth - 8)),
      // The palette belongs below the control. Do not push it upward over the trigger
      // when viewport space is limited; the panel has its own vertical scrolling.
      top: rect.bottom + 10,
    };
    this.paletteTarget = this.selectedColorField;
    this.fieldColorOpen = !this.fieldColorOpen;
    this.colorsOpen = false;
  }

  protected setFieldColor(value: string) {
    const target = this.activeColorField;
    if (!this.resume || !target || !/^#[0-9a-f]{6}$/i.test(value)) return;
    this.resume.fieldColors = {
      ...this.resume.fieldColors,
      [target.key]: value.toLowerCase(),
    };
    this.recentFieldColors = [
      value.toUpperCase(),
      ...this.recentFieldColors.filter((color) => color !== value.toUpperCase()),
    ].slice(0, 8);
    this.markDirty();
  }

  protected onFieldNativeColor(event: Event) {
    this.setFieldColor((event.target as HTMLInputElement).value);
  }

  protected onFieldHexColor(event: Event) {
    const value = (event.target as HTMLInputElement).value.trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) this.setFieldColor(value);
  }

  protected clearFieldColor() {
    const target = this.activeColorField;
    if (!this.resume || !target) return;
    const next = { ...this.resume.fieldColors };
    delete next[target.key];
    this.resume.fieldColors = next;
    this.markDirty();
  }

  protected useFitPreview() {
    this.previewMode = 'fit';
    this.updatePreviewMeasurements();
    this.savePreviewPreference();
  }

  protected adjustPreviewScale(delta: number) {
    this.previewMode = 'manual';
    this.previewScale = this.clamp(this.previewScale + delta, 0.5, 1.25);
    this.savePreviewPreference();
  }

  protected downloadPdf() {
    this.fieldColorOpen = false;
    this.colorsOpen = false;
    window.setTimeout(() => window.print());
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

  protected contrastRatio(color: string, background = '#ffffff') {
    const foregroundLuminance = this.colorLuminance(color);
    const backgroundLuminance = this.colorLuminance(background);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);
    return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
  }

  private colorLuminance(color: string) {
    const hexChannels = color
      .replace('#', '')
      .match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
      ?.slice(1)
      .map((part) => Number.parseInt(part, 16));
    const rgbChannels = color
      .match(/rgba?\(\s*(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/i)
      ?.slice(1)
      .map(Number);
    const channels = hexChannels ?? rgbChannels ?? [255, 255, 255];
    return channels.reduce((sum, rawChannel, index) => {
      const channel = rawChannel / 255;
      const linear = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      return sum + linear * [0.2126, 0.7152, 0.0722][index];
    }, 0);
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
    this.typographyOpen = false;
    if (this.inspectorTab === 'typography') this.inspectorTab = 'design';
    this.inlineToolbarOpen = false;
    this.inlineWeightMenuOpen = false;
    window.getSelection()?.removeAllRanges();
    this.fieldColorOpen = false;
    this.moreOpen = false;
    this.colorsOpen = false;
    this.sectionMenuId = '';
    this.closeCropEditor();
  }

  @HostListener('document:mousedown', ['$event'])
  protected closeFieldColorOnOutsideClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.inline-text-toolbar')) return;
    if (!target?.closest('[data-color-key]')) {
      this.inlineToolbarOpen = false;
      this.inlineWeightMenuOpen = false;
    }
    if (
      target?.closest('.field-color-panel') ||
      target?.closest('.text-toolbar') ||
      target?.closest('[data-color-key]')
    ) {
      return;
    }
    this.fieldColorOpen = false;
    if (!target?.closest('.save-controls')) this.moreOpen = false;
    if (!target?.closest('.section-actions')) this.sectionMenuId = '';
    if (!target?.closest('.add-section-select')) this.addSectionMenuOpen = false;
    if (!target?.closest('.template-picker')) this.templateMenuOpen = false;
    if (!target?.closest('.template-card-picker')) this.inspectorTemplateMenuOpen = false;
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
        items: [this.createExperienceItem()],
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

  private createExperienceItem() {
    return {
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
  }

  private consolidateExperienceSections(resume: ResumeRecord) {
    const sections = resume.content.sections.filter(
      (section): section is Extract<ResumeSection, { type: 'experience' }> =>
        section.type === 'experience',
    );
    if (sections.length <= 1) return false;

    const [primary, ...duplicates] = sections;
    const duplicateIds = new Set(duplicates.map((section) => section.id));
    for (const duplicate of duplicates) {
      primary.items.push(...duplicate.items);
      const sourcePrefix = `section:${duplicate.id}:`;
      const targetPrefix = `section:${primary.id}:`;
      for (const [key, color] of Object.entries(resume.fieldColors ?? {})) {
        if (key.startsWith(sourcePrefix)) {
          resume.fieldColors ??= {};
          resume.fieldColors[targetPrefix + key.slice(sourcePrefix.length)] = color;
          delete resume.fieldColors[key];
        }
      }
      for (const [key, color] of Object.entries(resume.fieldTypography ?? {})) {
        if (key.startsWith(sourcePrefix)) {
          resume.fieldTypography ??= {};
          resume.fieldTypography[targetPrefix + key.slice(sourcePrefix.length)] = color;
          delete resume.fieldTypography[key];
        }
      }
      for (const [key, html] of Object.entries(resume.richText ?? {})) {
        if (key.startsWith(sourcePrefix)) {
          resume.richText ??= {};
          resume.richText[targetPrefix + key.slice(sourcePrefix.length)] = html;
          delete resume.richText[key];
        }
      }
    }
    resume.content.sections = resume.content.sections.filter(
      (section) => !duplicateIds.has(section.id),
    );
    resume.sectionOrder = resume.sectionOrder.filter((id) => !duplicateIds.has(id));
    return true;
  }

  private drawCropPreview() {
    const canvas = this.cropCanvas?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !this.cropImage) return;
    drawProfilePhotoCrop(context, this.cropImage, this.cropDraft, canvas.width);
  }

  private observePreview() {
    if (!this.previewArea?.nativeElement || !this.previewCanvas?.nativeElement) return;
    this.previewResizeObserver?.disconnect();
    this.previewResizeObserver = new ResizeObserver(() => this.updatePreviewMeasurements());
    this.previewResizeObserver.observe(this.previewArea.nativeElement);
    this.previewResizeObserver.observe(this.previewCanvas.nativeElement);
    window.setTimeout(() => this.updatePreviewMeasurements());
  }

  private updatePreviewMeasurements() {
    const area = this.previewArea?.nativeElement;
    const canvas = this.previewCanvas?.nativeElement;
    if (!area || !canvas) return;
    this.previewContentHeight = Math.max(this.a4Height, canvas.scrollHeight);
    if (this.previewMode === 'fit') {
      const availableWidth = Math.max(1, area.clientWidth - 16);
      this.previewScale = this.clamp(availableWidth / this.a4Width, 0.25, 1.25);
    }
  }

  private loadPreviewPreference() {
    const saved = localStorage.getItem('nexus:resume-preview');
    if (!saved) return;
    try {
      const preference = JSON.parse(saved) as { mode?: 'fit' | 'manual'; scale?: number };
      if (preference.mode === 'manual' && typeof preference.scale === 'number') {
        this.previewMode = 'manual';
        this.previewScale = this.clamp(preference.scale, 0.5, 1.25);
      }
    } catch {
      localStorage.removeItem('nexus:resume-preview');
    }
  }

  private savePreviewPreference() {
    localStorage.setItem(
      'nexus:resume-preview',
      JSON.stringify({ mode: this.previewMode, scale: this.previewScale }),
    );
  }

  private clamp(value: number, minimum: number, maximum: number) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  private recoveryKey(id: string) {
    return 'nexus:resume-recovery:' + id;
  }
}
