import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { SplitPasswordHasher } from './password/split-password-hasher.js';
import { SPLIT_PASSWORD_HASHER } from './password/split-password-hasher.js';
import type {
  SplitAuthRepository,
  SplitSessionRecord,
  SplitUserRecord,
} from './persistence/split-auth.repository.js';
import { SPLIT_AUTH_REPOSITORY } from './persistence/split-auth.repository.js';
import {
  defaultSplitAuthRuntime,
  SPLIT_ABSOLUTE_SESSION_MS,
  SPLIT_AUTH_RUNTIME,
  SPLIT_IDLE_SESSION_MS,
  splitTokenHash,
  type SplitAuthRuntime,
} from './session/split-session.js';
import type {
  SplitAuthenticatedSession,
  SplitAuthResult,
  SplitCurrentUser,
} from './split-auth.types.js';
import { validateSplitLogin, validateSplitRegister } from './validation/split-auth.validation.js';
import { SplitCsrfService } from './session/split-csrf.service.js';

const invalidCredentials = () =>
  new UnauthorizedException({
    error: { code: 'SPLIT_AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password.' },
  });

function publicUser(user: SplitUserRecord): SplitCurrentUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    accountStatus: user.accountStatus,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

@Injectable()
export class SplitAuthService {
  constructor(
    @Inject(SPLIT_AUTH_REPOSITORY) private readonly repository: SplitAuthRepository,
    @Inject(SPLIT_PASSWORD_HASHER) private readonly passwordHasher: SplitPasswordHasher,
    private readonly csrf: SplitCsrfService,
    @Inject(SPLIT_AUTH_RUNTIME)
    private readonly runtime: SplitAuthRuntime = defaultSplitAuthRuntime,
  ) {}

  async register(body: unknown): Promise<SplitAuthResult> {
    const input = validateSplitRegister(body);
    if (await this.repository.findUserByNormalizedEmail(input.normalizedEmail)) {
      throw new ConflictException({
        error: { code: 'SPLIT_AUTH_EMAIL_EXISTS', message: 'An account already uses this email.' },
      });
    }
    const userInput = {
      id: this.runtime.randomUuid(),
      email: input.email,
      normalizedEmail: input.normalizedEmail,
      displayName: input.displayName,
      passwordHash: await this.passwordHasher.hash(input.password),
      accountStatus: 'active',
    } as const;
    const fresh = this.freshSession(userInput.id);
    const created = await this.repository.createUserWithSession(userInput, fresh.session);
    return {
      user: publicUser(created.user),
      sessionToken: fresh.sessionToken,
      csrfToken: this.csrf.tokenForSession(created.session.id),
      absoluteExpiresAt: created.session.absoluteExpiresAt,
    };
  }

  async login(body: unknown): Promise<SplitAuthResult> {
    const input = validateSplitLogin(body);
    const user = await this.repository.findUserByNormalizedEmail(input.normalizedEmail);
    if (!user) {
      await this.passwordHasher.hash(input.password);
      throw invalidCredentials();
    }
    if (!(await this.passwordHasher.verify(user.passwordHash, input.password)))
      throw invalidCredentials();
    if (user.accountStatus !== 'active') throw invalidCredentials();
    const now = this.runtime.now();
    await this.repository.updateLastLogin(user.id, now);
    user.lastLoginAt = now;
    return this.createAuthResult(user);
  }

  async authenticate(sessionToken: string | undefined): Promise<SplitAuthenticatedSession> {
    if (!sessionToken)
      throw new UnauthorizedException({
        error: { code: 'SPLIT_AUTH_REQUIRED', message: 'Sign in to continue.' },
      });
    const session = await this.repository.findSessionByTokenHash(splitTokenHash(sessionToken));
    const now = this.runtime.now();
    if (
      !session ||
      session.revokedAt ||
      session.idleExpiresAt <= now ||
      session.absoluteExpiresAt <= now ||
      !session.user
    ) {
      throw new UnauthorizedException({
        error: { code: 'SPLIT_AUTH_SESSION_EXPIRED', message: 'Your session has expired.' },
      });
    }
    if (session.user.accountStatus !== 'active') {
      throw new ForbiddenException({
        error: { code: 'SPLIT_AUTH_ACCOUNT_UNAVAILABLE', message: 'This account is unavailable.' },
      });
    }
    if (now.getTime() - session.lastSeenAt.getTime() >= 15 * 60_000) {
      const idleExpiresAt = new Date(
        Math.min(now.getTime() + SPLIT_IDLE_SESSION_MS, session.absoluteExpiresAt.getTime()),
      );
      await this.repository.touchSession(session.id, now, idleExpiresAt);
    }
    return { user: publicUser(session.user), sessionId: session.id };
  }

  verifyCsrf(session: SplitAuthenticatedSession, csrfToken: string | undefined) {
    if (!this.csrf.verify(session.sessionId, csrfToken)) {
      throw new ForbiddenException({
        error: { code: 'SPLIT_CSRF_INVALID', message: 'Request verification failed.' },
      });
    }
  }

  async logout(sessionId: string) {
    await this.repository.revokeSession(sessionId, this.runtime.now(), 'logout');
  }

  csrfForSession(session: SplitAuthenticatedSession) {
    return this.csrf.tokenForSession(session.sessionId);
  }

  async revokePresentedSession(sessionToken: string | undefined) {
    if (!sessionToken) return;
    const session = await this.repository.findSessionByTokenHash(splitTokenHash(sessionToken));
    if (session && !session.revokedAt) {
      await this.repository.revokeSession(session.id, this.runtime.now(), 'session-rotation');
    }
  }

  private async createAuthResult(user: SplitUserRecord): Promise<SplitAuthResult> {
    const fresh = this.freshSession(user.id);
    const session: SplitSessionRecord = await this.repository.createSession(fresh.session);
    return {
      user: publicUser(user),
      sessionToken: fresh.sessionToken,
      csrfToken: this.csrf.tokenForSession(session.id),
      absoluteExpiresAt: session.absoluteExpiresAt,
    };
  }

  private freshSession(userId: string) {
    const now = this.runtime.now();
    const sessionToken = this.runtime.randomToken();
    return {
      sessionToken,
      session: {
        id: this.runtime.randomUuid(),
        userId,
        tokenHash: splitTokenHash(sessionToken),
        createdAt: now,
        lastSeenAt: now,
        idleExpiresAt: new Date(now.getTime() + SPLIT_IDLE_SESSION_MS),
        absoluteExpiresAt: new Date(now.getTime() + SPLIT_ABSOLUTE_SESSION_MS),
      },
    };
  }
}
