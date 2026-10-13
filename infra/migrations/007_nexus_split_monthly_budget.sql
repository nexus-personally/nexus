alter table split_users add column if not exists monthly_budget_minor bigint;

alter table split_users drop constraint if exists split_users_monthly_budget_positive;
alter table split_users add constraint split_users_monthly_budget_positive
  check (monthly_budget_minor is null or monthly_budget_minor > 0);

create table if not exists split_budget_adjustments (
  id uuid primary key,
  user_id uuid not null references split_users(id) on delete cascade,
  kind text not null,
  amount_minor bigint not null,
  note text,
  effective_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint split_budget_adjustments_kind check (kind in ('income', 'expense')),
  constraint split_budget_adjustments_amount_positive check (amount_minor > 0),
  constraint split_budget_adjustments_note_length check (note is null or char_length(note) <= 500)
);

create index if not exists split_budget_adjustments_user_date_idx
  on split_budget_adjustments (user_id, effective_date desc, created_at desc);
