import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { ResumeRecord, ResumeTemplateId } from '@nexus/shared';
import { createStarterResume, validateSlug } from '@nexus/shared';
import { randomUUID } from 'node:crypto';
import { RESUME_REPOSITORY, type ResumeRepository } from '../persistence/resume.repository.js';

@Injectable()
export class ResumesService {
  constructor(@Inject(RESUME_REPOSITORY) private readonly repository: ResumeRepository) {}

  list() {
    return this.repository.list();
  }

  async get(id: string) {
    const resume = await this.repository.get(id);
    if (!resume) {
      throw new NotFoundException('Resume not found.');
    }

    return resume;
  }

  async create(input: { name?: string; templateId?: ResumeTemplateId }) {
    const name = input.name?.trim() || 'Untitled Resume';
    return this.repository.create(createStarterResume(randomUUID(), name, input.templateId));
  }

  async update(id: string, patch: Partial<ResumeRecord>) {
    const current = await this.get(id);
    const now = new Date().toISOString();
    const updated: ResumeRecord = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: now,
      lastSavedAt: now,
    };

    return this.repository.update(updated);
  }

  async rename(id: string, name: string) {
    return this.update(id, { name: name.trim() || 'Untitled Resume' });
  }

  async duplicate(id: string) {
    const source = await this.get(id);
    const now = new Date().toISOString();
    const duplicate: ResumeRecord = {
      ...structuredClone(source),
      id: randomUUID(),
      name: `${source.name} Copy`,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      lastSavedAt: now,
    };

    return this.repository.create(duplicate);
  }

  async delete(id: string) {
    await this.get(id);
    await this.repository.delete(id);
    return { deleted: true };
  }

  async getPublicationState(resumeId: string) {
    await this.get(resumeId);
    return this.repository.getPublicationByResumeId(resumeId);
  }

  async publish(resumeId: string, requestedSlug: string) {
    const resume = await this.get(resumeId);
    const slugResult = validateSlug(requestedSlug);
    if (!slugResult.ok) {
      throw new UnprocessableEntityException(slugResult.message);
    }

    const existingBySlug = await this.repository.findPublicationBySlug(slugResult.slug);
    if (existingBySlug && existingBySlug.resumeId !== resumeId) {
      throw new UnprocessableEntityException('This URL is already taken.');
    }

    const now = new Date().toISOString();
    const existing = await this.repository.getPublicationByResumeId(resumeId);
    const publication = {
      id: existing?.id ?? randomUUID(),
      resumeId,
      slug: slugResult.slug,
      enabled: true,
      publishedSnapshot: structuredClone(resume),
      publishedAt: now,
      unpublishedAt: undefined,
      seoTitle: `${resume.content.profile.fullName} - ${resume.content.profile.headline}`,
      seoDescription: resume.content.sections.find((section) => section.type === 'summary')?.title,
    };

    return this.repository.upsertPublication(publication);
  }

  async unpublish(resumeId: string) {
    const existing = await this.repository.getPublicationByResumeId(resumeId);
    if (!existing) {
      throw new NotFoundException('Publication not found.');
    }

    return this.repository.upsertPublication({
      ...existing,
      enabled: false,
      unpublishedAt: new Date().toISOString(),
    });
  }

  async resolvePublic(slug: string) {
    const publication = await this.repository.findPublicationBySlug(slug);
    if (!publication || !publication.enabled) {
      throw new NotFoundException('Resume unavailable.');
    }

    return publication.publishedSnapshot;
  }
}
