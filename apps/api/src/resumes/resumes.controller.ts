import { Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import type { ResumeRecord, ResumeTemplateId } from '@nexus/shared';
import { ResumesService } from './resumes.service.js';
import { requireUuid, validateCreateResume, validateResumePatch, validateResumeName } from '../security/validation.js';

@Controller('resumes')
export class ResumesController {
  constructor(@Inject(ResumesService) private readonly resumes: ResumesService) {}

  @Get()
  list(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.resumes.list(Math.min(100, Math.max(1, limit ?? 100)));
  }

  @Post()
  create(@Body() body: unknown) {
    return this.resumes.create(validateCreateResume(body) as { name?: string; templateId?: ResumeTemplateId });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.resumes.get(requireUuid(id));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<ResumeRecord>) {
    return this.resumes.update(requireUuid(id), validateResumePatch(id, body));
  }

  @Patch(':id/name')
  rename(@Param('id') id: string, @Body() body: { name?: string }) {
    requireUuid(id);
    return this.resumes.rename(id, validateResumeName(body?.name));
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.resumes.duplicate(requireUuid(id));
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.resumes.delete(requireUuid(id));
  }
}
