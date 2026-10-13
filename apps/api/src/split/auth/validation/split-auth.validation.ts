import { UnprocessableEntityException } from '@nestjs/common';

function validation(fields: Record<string, string[]>): never {
  throw new UnprocessableEntityException({
    error: { code: 'VALIDATION_FAILED', message: 'Some fields are invalid.', details: { fields } },
  });
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    validation({ request: ['A JSON object is required.'] });
  return value as Record<string, unknown>;
}

export function normalizeSplitUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateSplitRegister(value: unknown) {
  const body = objectBody(value);
  const fields: Record<string, string[]> = {};
  if (Object.keys(body).some((key) => !['username', 'displayName', 'password'].includes(key))) {
    fields.request = ['Unexpected field.'];
  }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const normalizedUsername = normalizeSplitUsername(username);
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (normalizedUsername.length < 3 || normalizedUsername.length > 30 || !/^[a-z0-9_]+$/.test(normalizedUsername))
    fields.username = ['Username must be 3 to 30 characters using letters, numbers, or underscores.'];
  if (displayName.length < 1 || displayName.length > 100)
    fields.displayName = ['Display name must be between 1 and 100 characters.'];
  if (password.length < 5 || password.length > 128)
    fields.password = ['Password must be between 5 and 128 characters.'];
  if (Object.keys(fields).length) validation(fields);
  return { username, normalizedUsername, displayName, password };
}

export function validateSplitLogin(value: unknown) {
  const body = objectBody(value);
  const fields: Record<string, string[]> = {};
  if (Object.keys(body).some((key) => !['username', 'password'].includes(key)))
    fields.request = ['Unexpected field.'];
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const normalizedUsername = normalizeSplitUsername(username);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!normalizedUsername || normalizedUsername.length > 30 || !/^[a-z0-9_]+$/.test(normalizedUsername))
    fields.username = ['Enter a valid username.'];
  if (!password || password.length > 128) fields.password = ['Password is required.'];
  if (Object.keys(fields).length) validation(fields);
  return { normalizedUsername, password };
}
