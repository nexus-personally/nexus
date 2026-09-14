import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideCopy,
  LucideFileText,
  LucidePlus,
  LucideSearch,
  LucideTrash2,
  LucideUpload,
  LucideUserRound,
  LucideX,
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
    LucideCopy,
    LucideFileText,
    LucidePlus,
    LucideSearch,
    LucideTrash2,
    LucideUpload,
    LucideUserRound,
    LucideX,
  ],
  template: `
    <main class="dashboard-shell" [class.panel-closed]="!createOpen">
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
          <a class="active" href="#templates-title">Templates</a>
          <a href="#library-title">My resumes</a>
        </nav>
        <button class="primary topbar-action" type="button" (click)="openCreate()">
          <svg lucidePlus size="16"></svg>
          New resume
        </button>
      </header>

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
                      <nexus-resume-renderer [resume]="previewFor(template.id)" />
                    </span>
                  </span>
                </button>

                <div class="template-summary">
                  <div class="template-line">
                    <h2>{{ template.name }}</h2>
                    <span [class]="'tag ' + template.id">{{ templateTag(template.id) }}</span>
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
                      (click)="duplicate(resume.id)"
                    >
                      <svg lucideCopy size="15"></svg>
                    </button>
                    <button
                      class="danger"
                      type="button"
                      title="Delete resume"
                      [attr.aria-label]="'Delete ' + resume.name"
                      (click)="delete(resume)"
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
        <aside class="create-panel" aria-labelledby="create-title">
          <header>
            <div>
              <h2 id="create-title">Create resume</h2>
              <p>Using {{ selectedTemplate.name }} template</p>
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
            <span><nexus-resume-renderer [resume]="selectedPreview" /></span>
          </div>

          <div class="panel-form">
            <label for="resume-name">Resume name</label>
            <input id="resume-name" [(ngModel)]="newName" />

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
        </aside>
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        color: #172231;
        background: #fbfaf8;
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
        top: 0;
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
        font-family: Georgia, 'Times New Roman', serif;
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
        justify-items: center;
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
        top: 0;
        width: 210mm;
        transform: translateX(-50%) scale(0.066);
        transform-origin: top center;
        pointer-events: none;
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
})
export class ResumeDashboardComponent implements OnInit {
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
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  ngOnInit() {
    this.load();
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
        (this.activeFilter === 'ats' && template.atsFriendly) ||
        (this.activeFilter === 'modern' && template.id === 'tech-modern') ||
        (this.activeFilter === 'creative' && template.id === 'tech-creative');
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

  protected duplicate(id: string) {
    this.api.duplicateResume(id).subscribe({
      next: () => this.load(),
      error: () => (this.errorMessage = 'The resume could not be duplicated. Please retry.'),
    });
  }

  protected delete(resume: ResumeRecord) {
    if (!window.confirm('Delete "' + resume.name + '"? This cannot be undone.')) return;
    this.api.deleteResume(resume.id).subscribe({
      next: () => this.load(),
      error: () => (this.errorMessage = 'The resume could not be deleted. Please retry.'),
    });
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
      'tech-executive': { name: 'Morgan White', headline: 'Senior Consultant' },
      'tech-creative': { name: 'Casey Patel', headline: 'UX/UI Designer' },
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
    if (
      templateId === 'tech-modern' ||
      templateId === 'tech-minimal' ||
      templateId === 'tech-creative'
    ) {
      preview.content.profile.photoDataUrl = '/assets/resume/template-profile.png';
      preview.content.profile.photoVisible = true;
    }
    return preview;
  }
}
