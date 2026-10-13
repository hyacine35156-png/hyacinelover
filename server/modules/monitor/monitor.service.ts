import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import type {
  ErrorReportRequest,
  WebVitalsReportRequest,
  ApiPerfRecord,
} from '@shared/api.interface';
import { clientErrorLog, clientPerfLog, clientApiPerf } from '../../database/schema';
import { AdminFeedbackService } from '../admin-feedback/admin-feedback.service';

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly feedbackService: AdminFeedbackService,
  ) {}

  /**
   * 保存单条或批量客户端错误日志
   */
  async saveClientErrors(
    reports: ErrorReportRequest | ErrorReportRequest[],
  ): Promise<number> {
    const items = Array.isArray(reports) ? reports : [reports];
    if (items.length === 0) return 0;

    const values = items.map((item) => ({
      errorType: item.type,
      message: item.message,
      stack: item.stack ?? null,
      pageUrl: item.url,
      userAgent: item.userAgent?.substring(0, 500) ?? null,
      userId: item.userId ?? null,
      appVersion: item.appVersion?.substring(0, 50) ?? null,
      environment: item.environment?.substring(0, 20) ?? null,
      userFeedback: item.userFeedback ?? null,
      feedbackCategory:
        (item as { feedbackCategory?: string }).feedbackCategory?.substring(0, 20) ??
        (item.userFeedback ? 'feedback_general' : null),
    }));

    try {
      await this.db.insert(clientErrorLog).values(values);

      const feedbackItems = items.filter((item) => item.userFeedback?.trim());
      if (feedbackItems.length > 0) {
        for (const item of feedbackItems) {
          this.feedbackService
            .notifyAdminsOfNewFeedback(
              item.type,
              item.userFeedback!,
              item.userId || '匿名用户',
              'general',
              item.appVersion,
            )
            .catch((notifyError) => {
              this.logger.error(
                `反馈通知发送失败: ${notifyError instanceof Error ? notifyError.message : String(notifyError)}`,
              );
            });
        }
      }

      return items.length;
    } catch (err) {
      this.logger.error(
        `保存客户端错误日志失败: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 0;
    }
  }

  /**
   * 保存 Web Vitals 性能数据
   */
  async saveWebVitals(data: WebVitalsReportRequest): Promise<boolean> {
    try {
      await this.db.insert(clientPerfLog).values({
        pageUrl: data.url.substring(0, 500),
        lcp: data.lcp !== undefined ? String(data.lcp) : null,
        fid: data.fid !== undefined ? String(data.fid) : null,
        cls: data.cls !== undefined ? String(data.cls) : null,
        ttfb: data.ttfb !== undefined ? String(data.ttfb) : null,
        domContentLoaded: data.domContentLoaded !== undefined ? String(data.domContentLoaded) : null,
        loadComplete: data.loadComplete !== undefined ? String(data.loadComplete) : null,
        userAgent: data.userAgent?.substring(0, 500) ?? null,
        userId: data.userId ?? null,
        appVersion: data.appVersion?.substring(0, 50),
      });
      return true;
    } catch (err) {
      this.logger.error(
        `保存 Web Vitals 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /**
   * 保存 API 性能数据（批量）
   */
  async saveApiPerf(records: ApiPerfRecord[]): Promise<number> {
    if (!records || records.length === 0) return 0;

    const values = records.map((r) => ({
      apiPath: r.url.substring(0, 500),
      method: r.method.substring(0, 10),
      durationMs: Math.round(r.duration),
      statusCode: r.status,
      userId: r.userId ?? undefined,
    }));

    try {
      await this.db.insert(clientApiPerf).values(values);
      return records.length;
    } catch (err) {
      this.logger.error(
        `保存 API 性能数据失败: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 0;
    }
  }
}

export default MonitorService;
