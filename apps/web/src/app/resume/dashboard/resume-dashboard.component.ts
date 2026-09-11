import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { ResumeRecord, ResumeTemplateId } from '@nexus/shared';
import { RESUME_TEMPLATES } from '@nexus/shared';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'nexus-resume-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="studio-shell">
      <header>
        <a routerLink="/" class="ghost">Back to NEXUS</a>
        <div>
          <p>Resume Studio</p>
          <h1>Build and publish technology resumes.</h1>
        </div>
      </header>

      <section class="create-panel">
        <input [(ngModel)]="newName" placeholder="Resume name" aria-label="Resume name" />
        <select [(ngModel)]="newTemplate" aria-label="Template">
          @for (template of templates; track template.id) {
            <option [value]="template.id">{{ template.name }}</option>
          }
        </select>
        <button type="button" (click)="create()">Create</button>
      </section>

      <section class="resume-grid">
        @for (resume of resumes; track resume.id) {
          <article class="resume-card">
            <p>{{ templateName(resume.templateId) }}</p>
            <h2>{{ resume.name }}</h2>
            <span>Saved {{ resume.lastSavedAt | date: 'medium' }}</span>
            <div class="actions">
              <a [routerLink]="['/resume', resume.id, 'edit']">Edit</a>
              <button type="button" (click)="duplicate(resume.id)">Duplicate</button>
              <button type="button" (click)="delete(resume.id)">Delete</button>
            </div>
          </article>
        }
      </section>
    </main>
  `,
  styles: [
    `
      .studio-shell {
        min-height: 100vh;
        padding: clamp(1rem, 4vw, 3rem);
        color: #171a21;
        background: #f4f7f8;
      }

      header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
      }

      header p,
      h1,
      h2 {
        margin: 0;
      }

      header p {
        color: #0f7587;
        font-weight: 800;
      }

      h1 {
        font-size: clamp(2rem, 5vw, 4.5rem);
        max-width: 12ch;
      }

      .ghost,
      button,
      a {
        border-radius: 8px;
        border: 1px solid #b7c3c8;
        padding: 0.65rem 0.85rem;
        background: #ffffff;
        color: #171a21;
        text-decoration: none;
        cursor: pointer;
      }

      .create-panel {
        margin: 2rem 0;
        display: grid;
        grid-template-columns: minmax(12rem, 1fr) minmax(11rem, 16rem) auto;
        gap: 0.75rem;
      }

      input,
      select {
        border: 1px solid #b7c3c8;
        border-radius: 8px;
        padding: 0.75rem;
        font: inherit;
        background: #ffffff;
      }

      .resume-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
        gap: 1rem;
      }

      .resume-card {
        border: 1px solid #d8e0e4;
        border-radius: 8px;
        background: #ffffff;
        padding: 1rem;
      }

      .resume-card p {
        color: #9b4f38;
        font-weight: 800;
      }

      .resume-card span {
        display: block;
        margin: 0.5rem 0 1rem;
        color: #5f6a72;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      @media (max-width: 720px) {
        header,
        .create-panel {
          grid-template-columns: 1fr;
          display: grid;
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
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  ngOnInit() {
    this.load();
  }

  protected create() {
    this.api.createResume(this.newName, this.newTemplate).subscribe((resume) => {
      void this.router.navigate(['/resume', resume.id, 'edit']);
    });
  }

  protected duplicate(id: string) {
    this.api.duplicateResume(id).subscribe(() => this.load());
  }

  protected delete(id: string) {
    this.api.deleteResume(id).subscribe(() => this.load());
  }

  protected templateName(id: ResumeTemplateId) {
    return this.templates.find((template) => template.id === id)?.name ?? id;
  }

  private load() {
    this.api.listResumes().subscribe((resumes) => {
      this.resumes = resumes;
    });
  }
}
