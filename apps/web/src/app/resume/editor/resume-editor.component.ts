import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { ResumeRecord, ResumeSection, ResumeTemplateId } from '@nexus/shared';
import { RESUME_TEMPLATES, RESUME_THEMES } from '@nexus/shared';
import { ApiService } from '../../core/api.service';
import { ResumeRendererComponent } from '../renderer/resume-renderer.component';

@Component({
  selector: 'nexus-resume-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ResumeRendererComponent],
  template: `
    @if (resume) {
      <main class="editor-shell">
        <aside class="toolbar">
          <a routerLink="/resume" class="ghost">Dashboard</a>
          <input [(ngModel)]="resume.name" (ngModelChange)="markDirty()" aria-label="Resume name" />
          <select [(ngModel)]="resume.templateId" (ngModelChange)="markDirty()" aria-label="Template">
            @for (template of templates; track template.id) {
              <option [value]="template.id">{{ template.name }}</option>
            }
          </select>
          <select [(ngModel)]="resume.themeId" (ngModelChange)="markDirty()" aria-label="Accent theme">
            @for (theme of themes; track theme.id) {
              <option [value]="theme.id">{{ theme.name }}</option>
            }
          </select>
          <button type="button" (click)="save()">Save</button>
          <button type="button" (click)="publish()">Publish</button>
          <button type="button" (click)="unpublish()">Unpublish</button>
          <p class="save-state">{{ saveState }}</p>

          <section>
            <h2>Profile</h2>
            <label>Full name <input [(ngModel)]="resume.content.profile.fullName" (ngModelChange)="markDirty()" /></label>
            <label>Headline <input [(ngModel)]="resume.content.profile.headline" (ngModelChange)="markDirty()" /></label>
            <label>Email <input [(ngModel)]="resume.content.profile.email" (ngModelChange)="markDirty()" /></label>
            <label>Phone <input [(ngModel)]="resume.content.profile.phone" (ngModelChange)="markDirty()" /></label>
            <label>Location <input [(ngModel)]="resume.content.profile.location" (ngModelChange)="markDirty()" /></label>
          </section>

          <section>
            <h2>Sections</h2>
            @for (section of orderedSections; track section.id) {
              <div class="section-row">
                <button type="button" (click)="move(section.id, -1)">Up</button>
                <button type="button" (click)="move(section.id, 1)">Down</button>
                <label><input type="checkbox" [(ngModel)]="section.hidden" (ngModelChange)="markDirty()" /> Hide</label>
                <span>{{ section.title }}</span>
              </div>
            }
          </section>
        </aside>

        <section class="page-area">
          <p class="page-label">A4 Page 1</p>
          <nexus-resume-renderer [resume]="resume" />
        </section>
      </main>
    }
  `,
  styles: [
    `
      .editor-shell {
        display: grid;
        grid-template-columns: minmax(18rem, 22rem) 1fr;
        min-height: 100vh;
        background: #e8edf0;
      }

      .toolbar {
        position: sticky;
        top: 0;
        height: 100vh;
        overflow: auto;
        padding: 1rem;
        background: #11161d;
        color: #f8f5ee;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .ghost,
      button {
        border: 1px solid #566370;
        border-radius: 8px;
        padding: 0.55rem 0.7rem;
        color: inherit;
        background: #1d2630;
        text-decoration: none;
        cursor: pointer;
      }

      input,
      select {
        width: 100%;
        border: 1px solid #566370;
        border-radius: 8px;
        padding: 0.55rem;
        color: #f8f5ee;
        background: #0b1016;
      }

      label {
        display: grid;
        gap: 0.25rem;
        font-size: 0.82rem;
      }

      h2 {
        margin: 1rem 0 0.5rem;
        font-size: 0.9rem;
        color: #8bd3dc;
      }

      .section-row {
        display: grid;
        grid-template-columns: auto auto auto 1fr;
        align-items: center;
        gap: 0.35rem;
        margin-bottom: 0.4rem;
      }

      .section-row button {
        padding: 0.35rem 0.45rem;
      }

      .section-row label {
        display: flex;
        gap: 0.25rem;
        align-items: center;
      }

      .section-row input {
        width: auto;
      }

      .save-state {
        min-height: 1.2rem;
        color: #d9bd61;
      }

      .page-area {
        overflow: auto;
        padding: 2rem;
      }

      .page-label {
        text-align: center;
        color: #53606a;
      }

      @media (max-width: 1000px) {
        .editor-shell {
          grid-template-columns: 1fr;
        }

        .toolbar {
          position: relative;
          height: auto;
        }
      }
    `,
  ],
})
export class ResumeEditorComponent implements OnInit {
  protected readonly templates = RESUME_TEMPLATES;
  protected readonly themes = RESUME_THEMES;
  protected resume?: ResumeRecord;
  protected saveState = 'Loading';
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private saveTimer?: number;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const recovery = localStorage.getItem(this.recoveryKey(id));
    if (recovery) {
      this.resume = JSON.parse(recovery) as ResumeRecord;
      this.saveState = 'Recovered local draft';
      return;
    }

    this.api.getResume(id).subscribe((resume) => {
      this.resume = resume;
      this.saveState = 'Saved';
    });
  }

  protected get orderedSections(): ResumeSection[] {
    if (!this.resume) {
      return [];
    }

    const byId = new Map(this.resume.content.sections.map((section) => [section.id, section]));
    return this.resume.sectionOrder.flatMap((id) => {
      const section = byId.get(id);
      return section ? [section] : [];
    });
  }

  protected markDirty() {
    if (!this.resume) {
      return;
    }

    localStorage.setItem(this.recoveryKey(this.resume.id), JSON.stringify(this.resume));
    this.saveState = 'Unsaved local draft';
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), 900);
  }

  protected save() {
    if (!this.resume) {
      return;
    }

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
    if (!this.resume) {
      return;
    }

    const order = [...this.resume.sectionOrder];
    const index = order.indexOf(sectionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) {
      return;
    }

    [order[index], order[target]] = [order[target], order[index]];
    this.resume.sectionOrder = order;
    this.markDirty();
  }

  protected publish() {
    if (!this.resume) {
      return;
    }

    const slug = this.resume.content.profile.fullName || this.resume.name;
    this.api.publishResume(this.resume.id, slug).subscribe({
      next: (publication) => {
        this.saveState = `Published at /r/${publication.slug}`;
      },
      error: (error: { error?: { message?: string } }) => {
        this.saveState = error.error?.message ?? 'Publish failed.';
      },
    });
  }

  protected unpublish() {
    if (!this.resume) {
      return;
    }

    this.api.unpublishResume(this.resume.id).subscribe({
      next: () => {
        this.saveState = 'Public link disabled';
      },
      error: () => {
        this.saveState = 'No active publication to unpublish.';
      },
    });
  }

  private recoveryKey(id: string) {
    return `nexus:resume-recovery:${id}`;
  }
}
