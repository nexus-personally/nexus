create table if not exists split_credit_cards (
  id uuid primary key,
  user_id uuid not null references split_users(id) on delete cascade,
  name text not null,
  amount_minor bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint split_credit_cards_name_length
    check (char_length(btrim(name)) between 1 and 60),
  constraint split_credit_cards_amount_nonnegative
    check (amount_minor >= 0)
);

create index if not exists split_credit_cards_user_created_idx
  on split_credit_cards (user_id, created_at, id);
