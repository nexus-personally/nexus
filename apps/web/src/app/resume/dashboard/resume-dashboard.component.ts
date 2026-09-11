import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { ResumeRecord, ResumeTemplateId } from '@nexus/shared';
import { RESUME_TEMPLATES } from '@nexus/shared';
import { ApiService } from '../../core/api.service';
import { ResumeRendererComponent } from '../renderer/resume-renderer.component';

@Component({
  selector: 'nexus-resume-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ResumeRendererComponent],
  template: `
    <main class="dashboard-shell">
      <aside class="rail" aria-label="NEXUS navigation">
        <a routerLink="/" class="nexus-mark" aria-label="Back to NEXUS">N</a>
        <nav>
          <a
            routerLink="/resume"
            class="rail-item active"
            title="Resume Studio"
            aria-label="Resume Studio"
            >R</a
          >
        </nav>
        <span class="owner-dot" title="Owner workspace online"></span>
      </aside>

      <section class="workspace">
        <header class="topbar">
          <div>
            <strong>Resume Studio</strong>
            <span>Owner workspace</span>
          </div>
          <button class="primary" type="button" (click)="openCreate()"><b>+</b> New resume</button>
        </header>

        <div class="content">
          <section class="library-heading">
            <div>
              <p>RESUME LIBRARY</p>
              <h1>Your resumes</h1>
            </div>
            <span>{{ resumes.length }} {{ resumes.length === 1 ? 'document' : 'documents' }}</span>
          </section>

          @if (errorMessage) {
            <div class="error-banner" role="alert">
              <div>
                <strong>Unable to reach Resume Studio</strong><span>{{ errorMessage }}</span>
              </div>
              <button type="button" (click)="load()">Retry</button>
            </div>
          }

          @if (!loading && !errorMessage && resumes.length === 0) {
            <section class="empty-state">
              <span>01</span>
              <h2>Create your first technology resume</h2>
              <p>Start with a name, choose a template, then edit directly on the A4 page.</p>
              <button class="primary" type="button" (click)="openCreate()">Create resume</button>
            </section>
          }

          <section class="resume-grid" aria-label="Resume documents">
            @for (resume of resumes; track resume.id) {
              <article class="resume-card">
                <a
                  class="preview"
                  [routerLink]="['/resume', resume.id, 'edit']"
                  [attr.aria-label]="'Edit ' + resume.name"
                >
                  <div class="preview-scale"><nexus-resume-renderer [resume]="resume" /></div>
                  <span class="open-cue">Open editor <b>↗</b></span>
                </a>
                <div class="card-body">
                  <div class="card-heading">
                    <div>
                      <p>{{ templateName(resume.templateId) }}</p>
                      <h2>{{ resume.name }}</h2>
                    </div>
                    <span class="status"><i></i>{{ resume.status }}</span>
                  </div>
                  <span class="saved"
                    >Updated {{ resume.lastSavedAt | date: 'MMM d, y, h:mm a' }}</span
                  >
                  <div class="actions">
                    <a [routerLink]="['/resume', resume.id, 'edit']">Edit</a>
                    <button type="button" (click)="duplicate(resume.id)">Duplicate</button>
                    <button class="danger" type="button" (click)="delete(resume)">Delete</button>
                  </div>
                </div>
              </article>
            }
          </section>
        </div>
      </section>

      @if (createOpen) {
        <div class="modal-backdrop" (click)="closeCreate()">
          <section
            class="create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
            (click)="$event.stopPropagation()"
          >
            <header>
              <div>
                <span>NEW RESUME / {{ createStep }} OF 2</span>
                <h2 id="create-title">
                  {{ createStep === 1 ? 'Name your resume' : 'Choose a starting point' }}
                </h2>
              </div>
              <button class="icon-button" type="button" (click)="closeCreate()" aria-label="Close">
                ×
              </button>
            </header>

            @if (createStep === 1) {
              <div class="name-step">
                <label for="resume-name">Resume name</label>
                <input
                  id="resume-name"
                  [(ngModel)]="newName"
                  (keyup.enter)="continueCreate()"
                  autofocus
                />
                <p>This is the private workspace name. You can change it later.</p>
              </div>
            } @else {
              <div class="template-list">
                @for (template of templates; track template.id) {
                  <button
                    type="button"
                    class="template-option"
                    [class.selected]="newTemplate === template.id"
                    (click)="newTemplate = template.id"
                  >
                    <span class="template-swatch" [class]="template.id"
                      ><i></i><i></i><i></i><i></i
                    ></span>
                    <span
                      ><strong>{{ template.name }}</strong
                      ><small>{{ template.description }}</small></span
                    >
                    <b>{{ newTemplate === template.id ? '✓' : '' }}</b>
                  </button>
                }
              </div>
            }

            <footer>
              <button type="button" (click)="createStep === 1 ? closeCreate() : (createStep = 1)">
                {{ createStep === 1 ? 'Cancel' : 'Back' }}
              </button>
              <button
                class="primary"
                type="button"
                [disabled]="!newName.trim() || creating"
                (click)="createStep === 1 ? continueCreate() : create()"
              >
                {{
                  createStep === 1 ? 'Choose template' : creating ? 'Creating...' : 'Create resume'
                }}
              </button>
            </footer>
          </section>
        </div>
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        color: #171a1d;
        background: #edf0ef;
      }
      .dashboard-shell {
        display: grid;
        grid-template-columns: 4.5rem 1fr;
        min-height: 100svh;
      }
      .rail {
        position: sticky;
        top: 0;
        z-index: 4;
        display: flex;
        height: 100svh;
        flex-direction: column;
        align-items: center;
        padding: 1rem 0;
        background: #0b0e10;
        border-right: 1px solid #24292d;
      }
      .nexus-mark,
      .rail-item {
        display: grid;
        place-items: center;
        width: 2.5rem;
        height: 2.5rem;
        color: #f1f4f2;
        text-decoration: none;
      }
      .nexus-mark {
        border: 1px solid #475056;
        font-weight: 800;
      }
      .rail nav {
        margin-top: 3rem;
      }
      .rail-item {
        position: relative;
        color: #6f7a80;
        font-size: 0.78rem;
        font-weight: 700;
      }
      .rail-item.active {
        color: #8de1e7;
        background: #172126;
      }
      .rail-item.active::before {
        content: '';
        position: absolute;
        left: -1rem;
        width: 2px;
        height: 1.2rem;
        background: #79d3dc;
      }
      .owner-dot {
        width: 7px;
        height: 7px;
        margin-top: auto;
        border-radius: 50%;
        background: #62c8a4;
        box-shadow: 0 0 12px rgba(98, 200, 164, 0.55);
      }
      .workspace {
        min-width: 0;
      }
      .topbar {
        display: flex;
        min-height: 4.5rem;
        align-items: center;
        justify-content: space-between;
        padding: 0 clamp(1.25rem, 3vw, 2.75rem);
        background: rgba(247, 249, 248, 0.94);
        border-bottom: 1px solid #d4d9d7;
      }
      .topbar div {
        display: grid;
        gap: 0.15rem;
      }
      .topbar strong {
        font-size: 0.92rem;
      }
      .topbar span {
        color: #7a8382;
        font-size: 0.72rem;
      }
      button,
      a {
        font: inherit;
      }
      button {
        border: 1px solid #c7cecb;
        border-radius: 6px;
        padding: 0.62rem 0.8rem;
        background: #f8faf9;
        color: #202527;
        cursor: pointer;
      }
      button:hover,
      a:hover {
        border-color: #929d99;
      }
      .primary {
        border-color: #15191b;
        background: #15191b;
        color: #ffffff;
        font-weight: 650;
      }
      .primary b {
        margin-right: 0.35rem;
        color: #8de1e7;
      }
      .primary:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }
      .content {
        width: min(100%, 88rem);
        margin: 0 auto;
        padding: clamp(2rem, 5vw, 4.5rem) clamp(1.25rem, 3vw, 2.75rem);
      }
      .library-heading {
        display: flex;
        align-items: end;
        justify-content: space-between;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid #cfd5d2;
      }
      .library-heading p,
      .library-heading h1 {
        margin: 0;
      }
      .library-heading p {
        margin-bottom: 0.45rem;
        color: #527478;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.67rem;
        letter-spacing: 0.1em;
      }
      .library-heading h1 {
        font-size: clamp(1.9rem, 3.5vw, 3rem);
        font-weight: 620;
      }
      .library-heading > span {
        color: #707a77;
        font-size: 0.78rem;
      }
      .error-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-top: 1.5rem;
        padding: 0.9rem 1rem;
        border: 1px solid #d8b6ad;
        background: #fff8f5;
      }
      .error-banner div {
        display: grid;
        gap: 0.2rem;
      }
      .error-banner span {
        color: #795b53;
        font-size: 0.78rem;
      }
      .empty-state {
        max-width: 34rem;
        padding: 5rem 0;
      }
      .empty-state > span {
        color: #7fbac0;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.72rem;
      }
      .empty-state h2 {
        margin: 0.75rem 0 0.5rem;
        font-size: 1.7rem;
      }
      .empty-state p {
        margin: 0 0 1.25rem;
        color: #697370;
        line-height: 1.6;
      }
      .resume-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
        gap: 1.25rem;
        margin-top: 1.75rem;
      }
      .resume-card {
        min-width: 0;
        overflow: hidden;
        border: 1px solid #d0d6d3;
        border-radius: 7px;
        background: #f8faf9;
        transition:
          translate 220ms ease,
          box-shadow 220ms ease,
          border-color 220ms ease;
      }
      .resume-card:hover {
        translate: 0 -3px;
        border-color: #a9b5b1;
        box-shadow: 0 16px 36px rgba(28, 37, 37, 0.09);
      }
      .preview {
        position: relative;
        display: block;
        height: 19rem;
        overflow: hidden;
        background: #dfe4e2;
        border-bottom: 1px solid #d0d6d3;
        color: inherit;
        text-decoration: none;
      }
      .preview-scale {
        position: absolute;
        left: 50%;
        top: 1.25rem;
        width: 210mm;
        transform: translateX(-50%) scale(0.255);
        transform-origin: top center;
        pointer-events: none;
      }
      .open-cue {
        position: absolute;
        right: 0.75rem;
        bottom: 0.75rem;
        padding: 0.4rem 0.55rem;
        border-radius: 4px;
        background: rgba(12, 16, 18, 0.88);
        color: #ffffff;
        font-size: 0.7rem;
        opacity: 0;
        transition: opacity 180ms ease;
      }
      .preview:hover .open-cue,
      .preview:focus-visible .open-cue {
        opacity: 1;
      }
      .card-body {
        padding: 1rem;
      }
      .card-heading {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 0.75rem;
      }
      .card-heading p,
      .card-heading h2 {
        margin: 0;
      }
      .card-heading p {
        margin-bottom: 0.3rem;
        color: #538088;
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
      }
      .card-heading h2 {
        overflow: hidden;
        font-size: 1rem;
        font-weight: 650;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .status {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        color: #697470;
        font-size: 0.65rem;
        text-transform: capitalize;
      }
      .status i {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #76b9a0;
      }
      .saved {
        display: block;
        margin-top: 0.75rem;
        color: #7b8481;
        font-size: 0.7rem;
      }
      .actions {
        display: flex;
        gap: 0.4rem;
        margin-top: 1rem;
        padding-top: 0.8rem;
        border-top: 1px solid #e0e4e2;
      }
      .actions a,
      .actions button {
        padding: 0.42rem 0.58rem;
        border: 0;
        background: transparent;
        color: #4f5b58;
        font-size: 0.72rem;
        text-decoration: none;
      }
      .actions a {
        color: #185f6a;
        font-weight: 700;
      }
      .actions .danger {
        margin-left: auto;
        color: #8b4940;
      }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 10;
        display: grid;
        place-items: center;
        padding: 1rem;
        background: rgba(6, 9, 10, 0.66);
      }
      .create-dialog {
        width: min(100%, 42rem);
        max-height: calc(100svh - 2rem);
        overflow: auto;
        border: 1px solid #cbd2cf;
        border-radius: 7px;
        background: #f8faf9;
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.3);
      }
      .create-dialog > header,
      .create-dialog > footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.2rem 1.35rem;
      }
      .create-dialog > header {
        border-bottom: 1px solid #d9dfdc;
      }
      .create-dialog > footer {
        justify-content: flex-end;
        border-top: 1px solid #d9dfdc;
      }
      .create-dialog header span {
        color: #568087;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.62rem;
        letter-spacing: 0.08em;
      }
      .create-dialog h2 {
        margin: 0.25rem 0 0;
        font-size: 1.35rem;
      }
      .icon-button {
        display: grid;
        width: 2.25rem;
        height: 2.25rem;
        place-items: center;
        padding: 0;
        border: 0;
        background: transparent;
        font-size: 1.45rem;
      }
      .name-step {
        padding: 3rem 1.35rem;
      }
      .name-step label {
        display: block;
        margin-bottom: 0.45rem;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .name-step input {
        width: 100%;
        border: 1px solid #aeb8b4;
        border-radius: 5px;
        padding: 0.85rem;
        background: #ffffff;
        color: #171a1d;
        font: inherit;
        font-size: 1.05rem;
      }
      .name-step p {
        margin: 0.55rem 0 0;
        color: #747e7a;
        font-size: 0.72rem;
      }
      .template-list {
        display: grid;
        gap: 0.55rem;
        padding: 1rem 1.35rem;
      }
      .template-option {
        display: grid;
        grid-template-columns: 3rem 1fr 1rem;
        align-items: center;
        gap: 0.9rem;
        width: 100%;
        padding: 0.75rem;
        text-align: left;
      }
      .template-option.selected {
        border-color: #397882;
        background: #eef8f8;
      }
      .template-option > span:nth-child(2) {
        display: grid;
        gap: 0.2rem;
      }
      .template-option small {
        color: #6c7773;
        line-height: 1.35;
      }
      .template-option > b {
        color: #266c75;
      }
      .template-swatch {
        display: grid;
        width: 2.6rem;
        height: 3.4rem;
        align-content: start;
        gap: 0.3rem;
        padding: 0.45rem;
        background: #ffffff;
        border: 1px solid #cbd2cf;
      }
      .template-swatch i {
        display: block;
        height: 2px;
        background: #b6bfbc;
      }
      .template-swatch i:first-child {
        height: 5px;
        background: #397882;
      }
      .template-swatch.tech-modern {
        border-left: 7px solid #8cbfc5;
      }
      .template-swatch.tech-executive i:first-child {
        background: #25292b;
      }
      .template-swatch.tech-creative {
        border-top: 7px solid #c0954c;
      }
      @media (max-width: 680px) {
        .dashboard-shell {
          grid-template-columns: 1fr;
          padding-bottom: 4rem;
        }
        .rail {
          position: fixed;
          top: auto;
          bottom: 0;
          width: 100%;
          height: 4rem;
          flex-direction: row;
          justify-content: space-between;
          padding: 0 1rem;
        }
        .rail nav {
          margin: 0;
        }
        .owner-dot {
          margin: 0;
        }
        .rail-item.active::before {
          display: none;
        }
        .topbar {
          min-height: 4rem;
        }
        .topbar div span {
          display: none;
        }
        .resume-grid {
          grid-template-columns: 1fr;
        }
        .preview {
          height: 16rem;
        }
      }
    `,
  ],
})
export class ResumeDashboardComponent implements OnInit {
  protected readonly templates = RESUME_TEMPLATES;
  protected resumes: ResumeRecord[] = [];
  protected newName = 'Primary Tech Resume';
  protected newTemplate: ResumeTemplateId = 'tech-core';
  protected createOpen = false;
  protected createStep: 1 | 2 = 1;
  protected creating = false;
  protected loading = true;
  protected errorMessage = '';
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  ngOnInit() {
    this.load();
  }

  protected openCreate() {
    this.createStep = 1;
    this.createOpen = true;
  }
  protected closeCreate() {
    if (!this.creating) this.createOpen = false;
  }
  protected continueCreate() {
    if (this.newName.trim()) this.createStep = 2;
  }

  protected create() {
    if (!this.newName.trim() || this.creating) return;
    this.creating = true;
    this.api.createResume(this.newName.trim(), this.newTemplate).subscribe({
      next: (resume) => {
        this.createOpen = false;
        void this.router.navigate(['/resume', resume.id, 'edit']);
      },
      error: () => {
        this.creating = false;
        this.errorMessage =
          'The API did not accept the new resume. Your existing documents are unchanged.';
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

  protected templateName(id: ResumeTemplateId) {
    return this.templates.find((template) => template.id === id)?.name ?? id;
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
        this.errorMessage = 'Check that the local API is running, then retry.';
      },
    });
  }
}
