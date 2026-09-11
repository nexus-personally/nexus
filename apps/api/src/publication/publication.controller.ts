import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ResumesService } from '../resumes/resumes.service.js';

@Controller()
export class PublicationController {
  constructor(private readonly resumes: ResumesService) {}

  @Get('resumes/:id/publication')
  getPublicationState(@Param('id') id: string) {
    return this.resumes.getPublicationState(id);
  }

  @Post('resumes/:id/publication/publish')
  publish(@Param('id') id: string, @Body() body: { slug?: string }) {
    return this.resumes.publish(id, body?.slug ?? '');
  }

  @Post('resumes/:id/publication/unpublish')
  unpublish(@Param('id') id: string) {
    return this.resumes.unpublish(id);
  }

  @Get('public/resumes/:slug')
  resolvePublic(@Param('slug') slug: string) {
    return this.resumes.resolvePublic(slug);
  }
}
