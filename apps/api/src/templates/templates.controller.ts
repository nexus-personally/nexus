import { Controller, Get } from '@nestjs/common';
import { RESUME_TEMPLATES } from '@nexus/shared';

@Controller('templates')
export class TemplatesController {
  @Get()
  list() {
    return RESUME_TEMPLATES;
  }
}
