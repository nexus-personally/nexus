create table if not exists split_users (
  id uuid primary key,
  email text not null,
  normalized_email text not null,
  display_name text not null,
  password_hash text not null,
  account_status text not null default 'active',
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint split_users_email_length check (char_length(normalized_email) between 3 and 320),
  constraint split_users_email_normalized check (normalized_email = lower(btrim(normalized_email))),
  constraint split_users_display_name_length check (char_length(btrim(display_name)) between 1 and 100),
  constraint split_users_password_hash_present check (char_length(password_hash) > 0),
  constraint split_users_account_status check (account_status in ('active', 'suspended', 'disabled'))
);

create unique index if not exists split_users_normalized_email_unique
  on split_users (normalized_email);

create table if not exists split_sessions (
  id uuid primary key,
  user_id uuid not null references split_users(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  revocation_reason text,
  user_agent text,
  ip_hash text,
  constraint split_sessions_expiry_order check (
    idle_expires_at > created_at and absolute_expires_at >= idle_expires_at
  )
);

create unique index if not exists split_sessions_token_hash_unique
  on split_sessions (token_hash);

create index if not exists split_sessions_active_user_idx
  on split_sessions (user_id)
  where revoked_at is null;

create index if not exists split_sessions_expiry_idx
  on split_sessions (absolute_expires_at, idle_expires_at)
  where revoked_at is null;
