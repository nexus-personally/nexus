import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ResumesService } from '../resumes/resumes.service.js';
import { requireUuid, validatePublicationSlug, validatePublicSlug } from '../security/validation.js';

@Controller()
export class PublicationController {
  constructor(@Inject(ResumesService) private readonly resumes: ResumesService) {}

  @Get('resumes/:id/publication')
  getPublicationState(@Param('id') id: string) {
    return this.resumes.getPublicationState(requireUuid(id));
  }

  @Post('resumes/:id/publication/publish')
  publish(@Param('id') id: string, @Body() body: { slug?: string }) {
    return this.resumes.publish(requireUuid(id), validatePublicationSlug(body?.slug));
  }

  @Post('resumes/:id/publication/unpublish')
  unpublish(@Param('id') id: string) {
    return this.resumes.unpublish(requireUuid(id));
  }

  @Get('public/resumes/:slug')
  resolvePublic(@Param('slug') slug: string) {
    return this.resumes.resolvePublic(validatePublicSlug(slug));
  }
}
