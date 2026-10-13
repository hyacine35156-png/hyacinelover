import { Body, Controller, Logger, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type {
  ErrorReportRequest,
  ErrorReportResponse,
} from '@shared/api.interface';
import { Public } from '../auth/jwt.guard';
import { MonitorService } from './monitor.service';

@Controller('api/client-errors')
export class ClientErrorController {
  private readonly logger = new Logger(ClientErrorController.name);

  constructor(private readonly monitorService: MonitorService) {}

  @Post()
  @Public()
  async report(
    @Body() body: ErrorReportRequest | ErrorReportRequest[],
    @Req() req: Request,
  ): Promise<ErrorReportResponse> {
    const items = Array.isArray(body) ? body : [body];
    const userId = req.userContext?.userId;

    // 补充 userId
    const enriched = items.map((item) => ({
      ...item,
      userId: item.userId ?? userId,
    }));

    for (const item of enriched) {
      const msg = (item.message || '').substring(0, 200);
      const url = (item.url || '').substring(0, 100);
      this.logger.warn(
        `[FrontendError] type=${item.type} message=${msg} url=${url}`,
      );
    }

    // 持久化到数据库（异步，不阻塞响应）
    void this.monitorService.saveClientErrors(enriched);

    return { success: true };
  }
}

export default ClientErrorController;
