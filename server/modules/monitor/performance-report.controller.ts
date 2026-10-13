import { Body, Controller, Logger, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type {
  PerformanceReportRequest,
  PerformanceReportResponse,
  PerformanceMetricItem,
} from '@shared/api.interface';

@Controller('api/performance-report')
export class PerformanceReportController {
  private readonly logger = new Logger(PerformanceReportController.name);

  @Post()
  async report(
    @Body() body: PerformanceReportRequest,
    @Req() req: Request,
  ): Promise<PerformanceReportResponse> {
    const userId = req.userContext?.userId ?? 'anonymous';
    const items = Array.isArray(body) ? body : [];
    if (items.length === 0) {
      return { success: true, received: 0 };
    }

    // 分组统计
    const byType: Record<string, PerformanceMetricItem[]> = {};
    for (const item of items) {
      const key = item.metricType || 'other';
      if (!byType[key]) byType[key] = [];
      byType[key].push(item);
    }

    for (const [type, list] of Object.entries(byType)) {
      this.logger.log(
        `[PerfReport] type=${type} count=${list.length} userId=${userId}`,
      );
      for (const item of list) {
        this.logger.verbose(
          JSON.stringify({
            name: item.name,
            value: item.value,
            path: item.path,
            timestamp: item.timestamp,
            metricType: item.metricType,
            extra: item.extra,
          }),
        );
      }
    }

    // 慢请求单独 warn
    const slowRequests = items.filter(
      (i) => i.metricType === 'api-request' && i.value > 3000,
    );
    for (const slow of slowRequests) {
      this.logger.warn(
        `[SlowRequest] ${slow.name} duration=${slow.value}ms path=${slow.path}`,
      );
    }

    return { success: true, received: items.length };
  }
}

export default PerformanceReportController;
