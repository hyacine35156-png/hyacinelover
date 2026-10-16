import { Body, Controller, Logger, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type {
  WebVitalsReportRequest,
  WebVitalsReportResponse,
  ApiPerfReportRequest,
  ApiPerfReportResponse,
} from '@shared/api.interface';
import { NeedAppLogin } from '../auth/jwt.guard';
import { MonitorService } from './monitor.service';

@Controller('api/client-perf')
export class ClientPerfController {
  private readonly logger = new Logger(ClientPerfController.name);
  private readonly MAX_ITEMS = 100;

  constructor(private readonly monitorService: MonitorService) {}

  /**
   * Web Vitals 性能数据上报（需登录）
   */
  @Post()
  @NeedAppLogin()
  async reportWebVitals(
    @Body() body: WebVitalsReportRequest,
    @Req() req: Request,
  ): Promise<WebVitalsReportResponse> {
    const userId = req.userContext?.userId;
    const data = {
      ...body,
      userId, // 强制使用登录用户的userId
    };

    this.logger.verbose(
      `[WebVitals] url=${data.url.substring(0, 100)} lcp=${data.lcp} cls=${data.cls} fid=${data.fid}`,
    );

    void this.monitorService.saveWebVitals(data);

    return { success: true };
  }

  /**
   * API 性能数据上报（批量，需登录）
   */
  @Post('api')
  @NeedAppLogin()
  async reportApiPerf(
    @Body() body: ApiPerfReportRequest,
    @Req() req: Request,
  ): Promise<ApiPerfReportResponse> {
    const items = Array.isArray(body) ? body.slice(0, this.MAX_ITEMS) : [];
    if (items.length === 0) {
      return { success: true, received: 0 };
    }

    const userId = req.userContext?.userId;
    const enriched = items.map((item) => ({
      ...item,
      userId, // 强制使用登录用户的userId
    }));

    // 慢请求单独 warn
    const slowRequests = enriched.filter((r) => r.duration > 3000);
    for (const slow of slowRequests) {
      this.logger.warn(
        `[SlowRequest] ${slow.method} ${slow.url} duration=${slow.duration}ms status=${slow.status}`,
      );
    }

    this.logger.verbose(
      `[ApiPerf] received=${enriched.length}`,
    );

    void this.monitorService.saveApiPerf(enriched);

    return { success: true, received: enriched.length };
  }
}

export default ClientPerfController;
