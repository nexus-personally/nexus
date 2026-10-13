CREATE TABLE split_idempotency_keys (
  user_id UUID NOT NULL REFERENCES split_users(id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (length(operation) BETWEEN 1 AND 200),
  idempotency_key VARCHAR(128) NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, operation, idempotency_key),
  CHECK (expires_at > created_at)
);

CREATE INDEX split_idempotency_keys_expiry_idx ON split_idempotency_keys (expires_at);
