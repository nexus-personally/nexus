create table if not exists split_expenses (
  id uuid primary key,
  group_id uuid not null references split_groups(id) on delete cascade,
  description text not null,
  category_key text not null,
  split_method text not null,
  original_amount_minor bigint not null,
  original_currency varchar(3) not null,
  base_amount_minor bigint not null,
  base_currency varchar(3) not null,
  exchange_rate numeric(24, 12),
  expense_date date not null,
  note text,
  created_by_user_id uuid not null references split_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by_user_id uuid references split_users(id),
  constraint split_expenses_group_id_id_unique unique (group_id, id),
  constraint split_expenses_description_length check (char_length(btrim(description)) between 1 and 200),
  constraint split_expenses_category check (category_key in ('food','transport','accommodation','shopping','entertainment','travel','home','bills','grocery','health','gift','other')),
  constraint split_expenses_split_method check (split_method in ('equal','exact','percentage','shares')),
  constraint split_expenses_amounts_positive check (original_amount_minor > 0 and base_amount_minor > 0),
  constraint split_expenses_currency_shape check (original_currency ~ '^[A-Z]{3}$' and base_currency ~ '^[A-Z]{3}$'),
  constraint split_expenses_exchange_rate_positive check (exchange_rate is null or exchange_rate > 0),
  constraint split_expenses_same_currency_consistent check (original_currency <> base_currency or (original_amount_minor = base_amount_minor and exchange_rate = 1)),
  constraint split_expenses_deleted_pair check ((deleted_at is null and deleted_by_user_id is null) or (deleted_at is not null and deleted_by_user_id is not null))
);

create index if not exists split_expenses_group_active_date_idx
  on split_expenses (group_id, expense_date desc, created_at desc)
  where deleted_at is null;
create index if not exists split_expenses_creator_idx on split_expenses (created_by_user_id);

create table if not exists split_expense_payments (
  id uuid primary key,
  group_id uuid not null,
  expense_id uuid not null,
  group_member_id uuid not null,
  amount_minor bigint not null,
  created_at timestamptz not null default now(),
  constraint split_expense_payments_amount_positive check (amount_minor > 0),
  constraint split_expense_payments_member_unique unique (expense_id, group_member_id),
  constraint split_expense_payments_expense_same_group foreign key (group_id, expense_id) references split_expenses(group_id, id) on delete cascade,
  constraint split_expense_payments_member_same_group foreign key (group_id, group_member_id) references split_group_members(group_id, id)
);

create index if not exists split_expense_payments_expense_idx on split_expense_payments (expense_id);
create index if not exists split_expense_payments_member_idx on split_expense_payments (group_member_id);

create table if not exists split_expense_splits (
  id uuid primary key,
  group_id uuid not null,
  expense_id uuid not null,
  group_member_id uuid not null,
  amount_minor bigint not null,
  created_at timestamptz not null default now(),
  constraint split_expense_splits_amount_positive check (amount_minor > 0),
  constraint split_expense_splits_member_unique unique (expense_id, group_member_id),
  constraint split_expense_splits_expense_same_group foreign key (group_id, expense_id) references split_expenses(group_id, id) on delete cascade,
  constraint split_expense_splits_member_same_group foreign key (group_id, group_member_id) references split_group_members(group_id, id)
);

create index if not exists split_expense_splits_expense_idx on split_expense_splits (expense_id);
create index if not exists split_expense_splits_member_idx on split_expense_splits (group_member_id);

alter table split_activity_logs drop constraint if exists split_activity_logs_action;
alter table split_activity_logs add constraint split_activity_logs_action check (action_type in (
  'GROUP_CREATED', 'GROUP_UPDATED', 'GROUP_ARCHIVED', 'GROUP_REOPENED',
  'MEMBER_ADDED', 'MEMBER_REMOVED', 'MEMBER_JOINED',
  'INVITE_CREATED', 'INVITE_REVOKED', 'INVITE_CLAIMED',
  'EXPENSE_CREATED', 'EXPENSE_UPDATED', 'EXPENSE_DELETED'
));

alter table split_activity_logs drop constraint if exists split_activity_logs_entity_type;
alter table split_activity_logs add constraint split_activity_logs_entity_type check (entity_type in ('group', 'member', 'invite', 'expense'));
