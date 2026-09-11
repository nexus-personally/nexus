import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'nexus-api',
      persistence: process.env.PERSISTENCE ?? 'in-memory',
      timestamp: new Date().toISOString(),
    };
  }
}
