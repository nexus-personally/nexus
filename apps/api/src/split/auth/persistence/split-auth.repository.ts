import type { SplitAccountStatus } from '../split-auth.types.js';

export const SPLIT_AUTH_REPOSITORY = Symbol('SPLIT_AUTH_REPOSITORY');

export interface SplitUserRecord {
  id: string;
  email: string;
  normalizedEmail: string;
  displayName: string;
  passwordHash: string;
  accountStatus: SplitAccountStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SplitSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  revocationReason?: string | null;
  userAgent?: string | null;
  ipHash?: string | null;
  user?: SplitUserRecord;
}

export type CreateSplitUserInput = Omit<
  SplitUserRecord,
  'emailVerifiedAt' | 'lastLoginAt' | 'createdAt' | 'updatedAt'
>;
export type CreateSplitSessionInput = Omit<SplitSessionRecord, 'revokedAt'>;

export interface SplitAuthRepository {
  findUserByNormalizedEmail(email: string): Promise<SplitUserRecord | undefined>;
  createUserWithSession(
    user: CreateSplitUserInput,
    session: CreateSplitSessionInput,
  ): Promise<{ user: SplitUserRecord; session: SplitSessionRecord }>;
  updateLastLogin(userId: string, at: Date): Promise<void>;
  createSession(input: CreateSplitSessionInput): Promise<SplitSessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<SplitSessionRecord | undefined>;
  touchSession(sessionId: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<void>;
  revokeSession(sessionId: string, at: Date, reason?: string): Promise<void>;
}
