import { randomBytes, randomUUID } from 'node:crypto';
import type { SplitDomainRuntime } from './persistence/split.repository.js';
export const defaultSplitDomainRuntime: SplitDomainRuntime = {
  now: () => new Date(),
  uuid: randomUUID,
  token: () => randomBytes(32).toString('base64url'),
};
