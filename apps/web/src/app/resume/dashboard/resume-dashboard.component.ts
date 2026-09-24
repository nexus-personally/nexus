import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideChartNoAxesColumnIncreasing,
  LucideCopy,
  LucideCheck,
  LucideFileText,
  LucidePlus,
  LucideSearch,
  LucideTrash2,
  LucideUpload,
  LucideUserRound,
  LucideX,
  LucideZap,
} from '@lucide/angular';
import type { ResumeRecord, ResumeTemplateId, ResumeTemplateMeta } from '@nexus/shared';
import { RESUME_TEMPLATES, createStarterResume } from '@nexus/shared';
import { ApiService } from '../../core/api.service';
import { cropProfilePhoto, prepareProfilePhotoSource } from '../profile-photo';
import { ResumeRendererComponent } from '../renderer/resume-renderer.component';

type TemplateFilter = 'all' | 'ats' | 'modern' | 'creative';

@Component({
  selector: 'nexus-resume-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ResumeRendererComponent,
    LucideArrowRight,
    LucideChartNoAxesColumnIncreasing,
    LucideCopy,
    LucideCheck,
    LucideFileText,
    LucidePlus,
    LucideSearch,
    LucideTrash2,
    LucideUpload,
    LucideUserRound,
    LucideX,
    LucideZap,
  ],
  template: `
    @if (!unlocked) {
      <main class="dashboard-shell" style="display:grid;min-height:100vh;place-items:center;padding:24px">
        <form (ngSubmit)="unlock()" style="width:min(420px,100%);padding:32px;border-radius:20px;background:#fff;box-shadow:0 20px 70px #09161b22">
          <span class="eyebrow">PRIVATE WORKSPACE</span>
          <h1>Unlock Resume Studio</h1>
          <p>Enter the admin access token configured for your NEXUS deployment.</p>
          <label for="admin-token">Admin access token</label>
          <input id="admin-token" name="adminToken" [(ngModel)]="adminTokenInput" type="password" autocomplete="current-password" required maxlength="512" style="display:block;width:100%;margin:12px 0;padding:12px;border:1px solid #aeb9bd;border-radius:8px" />
          @if (unlockError) { <p role="alert">{{ unlockError }}</p> }
          <button class="primary" type="submit" [disabled]="unlocking">{{ unlocking ? 'Checking…' : 'Unlock' }}</button>
        </form>
      </main>
    } @else {
    <main
      class="dashboard-shell"
      [class.panel-closed]="!createOpen"
      (document:keydown.escape)="closeOverlays()"
    >
      <header class="topbar">
        <div class="topbar-identity">
          <a routerLink="/" class="nexus-mark" aria-label="Back to NEXUS">
            <span aria-hidden="true">N</span>
            <span class="mark-tooltip" role="tooltip">Back to NEXUS</span>
          </a>
          <div class="product-title">
            <strong>NEXUS</strong>
            <span>Resume Studio</span>
          </div>
        </div>
        <nav class="topbar-nav" aria-label="Resume sections">
          <a class="active" href="/resume#templates-title">Templates</a>
          <a href="/resume#library-title">My resumes</a>
        </nav>
        <button class="primary topbar-action" type="button" (click)="openCreate()">
          <svg lucidePlus size="16"></svg>
          New resume
        </button>
        <a routerLink="/" class="profile-badge" aria-label="Back to NEXUS">N</a>
      </header>

      <section class="studio-hero" aria-labelledby="studio-hero-title">
        <div class="hero-copy">
          <span class="eyebrow">RESUME STUDIO</span>
          <h1 id="studio-hero-title">Choose your starting point</h1>
          <p>Professional templates. Your story. A stronger tomorrow.</p>
          <div class="hero-benefits" aria-label="Resume Studio benefits">
            <div class="hero-benefit">
              <span><svg lucideFileText size="20"></svg></span>
              <p>
                <strong>Professional templates</strong
                ><small>Designed for real opportunities</small>
              </p>
            </div>
            <div class="hero-benefit">
              <span><svg lucideZap size="20"></svg></span>
              <p><strong>Easy to customize</strong><small>Make it yours in minutes</small></p>
            </div>
            <div class="hero-benefit">
              <span><svg lucideChartNoAxesColumnIncreasing size="20"></svg></span>
              <p><strong>Get noticed</strong><small>ATS-friendly and recruiter ready</small></p>
            </div>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <p>A stronger you<br />starts here.</p>
          <img src="/assets/resume/resume-studio-mountain.png" alt="" />
          <span>Better opportunities<br />start with a<br />great resume.<i></i></span>
        </div>
      </section>

      <section class="workspace">
        <section class="template-section" aria-labelledby="templates-title">
          <header class="template-heading">
            <div>
              <span class="eyebrow">TEMPLATES</span>
              <h1 id="templates-title">Choose a template</h1>
              <p>Pick a professional layout to get started. You can customize it after creating.</p>
            </div>

            <div class="template-tools">
              <label class="search-field">
                <svg lucideSearch size="17"></svg>
                <input
                  [(ngModel)]="searchQuery"
                  type="search"
                  placeholder="Search templates..."
                  aria-label="Search templates"
                />
              </label>
              <div class="filter-tabs" role="tablist" aria-label="Template categories">
                @for (filter of filters; track filter.id) {
                  <button
                    type="button"
                    role="tab"
                    [class.active]="activeFilter === filter.id"
                    [attr.aria-selected]="activeFilter === filter.id"
                    (click)="activeFilter = filter.id"
                  >
                    {{ filter.label }}
                  </button>
                }
              </div>
            </div>
          </header>

          @if (errorMessage) {
            <div class="error-banner" role="alert">
              <div>
                <strong>Resume Studio needs attention</strong>
                <span>{{ errorMessage }}</span>
              </div>
              <button type="button" (click)="load()">Retry</button>
            </div>
          }

          <div class="template-grid" aria-label="Resume templates">
            @for (template of filteredTemplates; track template.id) {
              <article
                [class]="'template-card ' + template.id"
                [class.selected]="newTemplate === template.id"
              >
                <button
                  type="button"
                  class="template-preview"
                  [attr.aria-label]="'Select ' + template.name + ' template'"
                  [attr.aria-pressed]="newTemplate === template.id"
                  (click)="selectTemplate(template.id)"
                >
                  <span class="preview-document">
                    <span class="preview-scale">
                      <nexus-resume-renderer
                        [resume]="previewFor(template.id)"
                      />
                    </span>
                  </span>
                  @if (newTemplate === template.id) {
                    <span class="selection-check"><svg lucideCheck size="19"></svg></span>
                  }
                </button>

                <div class="template-summary">
                  <div class="template-line">
                    <h2>{{ template.name }}</h2>
                    <span [class]="'tag ' + template.id">{{
                      templateGalleryTag(template.id)
                    }}</span>
                  </div>
                  <p>{{ template.description }}</p>
                  <button
                    type="button"
                    class="template-use"
                    [class.selected]="newTemplate === template.id"
                    (click)="selectTemplate(template.id)"
                  >
                    {{ newTemplate === template.id ? 'Selected' : 'Use template' }}
                    <svg lucideArrowRight size="15"></svg>
                  </button>
                </div>
              </article>
            }
          </div>

          @if (filteredTemplates.length === 0) {
            <div class="no-results">
              <svg lucideFileText size="22"></svg>
              <strong>No matching templates</strong>
              <button type="button" (click)="clearFilters()">Clear filters</button>
            </div>
          }
        </section>

        <section class="resume-library" aria-labelledby="library-title">
          <header>
            <div>
              <span class="eyebrow">MY RESUMES</span>
              <h2 id="library-title">My resumes</h2>
              <p>Your saved resumes and drafts.</p>
            </div>
            <span>{{ resumes.length }} {{ resumes.length === 1 ? 'document' : 'documents' }}</span>
          </header>

          @if (!loading && resumes.length === 0) {
            <button class="empty-resume" type="button" (click)="openCreate()">
              <svg lucidePlus size="18"></svg>
              Create your first resume
            </button>
          } @else {
            <div class="resume-row" aria-label="Resume documents">
              @for (resume of resumes; track resume.id) {
                <article class="resume-item">
                  <a
                    class="resume-thumbnail"
                    [routerLink]="['/resume', resume.id, 'edit']"
                    [attr.aria-label]="'Edit ' + resume.name"
                  >
                    <span><nexus-resume-renderer [resume]="resume" /></span>
                  </a>
                  <div class="resume-details">
                    <span class="status"><i></i>{{ resume.status }}</span>
                    <a [routerLink]="['/resume', resume.id, 'edit']">{{ resume.name }}</a>
                    <small>Updated {{ resume.lastSavedAt | date: 'MMM d, y, h:mm a' }}</small>
                  </div>
                  <div class="resume-actions">
                    <button
                      type="button"
                      title="Duplicate resume"
                      [attr.aria-label]="'Duplicate ' + resume.name"
                      (click)="openConfirmation('duplicate', resume)"
                    >
                      <svg lucideCopy size="15"></svg>
                    </button>
                    <button
                      class="danger"
                      type="button"
                      title="Delete resume"
                      [attr.aria-label]="'Delete ' + resume.name"
                      (click)="openConfirmation('delete', resume)"
                    >
                      <svg lucideTrash2 size="15"></svg>
                    </button>
                  </div>
                </article>
              }
            </div>
          }
        </section>
      </section>

      @if (createOpen) {
        <div class="create-dialog-backdrop" (click)="closeCreate()">
          <section
            class="create-panel create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
            aria-describedby="create-description"
            (click)="$event.stopPropagation()"
          >
            <header>
              <div>
                <h2 id="create-title">Create resume</h2>
                <p id="create-description">Using {{ selectedTemplate.name }} template</p>
              </div>
              <button
                type="button"
                class="icon-button"
                aria-label="Close panel"
                (click)="closeCreate()"
              >
                <svg lucideX size="20"></svg>
              </button>
            </header>

            <div class="selected-preview">
              <span
                ><nexus-resume-renderer
                  [resume]="selectedPreview"
              /></span>
            </div>

            <div class="panel-form">
              <label for="resume-name">Resume name</label>
              <input
                id="resume-name"
                [(ngModel)]="newName"
                autofocus
                placeholder="e.g. Product Manager Resume"
              />

              <fieldset>
                <legend>Profile photo <span>(optional)</span></legend>
                <div
                  class="photo-uploader"
                  [class.has-photo]="photoPreviewDataUrl"
                  (dragover)="allowPhotoDrop($event)"
                  (drop)="onPhotoDrop($event)"
                >
                  @if (photoPreviewDataUrl) {
                    <img [src]="photoPreviewDataUrl" alt="Uploaded profile preview" />
                  } @else {
                    <span class="photo-placeholder"><svg lucideUserRound size="25"></svg></span>
                  }
                  <div>
                    <input
                      #photoInput
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      (change)="onPhotoSelected($event)"
                    />
                    <button type="button" class="upload-button" (click)="photoInput.click()">
                      <svg lucideUpload size="17"></svg>
                      {{ photoPreviewDataUrl ? 'Replace photo' : 'Upload photo' }}
                    </button>
                    <small>{{ photoFileName || 'Or drag and drop an image here' }}</small>
                    <small>JPG, PNG or WebP. Max 5 MB.</small>
                  </div>
                  @if (photoPreviewDataUrl) {
                    <button
                      type="button"
                      class="remove-photo"
                      aria-label="Remove profile photo"
                      title="Remove profile photo"
                      (click)="removePhoto()"
                    >
                      <svg lucideX size="15"></svg>
                    </button>
                  }
                </div>
                @if (photoError) {
                  <p class="field-error" role="alert">{{ photoError }}</p>
                }
              </fieldset>

              <label class="toggle-row">
                <span>
                  <strong>Include photo in resume</strong>
                  <small>{{ photoSupportMessage }}</small>
                </span>
                <input
                  type="checkbox"
                  [(ngModel)]="includePhoto"
                  [disabled]="!selectedTemplateSupportsPhoto"
                />
                <i aria-hidden="true"></i>
              </label>

              @if (selectedTemplateSupportsPhoto) {
                <p class="photo-note">
                  This template supports a profile photo, but it is completely optional.
                </p>
              } @else {
                <p class="photo-note neutral">
                  {{ selectedTemplate.name }} is optimized without a photo. Choose Modern Profile or
                  Creative to include one.
                </p>
              }
            </div>

            <footer>
              <button type="button" class="dialog-cancel" (click)="closeCreate()">Cancel</button>
              <button
                type="button"
                class="primary create-action"
                [disabled]="!newName.trim() || creating"
                (click)="create()"
              >
                {{ creating ? 'Creating...' : 'Create resume' }}
                @if (!creating) {
                  <svg lucideArrowRight size="17"></svg>
                }
              </button>
            </footer>
          </section>
        </div>
      }

      @if (confirmation; as confirmation) {
        <div class="confirmation-backdrop" (click)="closeConfirmation()">
          <section
            [class]="'confirmation-dialog ' + confirmation.action"
            role="alertdialog"
            aria-modal="true"
            [attr.aria-labelledby]="confirmation.action + '-confirmation-title'"
            [attr.aria-describedby]="confirmation.action + '-confirmation-description'"
            (click)="$event.stopPropagation()"
          >
            <div class="confirmation-icon" aria-hidden="true">
              @if (confirmation.action === 'delete') {
                <svg lucideTrash2 size="24"></svg>
              } @else {
                <svg lucideCopy size="24"></svg>
              }
            </div>
            <div class="confirmation-copy">
              <span>{{ confirmation.action === 'delete' ? 'Permanent action' : 'Create a copy' }}</span>
              <h2 [id]="confirmation.action + '-confirmation-title'">
                {{ confirmation.action === 'delete' ? 'Delete this resume?' : 'Duplicate this resume?' }}
              </h2>
              <p [id]="confirmation.action + '-confirmation-description'">
                @if (confirmation.action === 'delete') {
                  <strong>“{{ confirmation.resume.name }}”</strong> will be permanently removed. This
                  action cannot be undone.
                } @else {
                  A separate copy of <strong>“{{ confirmation.resume.name }}”</strong> will be added
                  to My resumes. You can edit it independently.
                }
              </p>
            </div>
            <footer>
              <button
                type="button"
                class="confirmation-cancel"
                autofocus
                [disabled]="confirmation.busy"
                (click)="closeConfirmation()"
              >
                Cancel
              </button>
              <button
                type="button"
                class="confirmation-action"
                [disabled]="confirmation.busy"
                (click)="confirmResumeAction()"
              >
                @if (!confirmation.busy) {
                  @if (confirmation.action === 'delete') {
                    <svg lucideTrash2 size="17"></svg>
                  } @else {
                    <svg lucideCopy size="17"></svg>
                  }
                }
                {{
                  confirmation.busy
                    ? confirmation.action === 'delete'
                      ? 'Deleting...'
                      : 'Duplicating...'
                    : confirmation.action === 'delete'
                      ? 'Delete resume'
                      : 'Duplicate resume'
                }}
              </button>
            </footer>
          </section>
        </div>
      }
    </main>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        color: #172231;
        background: #fbfaf8;
        font-family: Arial, sans-serif;
      }
      .dashboard-shell {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 22rem;
        grid-template-rows: 4.5rem minmax(calc(100svh - 4.5rem), auto);
        min-height: 100svh;
      }
      .dashboard-shell.panel-closed {
        grid-template-columns: minmax(0, 1fr);
      }
      .topbar-identity {
        display: flex;
        align-items: center;
        gap: 0.8rem;
      }
      .nexus-mark {
        position: relative;
        display: grid;
        place-items: center;
        width: 2.55rem;
        height: 2.55rem;
        border: 1px solid #293237;
        border-radius: 50%;
        background: #111719;
        color: #f1f4f2;
        font-weight: 800;
        text-decoration: none;
        transition:
          border-color 160ms ease,
          background 160ms ease,
          transform 160ms ease;
      }
      .nexus-mark:hover {
        border-color: #66cbd3;
        background: #172427;
        transform: translateY(-1px);
      }
      .mark-tooltip {
        position: absolute;
        left: 50%;
        top: calc(100% + 0.55rem);
        width: max-content;
        padding: 0.42rem 0.62rem;
        border-radius: 0.5rem;
        background: #111719;
        color: #ffffff;
        font-size: 0.66rem;
        font-weight: 600;
        opacity: 0;
        pointer-events: none;
        transform: translate(-50%, -0.2rem);
        transition:
          opacity 140ms ease,
          transform 140ms ease;
      }
      .nexus-mark:hover .mark-tooltip,
      .nexus-mark:focus-visible .mark-tooltip {
        opacity: 1;
        transform: translate(-50%, 0);
      }
      .topbar {
        position: sticky;
        top: 0.55rem;
        z-index: 4;
        grid-column: 1 / -1;
        display: flex;
        min-width: 0;
        align-items: center;
        justify-content: space-between;
        padding: 0 clamp(2rem, 5vw, 5rem);
        background: rgba(250, 251, 250, 0.96);
        border-bottom: 1px solid #d6dcda;
        backdrop-filter: blur(12px);
      }
      .product-title {
        display: grid;
        gap: 0.12rem;
      }
      .product-title strong {
        font-size: 1rem;
        letter-spacing: 0.01em;
      }
      .product-title span {
        color: #7b8490;
        font-size: 0.7rem;
      }
      .topbar-nav {
        display: flex;
        align-self: stretch;
        align-items: center;
        gap: 1.6rem;
        margin-left: auto;
        margin-right: 2rem;
      }
      .topbar-nav a {
        position: relative;
        display: inline-flex;
        height: 100%;
        align-items: center;
        color: #5f6978;
        font-size: 0.75rem;
        font-weight: 650;
        text-decoration: none;
      }
      .topbar-nav a:hover,
      .topbar-nav a.active {
        color: #172231;
      }
      .topbar-nav a.active::after {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        height: 2px;
        background: #f25555;
        content: '';
      }
      button,
      input {
        font: inherit;
      }
      button {
        border: 1px solid #c9d0cd;
        border-radius: var(--radius-button, 25px);
        background: #ffffff;
        color: #202527;
        cursor: pointer;
        transition:
          border-color 160ms ease,
          background 160ms ease,
          color 160ms ease,
          box-shadow 160ms ease,
          transform 160ms ease;
      }
      button:hover {
        border-color: #8f9b97;
      }
      button:active:not(:disabled) {
        transform: scale(0.98);
      }
      .primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        border-color: #f25555;
        background: #f25555;
        color: #ffffff;
        font-weight: 680;
      }
      .primary svg {
        color: #ffffff;
      }
      .primary:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }
      .topbar-action {
        min-height: 2.55rem;
        padding: 0 1.15rem;
      }
      .workspace {
        grid-column: 1;
        grid-row: 2;
        display: flex;
        flex-direction: column;
        min-width: 0;
        width: min(100%, 84rem);
        margin-inline: auto;
        padding: 2.75rem clamp(1.5rem, 3vw, 2.25rem) 4.5rem;
      }
      .template-heading {
        display: grid;
        gap: 1.45rem;
        margin-bottom: 1.65rem;
        text-align: center;
      }
      .eyebrow {
        color: #7b8795;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.62rem;
        letter-spacing: 0.08em;
      }
      h1,
      h2,
      p {
        margin: 0;
      }
      .template-heading h1 {
        margin-top: 0.35rem;
        color: #172231;
        font-family: Arial, sans-serif;
        font-size: clamp(2.45rem, 4vw, 3.2rem);
        line-height: 1.04;
        font-weight: 700;
      }
      .template-heading p,
      .resume-library p {
        margin-top: 0.55rem;
        color: #687383;
        font-size: 1rem;
        line-height: 1.5;
      }
      .template-tools {
        display: grid;
        grid-template-columns: minmax(15rem, 1fr) auto;
        align-items: center;
        gap: 1rem;
        margin-top: 0.35rem;
        text-align: left;
      }
      .search-field {
        display: flex;
        width: clamp(12rem, 18vw, 16rem);
        height: 2.5rem;
        align-items: center;
        gap: 0.45rem;
        padding: 0 0.7rem;
        border: 1px solid #d8dde3;
        border-radius: 0.9rem;
        background: #ffffff;
        color: #63706d;
      }
      .search-field:focus-within {
        border-color: #607caa;
        box-shadow: 0 0 0 3px rgba(96, 124, 170, 0.12);
      }
      .search-field input {
        min-width: 0;
        width: 100%;
        border: 0;
        outline: 0;
        background: transparent;
        color: #22282a;
        font-size: 0.76rem;
      }
      .filter-tabs {
        display: flex;
        gap: 0.3rem;
        justify-content: center;
      }
      .filter-tabs button {
        height: 2.5rem;
        padding: 0 0.85rem;
        border-color: #dce1e6;
        border-radius: 0.8rem;
        background: #ffffff;
        color: #4e5b6b;
        font-size: 0.72rem;
      }
      .filter-tabs button.active {
        border-color: #ffd8d8;
        background: #fff0ef;
        color: #db4646;
      }
      .error-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
        padding: 0.8rem 0.9rem;
        border: 1px solid #d8b6ad;
        background: #fff8f5;
      }
      .error-banner div {
        display: grid;
        gap: 0.18rem;
      }
      .error-banner span {
        color: #795b53;
        font-size: 0.72rem;
      }
      .error-banner button {
        padding: 0.45rem 0.65rem;
      }
      .template-grid {
        display: flex;
        box-sizing: border-box;
        width: 100%;
        max-width: 1440px;
        flex-wrap: wrap;
        justify-content: center;
        align-items: stretch;
        gap: 1.5rem;
        margin-inline: auto;
        padding-inline: clamp(32px, 5vw, 80px);
      }
      .template-section {
        padding-top: 0;
      }
      .template-card {
        display: flex;
        flex: 0 0 calc((100% - 3rem) / 3);
        min-height: 100%;
        min-width: 0;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid #dfe3e7;
        border-radius: 1.15rem;
        background: #ffffff;
        box-shadow: 0 1px 2px rgba(25, 32, 32, 0.04);
        transition:
          border-color 180ms ease,
          box-shadow 180ms ease,
          transform 180ms ease;
      }
      .template-card:hover {
        border-color: #c4ccd5;
        box-shadow: 0 14px 34px rgba(28, 37, 37, 0.1);
        transform: translateY(-2px);
      }
      .template-card.selected {
        border-color: #6bcddd;
        box-shadow: 0 0 0 2px rgba(107, 205, 221, 0.18);
      }
      .template-preview {
        position: relative;
        display: block;
        box-sizing: border-box;
        width: 100%;
        aspect-ratio: 0.72;
        overflow: hidden;
        padding: 0.45rem;
        border: 0;
        border-bottom: 1px solid #e2e5e8;
        border-radius: 0;
        background: #e9eeec;
        text-align: left;
        transition:
          background 180ms ease,
          box-shadow 180ms ease;
      }
      .template-card.tech-core .template-preview {
        background: #edf3f5;
      }
      .template-card.tech-modern .template-preview {
        background: #f2edf5;
      }
      .template-card.tech-minimal .template-preview {
        background: #f3f0ea;
      }
      .template-card.tech-executive .template-preview {
        background: #edf2eb;
      }
      .template-card.tech-creative .template-preview {
        background: #f8ece8;
      }
      .template-card.selected .template-preview {
        background: #e3f3f4;
      }
      .template-preview:hover {
        background: #e4eae8;
      }
      .preview-document {
        position: relative;
        display: block;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #ffffff;
        border-radius: 0.65rem;
        box-shadow: 0 7px 20px rgba(31, 39, 39, 0.13);
      }
      .preview-scale {
        position: absolute;
        left: 50%;
        top: 0;
        width: 210mm;
        transform: translateX(-50%) scale(0.42);
        transform-origin: top center;
        pointer-events: none;
      }
      .template-summary {
        display: grid;
        min-height: 9rem;
        flex: 1;
        grid-template-rows: auto 1fr auto;
        gap: 0.55rem;
        padding: 0.9rem 0.95rem 1rem;
      }
      .template-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.55rem;
      }
      .template-line h2 {
        min-width: 0;
        font-size: 1rem;
        font-weight: 680;
        line-height: 1.25;
      }
      .tag {
        flex: 0 0 auto;
        padding: 0.23rem 0.45rem;
        border-radius: 999px;
        background: #dcebed;
        color: #275c63;
        font-size: 0.6rem;
        font-weight: 700;
      }
      .tag.tech-modern {
        background: #ffe0f1;
        color: #922765;
      }
      .tag.tech-creative {
        background: #f7dff0;
        color: #8c2c69;
      }
      .template-summary p {
        color: #6c7773;
        font-size: 0.78rem;
        line-height: 1.45;
      }
      .template-use {
        display: inline-flex;
        width: fit-content;
        min-height: 2.35rem;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        padding: 0 0.8rem;
        border-color: #d3dbe2;
        border-radius: 0.8rem;
        background: #ffffff;
        color: #202527;
        font-size: 0.74rem;
        font-weight: 680;
      }
      .template-use.selected {
        border-color: #172231;
        background: #172231;
        color: #ffffff;
      }
      .template-use.selected svg {
        color: #7dd8e4;
      }
      .no-results {
        display: grid;
        min-height: 16rem;
        place-items: center;
        align-content: center;
        gap: 0.6rem;
        color: #68736f;
        border: 1px dashed #bfc8c4;
      }
      .no-results button {
        padding: 0.45rem 0.65rem;
      }
      .resume-library {
        order: -1;
        margin-bottom: 2.35rem;
        padding: 0 0 1.85rem;
        border-bottom: 1px solid #d1d7d4;
      }
      .resume-library > header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
      }
      .resume-library h2 {
        margin-top: 0.25rem;
        font-size: 1.55rem;
      }
      .resume-library > header > span {
        color: #747e7a;
        font-size: 0.72rem;
      }
      .resume-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 0.8rem;
        margin-top: 1rem;
      }
      .resume-item {
        display: grid;
        grid-template-columns: 5.2rem minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.75rem;
        min-width: 0;
        width: 100%;
        max-width: 42rem;
        min-height: 7.4rem;
        padding: 0.85rem;
        box-sizing: border-box;
        border: 1px solid #d2d8d5;
        border-radius: 0.65rem;
        background: #fbfcfb;
      }
      .resume-thumbnail {
        position: relative;
        display: block;
        width: 5.2rem;
        height: 6.8rem;
        overflow: hidden;
        background: #ffffff;
        box-shadow: 0 2px 8px rgba(30, 38, 38, 0.1);
      }
      .resume-thumbnail > span {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 4.07rem;
        height: 5.75rem;
        transform: translate(-50%, -50%);
        pointer-events: none;
      }
      .resume-thumbnail > span nexus-resume-renderer {
        position: absolute;
        left: 0;
        top: 0;
        width: 210mm;
        transform: scale(0.082);
        transform-origin: top left;
      }
      .resume-details {
        display: grid;
        min-width: 0;
        gap: 0.18rem;
      }
      .resume-details > a {
        overflow: hidden;
        color: #202628;
        font-size: 0.78rem;
        font-weight: 680;
        text-decoration: none;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .resume-details small,
      .status {
        color: #76807c;
        font-size: 0.62rem;
      }
      .status {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        text-transform: capitalize;
      }
      .status i {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #65ba94;
      }
      .resume-actions {
        display: flex;
        gap: 0.2rem;
      }
      .resume-actions button {
        display: grid;
        width: 2rem;
        height: 2rem;
        place-items: center;
        padding: 0;
        border-color: transparent;
        border-radius: 50%;
        background: transparent;
        color: #65706c;
      }
      .resume-actions .danger {
        color: #a14d49;
      }
      .empty-resume {
        display: flex;
        width: 100%;
        min-height: 5.8rem;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        margin-top: 1rem;
        border-style: dashed;
        background: transparent;
        color: #53625e;
      }
      .create-panel {
        position: sticky;
        top: 4.5rem;
        z-index: 3;
        grid-column: 2;
        grid-row: 2;
        align-self: start;
        height: calc(100svh - 4.5rem);
        overflow: auto;
        background: #fbfcfb;
        border-left: 1px solid #d4dad7;
        box-shadow: -8px 0 24px rgba(24, 31, 31, 0.04);
      }
      .create-panel > header {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        align-items: start;
        justify-content: space-between;
        padding: 1.35rem 1.3rem 1rem;
        background: rgba(251, 252, 251, 0.96);
        border-bottom: 1px solid #dfe4e2;
        backdrop-filter: blur(10px);
      }
      .create-panel h2 {
        font-size: 1.2rem;
      }
      .create-panel header p {
        margin-top: 0.25rem;
        color: #6f7a76;
        font-size: 0.72rem;
      }
      .icon-button {
        display: grid;
        width: 2.1rem;
        height: 2.1rem;
        place-items: center;
        padding: 0;
        border-color: transparent;
        border-radius: 50%;
        background: transparent;
      }
      .selected-preview {
        position: relative;
        height: 17rem;
        margin: 1rem 1.3rem 0;
        overflow: hidden;
        background: #eef1f0;
        border: 1px solid #dbe0de;
        border-radius: 0.65rem;
      }
      .selected-preview > span {
        position: absolute;
        left: 50%;
        top: 0.7rem;
        width: 210mm;
        transform: translateX(-50%) scale(0.245);
        transform-origin: top center;
        pointer-events: none;
      }
      .panel-form {
        display: grid;
        gap: 0.65rem;
        padding: 1.15rem 1.3rem;
      }
      .panel-form > label:not(.toggle-row),
      fieldset legend {
        color: #303638;
        font-size: 0.72rem;
        font-weight: 680;
      }
      .panel-form > input {
        width: 100%;
        border: 1px solid #c8d0cc;
        border-radius: 0.75rem;
        padding: 0.72rem 0.75rem;
        background: #ffffff;
        color: #202527;
        outline: 0;
        font-size: 0.8rem;
      }
      .panel-form > input:focus {
        border-color: #4c8a91;
        box-shadow: 0 0 0 3px rgba(76, 138, 145, 0.12);
      }
      fieldset {
        min-width: 0;
        margin: 0.7rem 0 0;
        padding: 0;
        border: 0;
      }
      fieldset legend span {
        color: #7e8784;
        font-weight: 500;
      }
      .photo-uploader {
        position: relative;
        display: grid;
        grid-template-columns: 3.6rem minmax(0, 1fr);
        align-items: center;
        gap: 0.75rem;
        margin-top: 0.55rem;
        padding: 0.75rem;
        border: 1px dashed #bdc7c3;
        border-radius: 0.75rem;
        background: #f7f9f8;
      }
      .photo-uploader > img,
      .photo-placeholder {
        display: grid;
        width: 3.6rem;
        height: 3.6rem;
        place-items: center;
        border-radius: 50%;
        object-fit: cover;
      }
      .photo-uploader > img {
        border: 2px solid #5cbec5;
      }
      .photo-placeholder {
        background: #e3e9e7;
        color: #66736f;
      }
      .photo-uploader > div {
        display: grid;
        min-width: 0;
        gap: 0.2rem;
      }
      .photo-uploader input {
        display: none;
      }
      .upload-button {
        display: inline-flex;
        width: fit-content;
        align-items: center;
        gap: 0.4rem;
        padding: 0.42rem 0.55rem;
        border-color: transparent;
        background: transparent;
        color: #214f56;
        font-size: 0.72rem;
        font-weight: 680;
      }
      .photo-uploader small {
        overflow: hidden;
        color: #7a8480;
        font-size: 0.6rem;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .remove-photo {
        position: absolute;
        top: 0.45rem;
        right: 0.45rem;
        display: grid;
        width: 1.8rem;
        height: 1.8rem;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: #ffffff;
        color: #9b4944;
        box-shadow: 0 2px 8px rgba(30, 38, 38, 0.12);
      }
      .field-error {
        margin-top: 0.35rem;
        color: #a04740;
        font-size: 0.66rem;
      }
      .toggle-row {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-top: 0.55rem;
        cursor: pointer;
      }
      .toggle-row > span {
        display: grid;
        gap: 0.2rem;
      }
      .toggle-row strong {
        font-size: 0.72rem;
      }
      .toggle-row small {
        color: #78827e;
        font-size: 0.61rem;
      }
      .toggle-row input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
      }
      .toggle-row i {
        position: relative;
        flex: 0 0 auto;
        width: 2.45rem;
        height: 1.4rem;
        border-radius: 999px;
        background: #c9d0cd;
        transition: background 160ms ease;
      }
      .toggle-row i::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 1rem;
        height: 1rem;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 1px 4px rgba(22, 28, 28, 0.2);
        transition: translate 160ms ease;
      }
      .toggle-row input:checked + i {
        background: #34b9c2;
      }
      .toggle-row input:checked + i::after {
        translate: 1.05rem 0;
      }
      .toggle-row input:disabled + i {
        opacity: 0.48;
      }
      .photo-note {
        padding: 0.75rem;
        border: 1px solid #cde2e4;
        border-radius: 0.75rem;
        background: #eff8f8;
        color: #4c6b6f;
        font-size: 0.66rem;
        line-height: 1.5;
      }
      .photo-note.neutral {
        border-color: #d9dedc;
        background: #f3f5f4;
        color: #6c7773;
      }
      .create-panel > footer {
        position: sticky;
        bottom: 0;
        padding: 0.8rem 1.3rem 1.2rem;
        background: #fbfcfb;
        border-top: 1px solid #e0e5e3;
      }
      .create-action {
        width: 100%;
        min-height: 2.75rem;
      }
      @media (max-width: 1220px) {
        .dashboard-shell,
        .dashboard-shell.panel-closed {
          display: block;
        }
        .create-panel {
          position: relative;
          top: auto;
          width: auto;
          height: auto;
          margin: 0 clamp(2rem, 5vw, 5rem) 3rem;
          overflow: visible;
          border: 1px solid #d4dad7;
          border-radius: 1rem;
          box-shadow: 0 18px 48px rgba(20, 27, 27, 0.1);
        }
        .create-panel > header,
        .create-panel > footer {
          position: static;
        }
        .template-heading {
          grid-template-columns: 1fr;
          align-items: start;
        }
        .template-tools {
          flex-wrap: wrap;
        }
        .resume-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 980px) {
        .template-grid {
          gap: 1rem;
        }
        .template-card {
          flex-basis: calc((100% - 1rem) / 2);
        }
      }
      @media (max-width: 820px) {
        .topbar {
          min-height: 4rem;
          padding: 0 1rem;
        }
        .topbar-nav {
          display: none;
        }
        .product-title span {
          display: none;
        }
        .workspace {
          padding: 1.35rem 1rem 3rem;
        }
        .template-tools,
        .search-field {
          width: 100%;
        }
        .template-grid {
          gap: 1rem;
        }
        .filter-tabs {
          width: 100%;
          overflow-x: auto;
        }
        .filter-tabs button {
          flex: 1 0 auto;
        }
        .template-card {
          flex-basis: calc((100% - 1rem) / 2);
        }
        .preview-scale {
          transform: translateX(-50%) scale(0.38);
        }
        .resume-row {
          grid-template-columns: minmax(0, 1fr);
        }
        .create-panel {
          margin: 0 1rem 2rem;
        }
      }
      @media (max-width: 560px) {
        .template-card {
          flex-basis: 100%;
        }
      }
      .profile-badge {
        display: grid;
        width: 42px;
        height: 42px;
        place-items: center;
        border: 1px solid #dde5ec;
        border-radius: 50%;
        color: #122033;
        font-weight: 700;
        text-decoration: none;
      }
      .studio-hero {
        position: relative;
        grid-column: 1 / -1;
        grid-row: 2;
        min-height: 258px;
        overflow: hidden;
        padding: 34px clamp(32px, 4vw, 58px) 32px;
        background: #edfaff;
      }
      .hero-copy {
        position: relative;
        z-index: 2;
        max-width: 820px;
      }
      .studio-hero h1 {
        margin: 10px 0 4px;
        color: #050b16;
        font-size: clamp(2.75rem, 4vw, 3.45rem);
        font-weight: 800;
        letter-spacing: -0.055em;
        line-height: 1.02;
      }
      .studio-hero > .hero-copy > p {
        margin: 0;
        color: #66768f;
        font-size: 1.23rem;
        line-height: 1.5;
      }
      .hero-benefits {
        display: flex;
        gap: clamp(42px, 6vw, 86px);
        margin-top: 27px;
      }
      .hero-benefit {
        display: flex;
        align-items: center;
        gap: 13px;
      }
      .hero-benefit > span {
        display: grid;
        width: 48px;
        height: 48px;
        flex: 0 0 48px;
        place-items: center;
        border: 1px solid #c8edf6;
        border-radius: 50%;
        background: rgba(226, 248, 253, 0.9);
        color: #0695c2;
      }
      .hero-benefit p {
        display: grid;
        gap: 3px;
        margin: 0;
        color: #33445c;
        font-size: 0.83rem;
      }
      .hero-benefit small {
        color: #728198;
        font-size: 0.75rem;
      }
      .hero-art {
        position: absolute;
        inset: 0 0 0 auto;
        width: min(47%, 700px);
      }
      .hero-art > p {
        position: absolute;
        z-index: 2;
        top: 33px;
        left: 16px;
        margin: 0;
        color: #42698b;
        font-family: 'Segoe Print', 'Bradley Hand', cursive;
        font-size: 1.55rem;
        font-style: italic;
        line-height: 1.12;
        transform: rotate(-8deg);
      }
      .hero-art > p::after {
        display: block;
        width: 42px;
        height: 2px;
        margin: 13px 0 0 54px;
        background: #04a5d2;
        content: '';
        transform: rotate(-6deg);
      }
      .hero-art img {
        position: absolute;
        right: 66px;
        bottom: -1px;
        width: 355px;
        height: 170px;
        border-radius: 66px 66px 0 0;
        object-fit: cover;
      }
      .hero-art > span {
        position: absolute;
        z-index: 3;
        right: 28px;
        bottom: 20px;
        min-width: 155px;
        padding: 20px 22px 17px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 12px 30px rgba(54, 91, 114, 0.11);
        color: #3d4f69;
        font-size: 0.93rem;
        line-height: 1.28;
      }
      .hero-art > span i {
        display: block;
        width: 24px;
        height: 2px;
        margin-top: 13px;
        background: #05a9d5;
      }
      .dashboard-shell,
      .dashboard-shell.panel-closed {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: 60px auto auto;
        min-height: 100svh;
        background: #f9fbfc;
      }
      .dashboard-shell:not(.panel-closed) {
        grid-template-columns: minmax(0, 1fr) 22rem;
      }
      .topbar {
        grid-column: 1 / -1;
        min-height: 60px;
        padding: 0 44px 0 54px;
        border-bottom: 1px solid #e6ebef;
        background: rgba(255, 255, 255, 0.96);
      }
      .nexus-mark {
        display: none;
      }
      .topbar-identity {
        gap: 20px;
      }
      .product-title {
        display: flex;
        align-items: baseline;
        gap: 19px;
      }
      .product-title strong {
        font-size: 1.45rem;
        letter-spacing: -0.04em;
      }
      .product-title span {
        color: #52617a;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .topbar-nav {
        margin-left: auto;
      }
      .topbar-nav a {
        padding: 21px 0 18px;
        color: #2c394d;
        font-size: 0.82rem;
        font-weight: 700;
      }
      .topbar-nav a.active::after {
        height: 3px;
        background: #08a7d4;
      }
      .topbar-action {
        min-height: 44px;
        margin-left: 26px;
        padding: 0 26px;
        border: 0;
        background: #08a9d2;
        box-shadow: 0 8px 18px rgba(0, 153, 199, 0.15);
        font-size: 0.9rem;
      }
      .profile-badge {
        margin-left: 10px;
      }
      .workspace {
        display: flex;
        flex-direction: column;
        grid-column: 1;
        grid-row: 3;
        min-width: 0;
        padding: 18px clamp(32px, 4vw, 58px) 34px;
        background: #fff;
        border-radius: 46px 46px 0 0;
        box-shadow: 0 -10px 34px rgba(22, 77, 105, 0.04);
      }
      .resume-library {
        order: -1;
        padding: 0 0 26px;
        border-bottom: 1px solid #e3eaee;
        background: transparent;
      }
      .resume-library > header {
        margin-bottom: 11px;
      }
      .resume-library .eyebrow {
        display: none;
      }
      .resume-library h2 {
        margin: 0 0 2px;
        color: #0c1421;
        font-size: 1.65rem;
        letter-spacing: -0.035em;
      }
      .resume-library p {
        font-size: 1rem;
      }
      .resume-library > header > span {
        color: #697890;
        font-size: 0.8rem;
      }
      .resume-row {
        display: block;
      }
      .resume-item {
        grid-template-columns: 88px minmax(0, 1fr) auto;
        width: min(100%, 795px);
        min-height: 128px;
        padding: 12px 20px;
        border: 1px solid #d9e6ec;
        border-radius: 14px;
        background: #f9fdff;
        box-shadow: none;
      }
      .resume-thumbnail {
        width: 72px;
        height: 98px;
        border: 0;
        border-radius: 3px;
        box-shadow: 0 3px 10px rgba(31, 52, 71, 0.12);
      }
      .resume-details > a {
        color: #101923;
        font-size: 1rem;
      }
      .resume-details small {
        color: #6c7c92;
      }
      .resume-actions button {
        width: 44px;
        height: 44px;
        border: 1px solid #d7e2e8;
        background: #fff;
      }
      .resume-actions .danger {
        border-color: #ffdadd;
        background: #fff7f7;
        color: #ff3640;
      }
      .template-section {
        padding-top: 22px;
      }
      .template-heading {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
        gap: 24px;
        margin-bottom: 18px;
      }
      .template-heading .eyebrow {
        margin-bottom: 6px;
      }
      .template-heading h1 {
        margin: 0 0 2px;
        color: #08101b;
        font-size: 2.1rem;
        letter-spacing: -0.045em;
      }
      .template-heading p {
        margin: 0;
        color: #6c7b91;
        font-size: 0.98rem;
      }
      .template-tools {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .search-field {
        width: 280px;
        height: 46px;
        border-color: #d5e0e6;
        border-radius: 25px;
        background: #fff;
      }
      .filter-tabs {
        gap: 8px;
        padding: 0;
        background: transparent;
      }
      .filter-tabs button {
        min-width: 62px;
        height: 44px;
        border: 1px solid #d9e3e9;
        border-radius: 25px;
        background: #fff;
        color: #334159;
      }
      .filter-tabs button.active {
        border-color: #c9f0f8;
        background: #d9f7fd;
        color: #078db7;
      }
      .template-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 18px;
        max-width: none;
        padding: 0;
      }
      .template-card {
        display: flex;
        min-width: 0;
        height: 338px;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid #dee7eb;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 6px 18px rgba(32, 62, 80, 0.035);
      }
      .template-card.selected {
        border: 2px solid #08b4dc;
        box-shadow: 0 8px 22px rgba(3, 177, 218, 0.12);
      }
      .template-preview {
        height: 284px;
        min-height: 0;
        padding: 12px 10px 0;
        border: 0;
        border-radius: 0;
        background: #fbfcfc;
      }
      .preview-document {
        height: 100%;
        border-radius: 3px 3px 0 0;
        box-shadow: none;
      }
      .preview-scale {
        transform: translateX(-50%) scale(0.34);
        transform-origin: top center;
      }
      .template-summary {
        padding: 12px 13px;
        border-top: 1px solid #edf1f3;
      }
      .template-summary p,
      .template-use {
        display: none;
      }
      .template-line h2 {
        font-size: 0.96rem;
        letter-spacing: -0.02em;
      }
      .tag {
        padding: 5px 12px;
        border-radius: 999px;
        background: #dff7fb;
        color: #078ab1;
        font-size: 0.7rem;
        font-weight: 600;
      }
      .create-panel {
        grid-column: 2;
        grid-row: 3;
        height: calc(100svh - 60px);
        top: 60px;
      }
      @media (max-width: 1180px) {
        .hero-art {
          opacity: 0.5;
        }
        .template-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .template-card:nth-child(n + 4) {
          transform: translateX(50%);
        }
      }
      @media (max-width: 900px) {
        .studio-hero {
          min-height: 300px;
        }
        .hero-art {
          display: none;
        }
        .template-heading {
          grid-template-columns: 1fr;
          align-items: start;
        }
        .template-tools {
          flex-wrap: wrap;
        }
        .template-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .template-card:nth-child(n + 4) {
          transform: none;
        }
        .dashboard-shell:not(.panel-closed) {
          grid-template-columns: 1fr;
        }
        .create-panel {
          grid-column: 1;
          grid-row: auto;
          position: relative;
          top: auto;
          height: auto;
        }
      }
      @media (max-width: 700px) {
        .topbar {
          padding: 0 16px;
        }
        .topbar-nav {
          display: none;
        }
        .product-title span {
          display: none;
        }
        .topbar-action {
          margin-left: auto;
          padding-inline: 18px;
        }
        .profile-badge {
          display: none;
        }
        .studio-hero {
          min-height: auto;
          padding: 30px 20px;
        }
        .studio-hero h1 {
          font-size: 2.35rem;
        }
        .hero-benefits {
          display: grid;
          gap: 14px;
        }
        .workspace {
          padding: 20px;
          border-radius: 28px 28px 0 0;
        }
        .resume-item {
          grid-template-columns: 72px minmax(0, 1fr);
          width: 100%;
        }
        .resume-actions {
          grid-column: 2;
        }
        .template-tools,
        .search-field {
          width: 100%;
        }
        .filter-tabs {
          width: 100%;
          overflow-x: auto;
        }
        .template-grid {
          grid-template-columns: 1fr;
        }
        .template-card {
          height: 390px;
        }
        .template-preview {
          height: 336px;
        }
        .preview-scale {
          transform: translateX(-50%) scale(0.41);
        }
      }

      .topbar {
        display: flex;
        align-items: center;
      }
      .template-section,
      .resume-library {
        width: 100%;
        max-width: none;
        margin-inline: 0;
      }
      .workspace {
        width: 100%;
        max-width: none;
        margin: 0;
      }
      .template-grid {
        width: 100%;
        max-width: none;
        margin-inline: 0;
        padding-inline: 0;
      }
      .resume-item {
        max-width: 795px;
      }
      .template-heading,
      .template-heading > div {
        text-align: left;
      }
      @media (max-width: 560px) {
        .resume-row {
          grid-template-columns: 1fr;
        }
        .preview-scale {
          transform: translateX(-50%) scale(0.34);
        }
        .template-heading h1 {
          font-size: 1.8rem;
        }
        .resume-item {
          grid-template-columns: 4.4rem minmax(0, 1fr);
        }
        .resume-thumbnail {
          width: 4.4rem;
          height: 5.8rem;
        }
        .resume-actions {
          grid-column: 2;
        }
      }
    `,
  ],
  styleUrls: ['./resume-dashboard.reference.scss'],
})
export class ResumeDashboardComponent implements OnInit {
  protected unlocked = false;
  protected adminTokenInput = '';
  protected unlocking = false;
  protected unlockError = '';
  protected readonly templates = RESUME_TEMPLATES;
  protected readonly filters: Array<{ id: TemplateFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'ats', label: 'ATS' },
    { id: 'modern', label: 'Modern' },
    { id: 'creative', label: 'Creative' },
  ];
  protected readonly templatePreviews = new Map<ResumeTemplateId, ResumeRecord>(
    RESUME_TEMPLATES.map((template) => [template.id, this.buildTemplatePreview(template.id)]),
  );
  protected resumes: ResumeRecord[] = [];
  protected newName = 'Product Manager Resume';
  protected newTemplate: ResumeTemplateId = 'tech-modern';
  protected createOpen = false;
  protected creating = false;
  protected loading = true;
  protected errorMessage = '';
  protected photoError = '';
  protected photoPreviewDataUrl = '';
  private photoSourceDataUrl = '';
  protected photoFileName = '';
  protected includePhoto = true;
  protected activeFilter: TemplateFilter = 'all';
  protected searchQuery = '';
  protected confirmation?: {
    action: 'duplicate' | 'delete';
    resume: ResumeRecord;
    busy: boolean;
  };
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  ngOnInit() {
    if (this.api.hasAdminToken) {
      this.unlocked = true;
      this.load();
    } else {
      this.loading = false;
    }
  }

  protected unlock() {
    if (!this.adminTokenInput.trim() || this.unlocking) return;
    this.unlocking = true;
    this.unlockError = '';
    this.api.verifyAdminToken(this.adminTokenInput).subscribe({
      next: (resumes) => {
        this.api.setAdminToken(this.adminTokenInput);
        this.unlocked = true;
        this.resumes = resumes;
        this.loading = false;
        this.unlocking = false;
        this.adminTokenInput = '';
      },
      error: () => {
        this.api.clearAdminToken();
        this.unlocking = false;
        this.unlockError = 'The token was rejected, or the API could not be reached.';
      },
    });
  }

  protected get filteredTemplates() {
    const query = this.searchQuery.trim().toLowerCase();
    return this.templates.filter((template) => {
      const matchesSearch =
        !query ||
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query);
      const matchesFilter =
        this.activeFilter === 'all' ||
        this.templateGalleryTag(template.id).toLowerCase() === this.activeFilter;
      return matchesSearch && matchesFilter;
    });
  }

  protected get selectedTemplate(): ResumeTemplateMeta {
    return this.templates.find((template) => template.id === this.newTemplate) ?? this.templates[0];
  }

  protected get selectedPreview(): ResumeRecord {
    return this.previewFor(this.newTemplate);
  }

  protected get selectedTemplateSupportsPhoto() {
    return this.selectedTemplate.photoDefault !== 'hidden';
  }

  protected get photoSupportMessage() {
    return this.selectedTemplateSupportsPhoto
      ? 'You can change this later.'
      : 'Not used by this template.';
  }

  protected load() {
    this.loading = true;
    this.errorMessage = '';
    this.api.listResumes().subscribe({
      next: (resumes) => {
        this.resumes = resumes;
        this.loading = false;
      },
      error: () => {
        if (this.api.hasAdminToken) this.api.clearAdminToken();
        this.unlocked = false;
        this.loading = false;
        this.errorMessage = 'The API could not load your saved resumes.';
      },
    });
  }

  protected openCreate() {
    this.createOpen = true;
  }

  protected closeCreate() {
    if (!this.creating) this.createOpen = false;
  }

  protected selectTemplate(id: ResumeTemplateId) {
    this.newTemplate = id;
    this.createOpen = true;
    this.includePhoto =
      this.templates.find((template) => template.id === id)?.photoDefault !== 'hidden';
  }

  protected clearFilters() {
    this.searchQuery = '';
    this.activeFilter = 'all';
  }

  protected previewFor(id: ResumeTemplateId) {
    return this.templatePreviews.get(id) ?? this.templatePreviews.values().next().value!;
  }

  protected templateTag(id: ResumeTemplateId) {
    const labels: Record<ResumeTemplateId, string> = {
      'tech-core': 'ATS',
      'tech-modern': 'Photo',
      'tech-minimal': 'One page',
      'tech-executive': 'Popular',
      'tech-creative': 'Creative',
    };
    return labels[id];
  }

  protected templateGalleryTag(id: ResumeTemplateId) {
    const labels: Record<ResumeTemplateId, string> = {
      'tech-core': 'ATS',
      'tech-modern': 'Modern',
      'tech-minimal': 'Creative',
      'tech-executive': 'Modern',
      'tech-creative': 'Creative',
    };
    return labels[id];
  }

  protected allowPhotoDrop(event: DragEvent) {
    event.preventDefault();
  }

  protected onPhotoDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.readPhoto(file);
  }

  protected onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.readPhoto(file);
    input.value = '';
  }

  protected removePhoto() {
    this.photoPreviewDataUrl = '';
    this.photoSourceDataUrl = '';
    this.photoFileName = '';
    this.photoError = '';
  }

  protected create() {
    if (!this.newName.trim() || this.creating) return;
    this.creating = true;
    this.errorMessage = '';
    this.api.createResume(this.newName.trim(), this.newTemplate).subscribe({
      next: (resume) => {
        resume.content.profile.photoSourceDataUrl = this.photoSourceDataUrl || undefined;
        resume.content.profile.photoDataUrl = this.photoPreviewDataUrl || undefined;
        resume.content.profile.photoCrop = this.photoPreviewDataUrl
          ? { x: 0, y: 0, zoom: 1 }
          : undefined;
        resume.content.profile.photoVisible =
          this.includePhoto && this.selectedTemplateSupportsPhoto && !!this.photoPreviewDataUrl;

        if (this.photoPreviewDataUrl) {
          this.api.saveResume(resume).subscribe({
            next: (saved) => this.finishCreate(saved),
            error: () => {
              this.creating = false;
              this.errorMessage =
                'The resume was created, but the profile photo could not be saved.';
            },
          });
          return;
        }
        this.finishCreate(resume);
      },
      error: () => {
        this.creating = false;
        this.errorMessage = 'The API did not accept the new resume. Your documents are unchanged.';
      },
    });
  }

  protected openConfirmation(action: 'duplicate' | 'delete', resume: ResumeRecord) {
    this.confirmation = { action, resume, busy: false };
  }

  protected closeConfirmation() {
    if (!this.confirmation?.busy) this.confirmation = undefined;
  }

  protected closeOverlays() {
    this.closeCreate();
    this.closeConfirmation();
  }

  protected confirmResumeAction() {
    const confirmation = this.confirmation;
    if (!confirmation || confirmation.busy) return;
    confirmation.busy = true;
    this.errorMessage = '';
    const next = () => {
      this.confirmation = undefined;
      this.load();
    };
    const error = () => {
      confirmation.busy = false;
      this.errorMessage =
        confirmation.action === 'delete'
          ? 'The resume could not be deleted. Please retry.'
          : 'The resume could not be duplicated. Please retry.';
    };
    if (confirmation.action === 'delete') {
      this.api.deleteResume(confirmation.resume.id).subscribe({ next, error });
    } else {
      this.api.duplicateResume(confirmation.resume.id).subscribe({ next, error });
    }
  }

  private readPhoto(file: File) {
    this.photoError = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.photoError = 'Choose a JPG, PNG, or WebP image.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.photoError = 'The image must be 5 MB or smaller.';
      return;
    }

    prepareProfilePhotoSource(file)
      .then(async (sourceDataUrl) => ({
        sourceDataUrl,
        previewDataUrl: await cropProfilePhoto(sourceDataUrl, { x: 0, y: 0, zoom: 1 }),
      }))
      .then(({ sourceDataUrl, previewDataUrl }) => {
        this.photoSourceDataUrl = sourceDataUrl;
        this.photoPreviewDataUrl = previewDataUrl;
        this.photoFileName = file.name;
        if (this.selectedTemplateSupportsPhoto) this.includePhoto = true;
      })
      .catch(() => {
        this.photoError = 'The image could not be read. Please try another file.';
      });
  }

  private finishCreate(resume: ResumeRecord) {
    this.createOpen = false;
    void this.router.navigate(['/resume', resume.id, 'edit']);
  }

  private buildTemplatePreview(templateId: ResumeTemplateId): ResumeRecord {
    const names: Record<ResumeTemplateId, { name: string; headline: string }> = {
      'tech-core': { name: 'Alex Morgan', headline: 'Software Engineer' },
      'tech-modern': { name: 'Taylor Kim', headline: 'Product Manager' },
      'tech-minimal': { name: 'Jordan Ellis', headline: 'Data Analyst' },
      'tech-executive': { name: 'Morgan Lee', headline: 'Senior Product Manager' },
      'tech-creative': { name: 'Casey Park', headline: 'UX Designer' },
    };
    const preview = createStarterResume(
      'preview-' + templateId,
      names[templateId].name,
      templateId,
    );
    preview.content.profile.fullName = names[templateId].name;
    preview.content.profile.headline = names[templateId].headline;
    preview.content.profile.email =
      names[templateId].name.toLowerCase().replace(' ', '.') + '@example.com';
    preview.content.profile.location = 'San Francisco, CA';
    preview.content.profile.github =
      'linkedin.com/in/' + names[templateId].name.toLowerCase().replace(' ', '');
    if (templateId === 'tech-modern' || templateId === 'tech-minimal') {
      preview.content.profile.photoDataUrl = '/assets/resume/template-profile.png';
      preview.content.profile.photoVisible = true;
    }
    for (const section of preview.content.sections) {
      if (section.type === 'summary')
        section.body =
          'Product-minded software engineer focused on reliable, full stack software, elegant interfaces, and measurable delivery.';
      if (section.type === 'experience')
        for (const item of section.items) {
          item.location = '';
          item.positions[0].bullets = [
            'Built TypeScript applications across Angular, NestJS, and PostgreSQL.',
            'Improved product workflows through focused UX polish and reliable APIs.',
          ];
        }
      if (section.type === 'projects')
        for (const item of section.items) {
          item.role = '';
          item.description =
            'Designed and shipped an inline AI resume editor with template-controlled typography.';
          item.dates = '2024';
        }
    }
    return preview;
  }
}
