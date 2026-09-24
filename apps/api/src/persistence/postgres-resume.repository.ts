import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ResumePublication, ResumeRecord } from '@nexus/shared';
import { createStarterResume } from '@nexus/shared';
import { randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { createPostgresPool } from '../database/postgres.js';
import type { ResumeRepository } from './resume.repository.js';

const OWNER_ID = '00000000-0000-4000-8000-000000000001';

interface ResumeRow extends QueryResultRow {
  id: string;
  name: string;
  template_id: ResumeRecord['templateId'];
  theme_id: string;
  status: ResumeRecord['status'];
  content_jsonb: ResumeRecord['content'];
  section_order_jsonb: string[];
  document_jsonb: Partial<ResumeRecord>;
  created_at: Date;
  updated_at: Date;
  last_saved_at: Date | null;
}

interface PublicationRow extends QueryResultRow {
  id: string;
  resume_id: string;
  slug: string;
  enabled: boolean;
  published_snapshot_jsonb: ResumeRecord;
  published_at: Date | null;
  unpublished_at: Date | null;
  seo_title: string | null;
  seo_description: string | null;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapResume(row: ResumeRow): ResumeRecord {
  return {
    ...row.document_jsonb,
    id: row.id,
    name: row.name,
    templateId: row.template_id,
    themeId: row.theme_id,
    status: row.status,
    content: row.content_jsonb,
    sectionOrder: row.section_order_jsonb,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    ...(row.last_saved_at ? { lastSavedAt: toIso(row.last_saved_at) } : {}),
  } as ResumeRecord;
}

function mapPublication(row: PublicationRow): ResumePublication {
  return {
    id: row.id,
    resumeId: row.resume_id,
    slug: row.slug,
    enabled: row.enabled,
    publishedSnapshot: row.published_snapshot_jsonb,
    ...(row.published_at ? { publishedAt: toIso(row.published_at) } : {}),
    ...(row.unpublished_at ? { unpublishedAt: toIso(row.unpublished_at) } : {}),
    ...(row.seo_title ? { seoTitle: row.seo_title } : {}),
    ...(row.seo_description ? { seoDescription: row.seo_description } : {}),
  };
}

@Injectable()
export class PostgresResumeRepository implements ResumeRepository, OnModuleInit, OnModuleDestroy {
  private readonly pool = createPostgresPool();

  async onModuleInit() {
    const owner = await this.pool.query(
      `insert into users (id, display_name, is_owner)
       values ($1, 'NEXUS Owner', true)
       on conflict (id) do nothing
       returning id`,
      [OWNER_ID],
    );

    const result = await this.pool.query<{ count: string }>('select count(*) from resumes');
    if (owner.rowCount === 1 && Number(result.rows[0]?.count ?? 0) === 0) {
      await this.create(createStarterResume(randomUUID(), 'Primary Resume', 'tech-core'));
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async list(limit = 100): Promise<ResumeRecord[]> {
    const result = await this.pool.query<ResumeRow>(
      'select * from resumes order by updated_at desc limit $1',
      [limit],
    );
    return result.rows.map(mapResume);
  }

  async get(id: string): Promise<ResumeRecord | undefined> {
    const result = await this.pool.query<ResumeRow>('select * from resumes where id = $1', [id]);
    return result.rows[0] ? mapResume(result.rows[0]) : undefined;
  }

  async create(resume: ResumeRecord): Promise<ResumeRecord> {
    const result = await this.pool.query<ResumeRow>(
      `insert into resumes (
         id, user_id, name, template_id, theme_id, status, content_jsonb,
         section_order_jsonb, document_jsonb, created_at, updated_at, last_saved_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning *`,
      [
        resume.id,
        OWNER_ID,
        resume.name,
        resume.templateId,
        resume.themeId,
        resume.status,
        JSON.stringify(resume.content),
        JSON.stringify(resume.sectionOrder),
        JSON.stringify(resume),
        resume.createdAt,
        resume.updatedAt,
        resume.lastSavedAt ?? null,
      ],
    );
    return mapResume(result.rows[0]!);
  }

  async update(resume: ResumeRecord): Promise<ResumeRecord> {
    const result = await this.pool.query<ResumeRow>(
      `update resumes set
         name = $2, template_id = $3, theme_id = $4, status = $5,
         content_jsonb = $6, section_order_jsonb = $7, document_jsonb = $8,
         updated_at = $9, last_saved_at = $10
       where id = $1
       returning *`,
      [
        resume.id,
        resume.name,
        resume.templateId,
        resume.themeId,
        resume.status,
        JSON.stringify(resume.content),
        JSON.stringify(resume.sectionOrder),
        JSON.stringify(resume),
        resume.updatedAt,
        resume.lastSavedAt ?? null,
      ],
    );
    return mapResume(result.rows[0]!);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('delete from resumes where id = $1', [id]);
  }

  async findPublicationBySlug(slug: string): Promise<ResumePublication | undefined> {
    const result = await this.pool.query<PublicationRow>(
      'select * from resume_publications where slug = $1',
      [slug],
    );
    return result.rows[0] ? mapPublication(result.rows[0]) : undefined;
  }

  async getPublicationByResumeId(resumeId: string): Promise<ResumePublication | undefined> {
    const result = await this.pool.query<PublicationRow>(
      'select * from resume_publications where resume_id = $1',
      [resumeId],
    );
    return result.rows[0] ? mapPublication(result.rows[0]) : undefined;
  }

  async upsertPublication(publication: ResumePublication): Promise<ResumePublication> {
    const result = await this.pool.query<PublicationRow>(
      `insert into resume_publications (
         id, resume_id, slug, enabled, published_snapshot_jsonb, published_at,
         unpublished_at, seo_title, seo_description
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (resume_id) do update set
         slug = excluded.slug,
         enabled = excluded.enabled,
         published_snapshot_jsonb = excluded.published_snapshot_jsonb,
         published_at = excluded.published_at,
         unpublished_at = excluded.unpublished_at,
         seo_title = excluded.seo_title,
         seo_description = excluded.seo_description
       returning *`,
      [
        publication.id,
        publication.resumeId,
        publication.slug,
        publication.enabled,
        JSON.stringify(publication.publishedSnapshot),
        publication.publishedAt ?? null,
        publication.unpublishedAt ?? null,
        publication.seoTitle ?? null,
        publication.seoDescription ?? null,
      ],
    );
    return mapPublication(result.rows[0]!);
  }
}
