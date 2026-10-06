import assert from 'node:assert/strict';
import test from 'node:test';
import { SplitAuthService } from './split-auth.service.js';
import type {
  CreateSplitSessionInput,
  CreateSplitUserInput,
  SplitAuthRepository,
  SplitSessionRecord,
  SplitUserRecord,
} from './persistence/split-auth.repository.js';
import type { SplitPasswordHasher } from './password/split-password-hasher.js';
import { clearSessionCookie, sessionCookie } from './session/split-session-cookie.js';
import { isAllowedSplitOrigin } from './split-origin.guard.js';
import { Argon2SplitPasswordHasher } from './password/argon2-split-password-hasher.js';
import { SplitCsrfService } from './session/split-csrf.service.js';

const testCsrf = () => new SplitCsrfService('test-only-split-csrf-secret-32-characters');

class FakePasswordHasher implements SplitPasswordHasher {
  async hash(password: string) {
    return `argon2id:${password}`;
  }

  async verify(hash: string, password: string) {
    return hash === `argon2id:${password}`;
  }
}

class FakeRepository implements SplitAuthRepository {
  users: SplitUserRecord[] = [];
  sessions: SplitSessionRecord[] = [];

  async findUserByNormalizedEmail(email: string) {
    return this.users.find((user) => user.normalizedEmail === email);
  }

