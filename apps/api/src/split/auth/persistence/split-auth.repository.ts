import type { SplitAccountStatus } from '../split-auth.types.js';

export const SPLIT_AUTH_REPOSITORY = Symbol('SPLIT_AUTH_REPOSITORY');

export interface SplitUserRecord {
  id: string;
  username: string;
  normalizedUsername: string;
  displayName: string;
  monthlyBudgetMinor: number | null;
  passwordHash: string;
  accountStatus: SplitAccountStatus;
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
  'lastLoginAt' | 'createdAt' | 'updatedAt'
>;
export type CreateSplitSessionInput = Omit<SplitSessionRecord, 'revokedAt'>;

export interface SplitAuthRepository {
  findUserByNormalizedUsername(username: string): Promise<SplitUserRecord | undefined>;
  createUserWithSession(
    user: CreateSplitUserInput,
    session: CreateSplitSessionInput,
  ): Promise<{ user: SplitUserRecord; session: SplitSessionRecord }>;
  updateLastLogin(userId: string, at: Date): Promise<void>;
  createSession(input: CreateSplitSessionInput): Promise<SplitSessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<SplitSessionRecord | undefined>;
  touchSession(sessionId: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<void>;
  revokeSession(sessionId: string, at: Date, reason?: string): Promise<void>;
  updateProfile(userId: string, input: { displayName?: string; monthlyBudgetMinor?: number }, at: Date): Promise<SplitUserRecord>;
  updatePassword(userId: string, passwordHash: string, at: Date): Promise<void>;
}
