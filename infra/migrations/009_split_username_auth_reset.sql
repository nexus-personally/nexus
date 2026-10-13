-- Product decision: reset Split data and remove email-based Split authentication.
-- Preserve schema_migrations and all non-Split tables (Resume, central users, Mahjong).
TRUNCATE TABLE
  split_idempotency_keys,
  split_budget_adjustments,
  split_activity_logs,
  split_settlements,
  split_expense_payments,
  split_expense_splits,
  split_expenses,
  split_invites,
  split_group_members,
  split_groups,
  split_sessions,
  split_users;

DROP INDEX IF EXISTS split_users_normalized_email_unique;

ALTER TABLE split_users
  DROP COLUMN email,
  DROP COLUMN normalized_email,
  DROP COLUMN email_verified_at,
  ADD COLUMN username text NOT NULL,
  ADD COLUMN normalized_username text NOT NULL,
  ADD CONSTRAINT split_users_username_length
    CHECK (char_length(btrim(username)) BETWEEN 3 AND 30),
  ADD CONSTRAINT split_users_username_format
    CHECK (username = btrim(username) AND username ~ '^[A-Za-z0-9_]+$'),
  ADD CONSTRAINT split_users_username_normalized
    CHECK (normalized_username = lower(btrim(username)));

CREATE UNIQUE INDEX split_users_normalized_username_unique
  ON split_users (normalized_username);
