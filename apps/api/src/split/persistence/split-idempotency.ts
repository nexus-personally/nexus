import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { splitConflict, splitDomainInvalid } from '../split-errors.js';

export interface SplitIdempotencyCommand {
  userId: string;
  operation: string;
  key: string;
  requestHash: string;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function createIdempotencyCommand(
  userId: string,
  operation: string,
  rawKey: string | undefined,
  request: unknown,
): SplitIdempotencyCommand {
  if (!rawKey || !/^[A-Za-z0-9._:-]{16,128}$/.test(rawKey))
    splitDomainInvalid('SPLIT_IDEMPOTENCY_KEY_INVALID', 'A valid Idempotency-Key header is required.');
  return {
    userId,
    operation,
    key: rawKey!,
    requestHash: createHash('sha256').update(stableJson(request)).digest('hex'),
  };
}

/** Returns the stored response on replay, or null after reserving this key in the caller's transaction. */
export async function claimIdempotency(client: PoolClient, command: SplitIdempotencyCommand): Promise<unknown | null> {
  await client.query(
    `delete from split_idempotency_keys where user_id=$1 and expires_at <= now()`,
    [command.userId],
  );
  await client.query(
    `delete from split_idempotency_keys where user_id=$1 and operation=$2 and idempotency_key=$3 and expires_at <= now()`,
    [command.userId, command.operation, command.key],
  );
  const inserted = await client.query(
    `insert into split_idempotency_keys (user_id,operation,idempotency_key,request_hash,expires_at)
     values ($1,$2,$3,$4,now() + interval '24 hours')
     on conflict (user_id,operation,idempotency_key) do nothing returning idempotency_key`,
    [command.userId, command.operation, command.key, command.requestHash],
  );
  if (inserted.rowCount) return null;
  const existing = await client.query<{ request_hash: string; response_json: unknown }>(
    `select request_hash,response_json from split_idempotency_keys
      where user_id=$1 and operation=$2 and idempotency_key=$3 for update`,
    [command.userId, command.operation, command.key],
  );
  const row = existing.rows[0];
  if (!row) throw new Error('idempotency_record_disappeared');
  if (row.request_hash !== command.requestHash)
    splitConflict('SPLIT_IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for a different request.');
  if (row.response_json === null) throw new Error('idempotency_response_missing');
  return row.response_json;
}

export async function saveIdempotencyResponse(
  client: PoolClient,
  command: SplitIdempotencyCommand,
  response: unknown,
) {
  const result = await client.query(
    `update split_idempotency_keys set response_json=$4::jsonb
      where user_id=$1 and operation=$2 and idempotency_key=$3`,
    [command.userId, command.operation, command.key, JSON.stringify(response)],
  );
  if (!result.rowCount) throw new Error('idempotency_record_missing');
}
