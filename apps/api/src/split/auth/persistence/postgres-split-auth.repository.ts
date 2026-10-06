import { ConflictException, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { createPostgresPool } from '../../../database/postgres.js';
import type {
  CreateSplitSessionInput,
  CreateSplitUserInput,
  SplitAuthRepository,
  SplitSessionRecord,
  SplitUserRecord,
} from './split-auth.repository.js';

interface UserRow extends QueryResultRow {
  id: string;
  email: string;
  normalized_email: string;
  display_name: string;
  password_hash: string;
  account_status: SplitUserRecord['accountStatus'];
  email_verified_at: Date | string | null;
  last_login_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface SessionRow extends QueryResultRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: Date | string;
  last_seen_at: Date | string;
  idle_expires_at: Date | string;
  absolute_expires_at: Date | string;
  revoked_at: Date | string | null;
  revocation_reason: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  user?: UserRow;
}

function mapUser(row: UserRow): SplitUserRecord {
  return {
    id: row.id,
    email: row.email,
    normalizedEmail: row.normalized_email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    accountStatus: row.account_status,
    emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapSession(row: SessionRow): SplitSessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    createdAt: new Date(row.created_at),
    lastSeenAt: new Date(row.last_seen_at),
    idleExpiresAt: new Date(row.idle_expires_at),
    absoluteExpiresAt: new Date(row.absolute_expires_at),
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    revocationReason: row.revocation_reason,
    userAgent: row.user_agent,
    ipHash: row.ip_hash,
    ...(row.user ? { user: mapUser(row.user) } : {}),
  };
}

@Injectable()
export class PostgresSplitAuthRepository implements SplitAuthRepository, OnModuleDestroy {
  private readonly pool = createPostgresPool();
  private lastCleanupAt = 0;

  private async cleanupSessions() {
    const now=Date.now();
    if(now-this.lastCleanupAt<60*60_000)return;
    this.lastCleanupAt=now;
    await this.pool.query(`delete from split_sessions where absolute_expires_at < now() - interval '30 days' or (revoked_at is not null and revoked_at < now() - interval '30 days')`);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async findUserByNormalizedEmail(email: string) {
    const result = await this.pool.query<UserRow>(
      'select * from split_users where normalized_email = $1',
      [email],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  }

  async createUserWithSession(user: CreateSplitUserInput, session: CreateSplitSessionInput) {
    await this.cleanupSessions();
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const userResult = await client.query<UserRow>(
        `insert into split_users (id, email, normalized_email, display_name, password_hash, account_status)
         values ($1, $2, $3, $4, $5, $6)
         returning *`,
        [
          user.id,
          user.email,
          user.normalizedEmail,
          user.displayName,
          user.passwordHash,
          user.accountStatus,
        ],
      );
      const sessionResult = await client.query<SessionRow>(
        `insert into split_sessions (
           id, user_id, token_hash, created_at, last_seen_at,
           idle_expires_at, absolute_expires_at, user_agent, ip_hash
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         returning *`,
        [
          session.id,
          session.userId,
          session.tokenHash,
          session.createdAt,
          session.lastSeenAt,
          session.idleExpiresAt,
          session.absoluteExpiresAt,
          session.userAgent ?? null,
          session.ipHash ?? null,
        ],
      );
      await client.query('commit');
      return { user: mapUser(userResult.rows[0]!), session: mapSession(sessionResult.rows[0]!) };
    } catch (error) {
      await client.query('rollback');
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException({
          error: {
            code: 'SPLIT_AUTH_EMAIL_EXISTS',
            message: 'An account already uses this email.',
          },
        });
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updateLastLogin(userId: string, at: Date) {
    await this.pool.query(
      'update split_users set last_login_at = $2, updated_at = $2 where id = $1',
      [userId, at],
    );
  }

  async createSession(input: CreateSplitSessionInput) {
    await this.cleanupSessions();
    const result = await this.pool.query<SessionRow>(
      `insert into split_sessions (
         id, user_id, token_hash, created_at, last_seen_at,
         idle_expires_at, absolute_expires_at, user_agent, ip_hash
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning *`,
      [
        input.id,
        input.userId,
        input.tokenHash,
        input.createdAt,
        input.lastSeenAt,
        input.idleExpiresAt,
        input.absoluteExpiresAt,
        input.userAgent ?? null,
        input.ipHash ?? null,
      ],
    );
    return mapSession(result.rows[0]!);
  }

  async findSessionByTokenHash(tokenHash: string) {
    const result = await this.pool.query<SessionRow>(
      `select s.*, row_to_json(u) as user
       from split_sessions s
       join split_users u on u.id = s.user_id
       where s.token_hash = $1`,
      [tokenHash],
    );
    return result.rows[0] ? mapSession(result.rows[0]) : undefined;
  }

  async touchSession(sessionId: string, lastSeenAt: Date, idleExpiresAt: Date) {
    await this.pool.query(
      'update split_sessions set last_seen_at = $2, idle_expires_at = $3 where id = $1 and revoked_at is null',
      [sessionId, lastSeenAt, idleExpiresAt],
    );
  }

  async revokeSession(sessionId: string, at: Date, reason = 'revoked') {
    await this.pool.query(
      `update split_sessions
       set revoked_at = coalesce(revoked_at, $2), revocation_reason = coalesce(revocation_reason, $3)
       where id = $1`,
      [sessionId, at, reason],
    );
  }
}
