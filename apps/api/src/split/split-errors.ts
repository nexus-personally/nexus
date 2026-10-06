import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
export const splitNotFound = (code: string, message: string): never => {
  throw new NotFoundException({ error: { code, message } });
};
export const splitForbidden = (code: string, message: string): never => {
  throw new ForbiddenException({ error: { code, message } });
};
export const splitConflict = (code: string, message: string): never => {
  throw new ConflictException({ error: { code, message } });
};
export const splitInvalid = (fields: Record<string, string[]>): never => {
  throw new UnprocessableEntityException({
    error: { code: 'VALIDATION_FAILED', message: 'Some fields are invalid.', details: { fields } },
  });
};
export const splitDomainInvalid = (code: string, message: string, field?: string): never => {
  throw new UnprocessableEntityException({
    error: {
      code,
      message,
      ...(field ? { details: { fields: { [field]: [message] } } } : {}),
    },
  });
};
