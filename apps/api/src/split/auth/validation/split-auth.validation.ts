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

export function normalizeSplitEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateSplitRegister(value: unknown) {
  const body = objectBody(value);
  const fields: Record<string, string[]> = {};
  if (Object.keys(body).some((key) => !['email', 'displayName', 'password'].includes(key))) {
    fields.request = ['Unexpected field.'];
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const normalizedEmail = normalizeSplitEmail(email);
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (normalizedEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
    fields.email = ['Enter a valid email address.'];
  if (displayName.length < 1 || displayName.length > 100)
    fields.displayName = ['Display name must be between 1 and 100 characters.'];
  if (password.length < 12 || password.length > 128)
    fields.password = ['Password must be between 12 and 128 characters.'];
  if (Object.keys(fields).length) validation(fields);
  return { email, normalizedEmail, displayName, password };
}

export function validateSplitLogin(value: unknown) {
  const body = objectBody(value);
  const fields: Record<string, string[]> = {};
  if (Object.keys(body).some((key) => !['email', 'password'].includes(key)))
    fields.request = ['Unexpected field.'];
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const normalizedEmail = normalizeSplitEmail(email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!normalizedEmail || normalizedEmail.length > 320) fields.email = ['Email is required.'];
  if (!password || password.length > 128) fields.password = ['Password is required.'];
  if (Object.keys(fields).length) validation(fields);
  return { normalizedEmail, password };
}