  async createUserWithSession(input: CreateSplitUserInput, sessionInput: CreateSplitSessionInput) {
    const now = new Date();
    const user: SplitUserRecord = {
      ...input,
      emailVerifiedAt: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(user);
    const session: SplitSessionRecord = { ...sessionInput, revokedAt: null };
    this.sessions.push(session);
    return { user, session };
  }

  async updateLastLogin(userId: string, at: Date) {
    const user = this.users.find((candidate) => candidate.id === userId)!;
    user.lastLoginAt = at;
  }

  async createSession(input: CreateSplitSessionInput) {
    const session: SplitSessionRecord = { ...input, revokedAt: null };
    this.sessions.push(session);
    return session;
  }

  async findSessionByTokenHash(tokenHash: string) {
    const session = this.sessions.find((candidate) => candidate.tokenHash === tokenHash);
    return session
      ? { ...session, user: this.users.find((user) => user.id === session.userId) }
      : undefined;
  }

  async touchSession() {}

  async revokeSession(sessionId: string, at: Date) {
    const session = this.sessions.find((candidate) => candidate.id === sessionId);
    if (session) session.revokedAt = at;
  }
}

test('register creates a normalized Split user and authenticated session', async () => {
  const repository = new FakeRepository();
  const service = new SplitAuthService(repository, new FakePasswordHasher(), testCsrf(), {
    now: () => new Date('2026-10-06T00:00:00.000Z'),
    randomToken: () => 'a'.repeat(64),
    randomUuid: () => '10000000-0000-4000-8000-000000000001',
  });

  const result = await service.register({
    email: '  Person@Example.COM ',
    displayName: ' Person ',
    password: 'correct horse battery staple',
  });

  assert.equal(result.user.email, 'Person@Example.COM');
  assert.equal(repository.users[0]?.normalizedEmail, 'person@example.com');
  assert.equal(result.user.displayName, 'Person');
  assert.equal(repository.sessions.length, 1);
  assert.equal(result.sessionToken, 'a'.repeat(64));
  assert.ok(result.csrfToken);
});

function errorCode(error: unknown) {
  const response = (error as { getResponse?: () => unknown }).getResponse?.() as
    { error?: { code?: string } } | undefined;
  return response?.error?.code;
}

function harness(nowValue = new Date('2026-10-06T00:00:00.000Z')) {
  const repository = new FakeRepository();
  let now = nowValue;
  let sequence = 0;
  const service = new SplitAuthService(repository, new FakePasswordHasher(), testCsrf(), {
    now: () => now,
    randomToken: () => String(++sequence).padStart(64, 'a'),
    randomUuid: () => `10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
  });
  return {
    repository,
    service,
    setNow: (value: Date) => {
      now = value;
    },
  };
}

test('duplicate normalized email is rejected regardless of case', async () => {
  const { service } = harness();
  await service.register({
    email: 'Person@example.com',
    displayName: 'Person',
    password: 'a secure password',
  });
  await assert.rejects(
    service.register({
      email: 'person@EXAMPLE.com',
      displayName: 'Other',
      password: 'another password',
    }),
    (error) => errorCode(error) === 'SPLIT_AUTH_EMAIL_EXISTS',
  );
});

test('weak registration input is rejected', async () => {
  const { service } = harness();
  await assert.rejects(
    service.register({ email: 'invalid', displayName: '', password: 'tiny' }),
    (error) => errorCode(error) === 'VALIDATION_FAILED',
  );
});

test('registration accepts a five-character password', async () => {
  const { service } = harness();
  const result = await service.register({
    email: 'five@example.com',
    displayName: 'Five',
    password: '12345',
  });
  assert.equal(result.user.email, 'five@example.com');
});

test('login failure is generic for unknown email and wrong password', async () => {
  const { service } = harness();
  await service.register({
    email: 'person@example.com',
    displayName: 'Person',
    password: 'correct password',
  });
  for (const input of [
    { email: 'missing@example.com', password: 'correct password' },
    { email: 'person@example.com', password: 'wrong password!' },
  ]) {
    await assert.rejects(
      service.login(input),
      (error) => errorCode(error) === 'SPLIT_AUTH_INVALID_CREDENTIALS',
    );
  }
});

test('successful login creates an additional device session', async () => {
  const { service, repository } = harness();
  const registered = await service.register({
    email: 'person@example.com',
    displayName: 'Person',
    password: 'correct password',
  });
  const login = await service.login({ email: 'PERSON@example.com', password: 'correct password' });
  assert.equal(login.user.email, 'person@example.com');
  assert.equal(repository.sessions.length, 2);
  assert.notEqual(login.sessionToken, registered.sessionToken);
  assert.notEqual(login.csrfToken, registered.csrfToken);
});

test('multi-device sessions remain independent when one device logs out', async () => {
  const { service } = harness();
  const deviceA = await service.register({
    email: 'person@example.com',
    displayName: 'Person',
    password: 'correct password',
  });
  const deviceB = await service.login({
    email: 'person@example.com',
    password: 'correct password',
  });
  const sessionA = await service.authenticate(deviceA.sessionToken);
  const sessionB = await service.authenticate(deviceB.sessionToken);
  await service.logout(sessionA.sessionId);
  await assert.rejects(
    service.authenticate(deviceA.sessionToken),
    (error) => errorCode(error) === 'SPLIT_AUTH_SESSION_EXPIRED',
  );
  const stillActive = await service.authenticate(deviceB.sessionToken);
  assert.equal(stillActive.sessionId, sessionB.sessionId);
  assert.doesNotThrow(() => service.verifyCsrf(stillActive, deviceB.csrfToken));
});

test('two tabs restoring the same session receive one stable CSRF token', async () => {
  const { service, repository } = harness();
  const registered = await service.register({
    email: 'person@example.com',
    displayName: 'Person',
    password: 'correct password',
  });
  const tabOneSession = await service.authenticate(registered.sessionToken);
  const tabTwoSession = await service.authenticate(registered.sessionToken);
  const tabOneCsrf = service.csrfForSession(tabOneSession);
  const tabTwoCsrf = service.csrfForSession(tabTwoSession);
  assert.equal(tabOneSession.user.id, registered.user.id);
  assert.equal(tabOneCsrf, registered.csrfToken);
  assert.equal(tabTwoCsrf, registered.csrfToken);
  assert.doesNotThrow(() => service.verifyCsrf(tabOneSession, tabOneCsrf));
  assert.doesNotThrow(() => service.verifyCsrf(tabTwoSession, tabTwoCsrf));
  assert.equal(repository.sessions.length, 1);
});

test('logout revokes the current session and revoked sessions are rejected', async () => {
  const { service } = harness();
  const registered = await service.register({
    email: 'person@example.com',
    displayName: 'Person',
    password: 'correct password',
  });
  const current = await service.authenticate(registered.sessionToken);
  await service.logout(current.sessionId);
  await assert.rejects(
    service.authenticate(registered.sessionToken),
    (error) => errorCode(error) === 'SPLIT_AUTH_SESSION_EXPIRED',
  );
});

test('idle and absolute expiry reject sessions', async () => {
  for (const elapsed of [8, 31]) {
    const { service, setNow } = harness();
    const registered = await service.register({
      email: 'person@example.com',
      displayName: 'Person',
      password: 'correct password',
    });
    setNow(new Date(`2026-11-${String(elapsed === 31 ? 6 : 1).padStart(2, '0')}T00:00:00.000Z`));
    await assert.rejects(
      service.authenticate(registered.sessionToken),
      (error) => errorCode(error) === 'SPLIT_AUTH_SESSION_EXPIRED',
    );
  }
});

test('invalid CSRF token is rejected', async () => {
  const { service } = harness();
  const registered = await service.register({
    email: 'person@example.com',
    displayName: 'Person',
    password: 'correct password',
  });
  const current = await service.authenticate(registered.sessionToken);
  assert.throws(
    () => service.verifyCsrf(current, 'wrong'),
    (error) => errorCode(error) === 'SPLIT_CSRF_INVALID',
  );
  assert.doesNotThrow(() => service.verifyCsrf(current, registered.csrfToken));
});

test('login rejects suspended and disabled accounts with the generic response', async () => {
  for (const status of ['suspended', 'disabled'] as const) {
    const { service, repository } = harness();
    await service.register({
      email: 'person@example.com',
      displayName: 'Person',
      password: 'correct password',
    });
    repository.users[0]!.accountStatus = status;
    await assert.rejects(
      service.login({ email: 'person@example.com', password: 'correct password' }),
      (error) => errorCode(error) === 'SPLIT_AUTH_INVALID_CREDENTIALS',
    );
  }
});

test('presented session is revoked before session rotation', async () => {
  const { service, repository } = harness();
  const registered = await service.register({
    email: 'person@example.com',
    displayName: 'Person',
    password: 'correct password',
  });
  await service.revokePresentedSession(registered.sessionToken);
  assert.ok(repository.sessions[0]?.revokedAt);
});

test('production cookie uses the Split-specific secure host cookie', () => {
  const value = sessionCookie('token', new Date('2026-11-01T00:00:00Z'), true);
  assert.match(value, /^__Host-nexus_split_session=/);
  assert.match(value, /; Path=\//);
  assert.match(value, /; HttpOnly/);
  assert.match(value, /; SameSite=Lax/);
  assert.match(value, /; Secure/);
  assert.doesNotMatch(value, /Domain=/i);
  assert.match(clearSessionCookie(true), /Max-Age=0/);
});

test('unsafe Split requests require an expected Origin', () => {
  const allowed = new Set(['https://nexus.example']);
  assert.equal(isAllowedSplitOrigin('POST', undefined, allowed), false);
  assert.equal(isAllowedSplitOrigin('POST', 'https://evil.example', allowed), false);
  assert.equal(isAllowedSplitOrigin('POST', 'https://nexus.example', allowed), true);
  assert.equal(isAllowedSplitOrigin('GET', undefined, allowed), true);
});

test('Argon2id hashes do not contain the password and verify correctly', async () => {
  const hasher = new Argon2SplitPasswordHasher();
  const password = 'correct horse battery staple';
  const hash = await hasher.hash(password);
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(hash.includes(password), false);
  assert.equal(await hasher.verify(hash, password), true);
  assert.equal(await hasher.verify(hash, 'different password'), false);
});

test('active sessions are rejected after an account is suspended or disabled', async () => {
  for (const status of ['suspended', 'disabled'] as const) {
    const { service, repository } = harness();
    const registered = await service.register({
      email: 'person@example.com',
      displayName: 'Person',
      password: 'correct password',
    });
    repository.users[0]!.accountStatus = status;
    await assert.rejects(
      service.authenticate(registered.sessionToken),
      (error) => errorCode(error) === 'SPLIT_AUTH_ACCOUNT_UNAVAILABLE',
    );
  }
});
