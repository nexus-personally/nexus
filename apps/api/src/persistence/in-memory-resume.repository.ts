import { Injectable } from '@nestjs/common';
import type { ResumePublication, ResumeRecord } from '@nexus/shared';
import { createStarterResume } from '@nexus/shared';
import { randomUUID } from 'node:crypto';
import type { ResumeRepository } from './resume.repository.js';

@Injectable()
export class InMemoryResumeRepository implements ResumeRepository {
  private readonly resumes = new Map<string, ResumeRecord>();
  private readonly publications = new Map<string, ResumePublication>();

  constructor() {
    const starter = createStarterResume(randomUUID(), 'Primary Tech Resume', 'tech-core');
    this.resumes.set(starter.id, starter);
  }

  async list(limit = 100): Promise<ResumeRecord[]> {
    return [...this.resumes.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
  }

  async get(id: string): Promise<ResumeRecord | undefined> {
    return this.resumes.get(id);
  }

  async create(resume: ResumeRecord): Promise<ResumeRecord> {
    this.resumes.set(resume.id, resume);
    return resume;
  }

  async update(resume: ResumeRecord): Promise<ResumeRecord> {
    this.resumes.set(resume.id, resume);
    return resume;
  }

  async delete(id: string): Promise<void> {
    this.resumes.delete(id);
  }

  async findPublicationBySlug(slug: string): Promise<ResumePublication | undefined> {
    return this.publications.get(slug);
  }

  async getPublicationByResumeId(resumeId: string): Promise<ResumePublication | undefined> {
    return [...this.publications.values()].find((publication) => publication.resumeId === resumeId);
  }

  async upsertPublication(publication: ResumePublication): Promise<ResumePublication> {
    for (const [slug, existing] of this.publications.entries()) {
      if (existing.resumeId === publication.resumeId && slug !== publication.slug) {
        this.publications.delete(slug);
      }
    }

    this.publications.set(publication.slug, publication);
    return publication;
  }
}
