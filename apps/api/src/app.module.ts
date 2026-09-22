import { Module } from '@nestjs/common';
import './database/env.js';
import { HealthController } from './health/health.controller.js';
import { PublicationController } from './publication/publication.controller.js';
import { ResumesController } from './resumes/resumes.controller.js';
import { ResumesService } from './resumes/resumes.service.js';
import { TemplatesController } from './templates/templates.controller.js';
import { InMemoryResumeRepository } from './persistence/in-memory-resume.repository.js';
import { PostgresResumeRepository } from './persistence/postgres-resume.repository.js';
import { RESUME_REPOSITORY } from './persistence/resume.repository.js';

const persistenceRepository =
  (process.env.PERSISTENCE ?? 'in-memory').toLowerCase() === 'postgres'
    ? PostgresResumeRepository
    : InMemoryResumeRepository;

@Module({
  controllers: [HealthController, PublicationController, ResumesController, TemplatesController],
  providers: [
    ResumesService,
    {
      provide: RESUME_REPOSITORY,
      useClass: persistenceRepository,
    },
  ],
})
export class AppModule {}
