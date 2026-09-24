import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { ResumePublication, ResumeRecord, ResumeTemplateId } from '@nexus/shared';

const API_BASE = '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  constructor() {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('nexus.admin.accessToken');
  }

  listResumes() {
    return this.http.get<ResumeRecord[]>(`${API_BASE}/resumes`);
  }

  createResume(name: string, templateId: ResumeTemplateId) {
    return this.http.post<ResumeRecord>(`${API_BASE}/resumes`, { name, templateId });
  }

  getResume(id: string) {
    return this.http.get<ResumeRecord>(`${API_BASE}/resumes/${id}`);
  }

  saveResume(resume: ResumeRecord) {
    return this.http.patch<ResumeRecord>(`${API_BASE}/resumes/${resume.id}`, resume);
  }

  duplicateResume(id: string) {
    return this.http.post<ResumeRecord>(`${API_BASE}/resumes/${id}/duplicate`, {});
  }

  deleteResume(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${API_BASE}/resumes/${id}`);
  }

  publishResume(id: string, slug: string) {
    return this.http.post<ResumePublication>(`${API_BASE}/resumes/${id}/publication/publish`, {
      slug,
    });
  }

  unpublishResume(id: string) {
    return this.http.post<ResumePublication>(`${API_BASE}/resumes/${id}/publication/unpublish`, {});
  }

  getPublicResume(slug: string) {
    return this.http.get<ResumeRecord>(`${API_BASE}/public/resumes/${slug}`);
  }
}
