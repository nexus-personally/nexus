alter table resumes
  add column if not exists document_jsonb jsonb not null default '{}'::jsonb;

create unique index if not exists resume_publications_resume_id_unique
  on resume_publications (resume_id);
