import { createHmac, timingSafeEqual } from 'node:crypto';

export function splitCsrfSecret() {
  const configured = process.env.SPLIT_CSRF_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SPLIT_CSRF_SECRET must contain at least 32 characters in production.');
  }
  return 'nexus-split-development-csrf-secret-change-me';
}

export class SplitCsrfService {
  constructor(private readonly secret: string) {
    if (secret.length < 32)
      throw new Error('Split CSRF secret must contain at least 32 characters.');
  }

  tokenForSession(sessionId: string) {
    return createHmac('sha256', this.secret).update(sessionId).digest('base64url');
  }

  verify(sessionId: string, suppliedToken: string | undefined) {
    if (!suppliedToken) return false;
    const expected = Buffer.from(this.tokenForSession(sessionId), 'utf8');
    const supplied = Buffer.from(suppliedToken, 'utf8');
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  }
}
