import type { ResumePublication, ResumeRecord } from '@nexus/shared';

export const RESUME_REPOSITORY = Symbol('RESUME_REPOSITORY');

export interface ResumeRepository {
  list(limit?: number): Promise<ResumeRecord[]>;
  get(id: string): Promise<ResumeRecord | undefined>;
  create(resume: ResumeRecord): Promise<ResumeRecord>;
  update(resume: ResumeRecord): Promise<ResumeRecord>;
  delete(id: string): Promise<void>;
  findPublicationBySlug(slug: string): Promise<ResumePublication | undefined>;
  getPublicationByResumeId(resumeId: string): Promise<ResumePublication | undefined>;
  upsertPublication(publication: ResumePublication): Promise<ResumePublication>;
}
