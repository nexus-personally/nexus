import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const splitTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export interface SplitAuthRuntime {
  now(): Date;
  randomToken(): string;
  randomUuid(): string;
}

export const SPLIT_AUTH_RUNTIME = Symbol('SPLIT_AUTH_RUNTIME');

export const defaultSplitAuthRuntime: SplitAuthRuntime = {
  now: () => new Date(),
  randomToken: () => randomBytes(32).toString('base64url'),
  randomUuid: randomUUID,
};

export const SPLIT_IDLE_SESSION_MS = 7 * 24 * 60 * 60 * 1_000;
export const SPLIT_ABSOLUTE_SESSION_MS = 30 * 24 * 60 * 60 * 1_000;
