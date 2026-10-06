create table if not exists split_groups (
  id uuid primary key,
  name text not null,
  type text not null,
  base_currency varchar(3) not null default 'MYR',
  simplify_debts boolean not null default true,
  start_date date,
  end_date date,
  status text not null default 'active',
  created_by_user_id uuid not null references split_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint split_groups_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint split_groups_currency_shape check (base_currency ~ '^[A-Z]{3}$'),
  constraint split_groups_date_range check (start_date is null or end_date is null or start_date <= end_date),
  constraint split_groups_status check (status in ('active', 'archived'))
);

create index if not exists split_groups_created_by_idx on split_groups (created_by_user_id);
create index if not exists split_groups_status_idx on split_groups (status, updated_at desc);

create table if not exists split_group_members (
  id uuid primary key,
  group_id uuid not null references split_groups(id) on delete cascade,
  user_id uuid references split_users(id),
  display_name text not null,
  role text not null,
  membership_status text not null default 'active',
  joined_at timestamptz not null default now(),
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint split_group_members_display_name_length check (char_length(btrim(display_name)) between 1 and 100),
  constraint split_group_members_role check (role in ('owner', 'member')),
  constraint split_group_members_status check (membership_status in ('active', 'left', 'removed')),
  constraint split_group_members_owner_registered check (role <> 'owner' or user_id is not null),
  constraint split_group_members_guest_role check (user_id is not null or role = 'member'),
  constraint split_group_members_group_id_id_unique unique (group_id, id)
);

create unique index if not exists split_group_members_registered_unique
  on split_group_members (group_id, user_id)
  where user_id is not null;

create unique index if not exists split_group_members_one_active_owner
  on split_group_members (group_id)
  where role = 'owner' and membership_status = 'active';

create index if not exists split_group_members_group_status_idx
  on split_group_members (group_id, membership_status);

create table if not exists split_invites (
  id uuid primary key,
  group_id uuid not null references split_groups(id) on delete cascade,
  target_member_id uuid,
  token_hash text not null unique,
  created_by_user_id uuid not null references split_users(id),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claimed_by_user_id uuid references split_users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint split_invites_target_same_group foreign key (group_id, target_member_id)
    references split_group_members(group_id, id),
  constraint split_invites_expiry check (expires_at > created_at),
  constraint split_invites_claim_pair check (
    (claimed_at is null and claimed_by_user_id is null) or
    (claimed_at is not null and claimed_by_user_id is not null)
  )
);

create index if not exists split_invites_group_idx on split_invites (group_id, created_at desc);
create index if not exists split_invites_active_expiry_idx
  on split_invites (expires_at)
  where claimed_at is null and revoked_at is null;

create table if not exists split_activity_logs (
  id uuid primary key,
  group_id uuid not null references split_groups(id) on delete cascade,
  actor_user_id uuid references split_users(id),
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint split_activity_logs_action check (action_type in (
    'GROUP_CREATED', 'GROUP_UPDATED', 'GROUP_ARCHIVED', 'GROUP_REOPENED',
    'MEMBER_ADDED', 'MEMBER_REMOVED', 'MEMBER_JOINED',
    'INVITE_CREATED', 'INVITE_REVOKED', 'INVITE_CLAIMED'
  )),
  constraint split_activity_logs_entity_type check (entity_type in ('group', 'member', 'invite')),
  constraint split_activity_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists split_activity_logs_group_created_idx
  on split_activity_logs (group_id, created_at desc);
