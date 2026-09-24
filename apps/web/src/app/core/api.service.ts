import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { ResumePublication, ResumeRecord, ResumeTemplateId } from '@nexus/shared';

const API_BASE = '/api';
const ADMIN_TOKEN_KEY = 'nexus.admin.accessToken';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get hasAdminToken() {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem(ADMIN_TOKEN_KEY);
  }

  setAdminToken(token: string) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
  }

  clearAdminToken() {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  verifyAdminToken(token: string) {
    return this.http.get<ResumeRecord[]>(`${API_BASE}/resumes`, {
      headers: new HttpHeaders({ 'X-Nexus-Admin-Token': token.trim() }),
    });
  }

  private get privateRequestOptions() {
    const token = typeof localStorage === 'undefined' ? '' : localStorage.getItem(ADMIN_TOKEN_KEY) ?? '';
    return { headers: new HttpHeaders({ 'X-Nexus-Admin-Token': token }) };
  }

  listResumes() {
    return this.http.get<ResumeRecord[]>(`${API_BASE}/resumes`, this.privateRequestOptions);
  }

  createResume(name: string, templateId: ResumeTemplateId) {
    return this.http.post<ResumeRecord>(`${API_BASE}/resumes`, { name, templateId }, this.privateRequestOptions);
  }

  getResume(id: string) {
    return this.http.get<ResumeRecord>(`${API_BASE}/resumes/${id}`, this.privateRequestOptions);
  }

  saveResume(resume: ResumeRecord) {
    return this.http.patch<ResumeRecord>(`${API_BASE}/resumes/${resume.id}`, resume, this.privateRequestOptions);
  }

  duplicateResume(id: string) {
    return this.http.post<ResumeRecord>(`${API_BASE}/resumes/${id}/duplicate`, {}, this.privateRequestOptions);
  }

  deleteResume(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${API_BASE}/resumes/${id}`, this.privateRequestOptions);
  }

  publishResume(id: string, slug: string) {
    return this.http.post<ResumePublication>(`${API_BASE}/resumes/${id}/publication/publish`, {
      slug,
    }, this.privateRequestOptions);
  }

  unpublishResume(id: string) {
    return this.http.post<ResumePublication>(`${API_BASE}/resumes/${id}/publication/unpublish`, {}, this.privateRequestOptions);
  }

  getPublicResume(slug: string) {
    return this.http.get<ResumeRecord>(`${API_BASE}/public/resumes/${slug}`);
  }
}
