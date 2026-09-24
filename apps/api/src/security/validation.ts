import { BadRequestException } from '@nestjs/common';
import { RESUME_TEMPLATES, type ResumeRecord, type ResumeTemplateId } from '@nexus/shared';

const templateIds = new Set<string>(RESUME_TEMPLATES.map((template) => template.id));
const allowedDocumentKeys = new Set([
  'id', 'name', 'templateId', 'themeId', 'status', 'content', 'sectionOrder',
  'createdAt', 'updatedAt', 'lastSavedAt', 'colors', 'fieldColors', 'typography',
  'fieldTypography', 'richText',
]);

function invalid(message = 'Invalid request.'): never {
  throw new BadRequestException(message);
}

export function requireUuid(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) invalid();
  return id;
}

export function validateResumeName(name: unknown): string {
  if (typeof name !== 'string' || name.trim().length > 100) invalid('Name must be a string of at most 100 characters.');
  return name.trim() || 'Untitled Resume';
}

export function validateCreateResume(body: unknown): { name?: string; templateId?: ResumeTemplateId } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid();
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['name', 'templateId'].includes(key))) invalid();
  const result: { name?: string; templateId?: ResumeTemplateId } = {};
  if (input.name !== undefined) result.name = validateResumeName(input.name);
  if (input.templateId !== undefined) {
    if (typeof input.templateId !== 'string' || !templateIds.has(input.templateId)) invalid('Unknown resume template.');
    result.templateId = input.templateId as ResumeTemplateId;
  }
  return result;
}

function assertSafeTree(value: unknown, depth = 0): void {
  if (depth > 16) invalid('Resume content is too deeply nested.');
  if (typeof value === 'string') {
    if (value.length > 200_000) invalid('Resume text is too long.');
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 2_000) invalid('Resume content contains too many items.');
    for (const item of value) assertSafeTree(item, depth + 1);
    return;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length > 500) invalid('Resume content contains too many fields.');
    for (const [key, child] of entries) {
      if (/^on[a-z]+$/i.test(key) || key === '__proto__' || key === 'constructor' || key === 'prototype') invalid();
      assertSafeTree(child, depth + 1);
    }
  }
}

export function validateResumePatch(id: string, body: unknown): Partial<ResumeRecord> {
  requireUuid(id);
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid();
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !allowedDocumentKeys.has(key))) invalid('Unexpected resume field.');
  if (input.id !== undefined && input.id !== id) invalid('Resume ID cannot be changed.');
  if (input.name !== undefined) validateResumeName(input.name);
  if (input.templateId !== undefined && (typeof input.templateId !== 'string' || !templateIds.has(input.templateId))) invalid('Unknown resume template.');
  assertSafeTree(input);
  return input as Partial<ResumeRecord>;
}

export function validatePublicationSlug(value: unknown): string {
  if (typeof value !== 'string' || value.length > 80 || !/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/i.test(value)) invalid('Invalid publication slug.');
  return value;
}

export function validatePublicSlug(value: string): string {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/i.test(value)) {
    throw new BadRequestException('Invalid publication slug.');
  }
  return value;
}
