import { Controller, Get } from '@nestjs/common';

const APP_VERSION = 'v2.5.7';

@Controller('api/health')
export class HealthController {
  @Get()
  async check(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('version')
  async getVersion(): Promise<{ version: string; timestamp: string }> {
    return {
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    };
  }
}

export default HealthController;
