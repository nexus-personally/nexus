create table if not exists split_settlements (
  id uuid primary key,
  group_id uuid not null references split_groups(id) on delete cascade,
  from_group_member_id uuid not null,
  to_group_member_id uuid not null,
  amount_minor bigint not null,
  currency varchar(3) not null,
  payment_method text not null,
  settlement_date date not null,
  note text,
  created_by_user_id uuid not null references split_users(id),
  created_at timestamptz not null default now(),
  constraint split_settlements_amount_positive check (amount_minor > 0),
  constraint split_settlements_distinct_members check (from_group_member_id <> to_group_member_id),
  constraint split_settlements_currency_shape check (currency ~ '^[A-Z]{3}$'),
  constraint split_settlements_payment_method check (payment_method in ('cash','duitnow','bank_transfer','ewallet','other')),
  constraint split_settlements_from_same_group foreign key (group_id, from_group_member_id) references split_group_members(group_id, id),
  constraint split_settlements_to_same_group foreign key (group_id, to_group_member_id) references split_group_members(group_id, id)
);

create index if not exists split_settlements_group_date_idx on split_settlements (group_id, settlement_date desc, created_at desc);
create index if not exists split_settlements_from_idx on split_settlements (from_group_member_id);
create index if not exists split_settlements_to_idx on split_settlements (to_group_member_id);

alter table split_activity_logs drop constraint if exists split_activity_logs_action;
alter table split_activity_logs add constraint split_activity_logs_action check (action_type in (
  'GROUP_CREATED', 'GROUP_UPDATED', 'GROUP_ARCHIVED', 'GROUP_REOPENED',
  'MEMBER_ADDED', 'MEMBER_REMOVED', 'MEMBER_JOINED',
  'INVITE_CREATED', 'INVITE_REVOKED', 'INVITE_CLAIMED',
  'EXPENSE_CREATED', 'EXPENSE_UPDATED', 'EXPENSE_DELETED',
  'SETTLEMENT_CREATED'
));

alter table split_activity_logs drop constraint if exists split_activity_logs_entity_type;
alter table split_activity_logs add constraint split_activity_logs_entity_type check (entity_type in ('group', 'member', 'invite', 'expense', 'settlement'));
