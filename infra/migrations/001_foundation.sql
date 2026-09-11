create table if not exists users (
  id uuid primary key,
  display_name text not null,
  email_placeholder text,
  is_owner boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  nexus_theme text not null default 'cosmic',
  default_language text not null default 'en',
  default_paper_size text not null default 'a4',
  default_resume_template text not null default 'tech-core',
  export_preferences jsonb not null default '{}'::jsonb
);

create table if not exists resumes (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  template_id text not null,
  theme_id text not null,
  status text not null,
  content_jsonb jsonb not null,
  section_order_jsonb jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_saved_at timestamptz
);

create table if not exists resume_versions (
  id uuid primary key,
  resume_id uuid not null references resumes(id) on delete cascade,
  version_label text not null,
  content_jsonb jsonb not null,
  created_at timestamptz not null default now(),
  source_resume_id uuid references resumes(id)
);

create table if not exists resume_publications (
  id uuid primary key,
  resume_id uuid not null references resumes(id) on delete cascade,
  slug text not null unique,
  enabled boolean not null default false,
  published_snapshot_jsonb jsonb not null,
  published_at timestamptz,
  unpublished_at timestamptz,
  seo_title text,
  seo_description text
);

create table if not exists file_assets (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  purpose text not null,
  object_key text not null,
  public_url text,
  mime_type text not null,
  byte_size integer not null,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create table if not exists recovery_states (
  client_generated_id text primary key,
  resume_id uuid not null references resumes(id) on delete cascade,
  device_label text not null,
  updated_at timestamptz not null,
  sync_state jsonb not null
);
