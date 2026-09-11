import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { ResumeRecord, ResumeTemplateId } from '@nexus/shared';
import { ResumesService } from './resumes.service.js';

@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumes: ResumesService) {}

  @Get()
  list() {
    return this.resumes.list();
  }

  @Post()
  create(@Body() body: { name?: string; templateId?: ResumeTemplateId }) {
    return this.resumes.create(body ?? {});
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.resumes.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<ResumeRecord>) {
    return this.resumes.update(id, body);
  }

  @Patch(':id/name')
  rename(@Param('id') id: string, @Body() body: { name?: string }) {
    return this.resumes.rename(id, body?.name ?? '');
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.resumes.duplicate(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.resumes.delete(id);
  }
}
