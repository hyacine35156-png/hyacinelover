import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  eq,
  desc,
  count,
  and,
  gte,
  lt,
  inArray,
  ilike,
  sql,
} from 'drizzle-orm';
import type { Request } from 'express';

import { systemLog } from '@server/database/schema';
import type {
  SystemLogItem,
  SystemLogListRequest,
  SystemLogListResponse,
  SystemLogStatsResponse,
  SystemLogType,
} from '@shared/api.interface';

export interface CreateSystemLogParams {
  logType: SystemLogType;
  action: string;
  userId?: string;
  username?: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  detail?: string;
  status?: 'success' | 'failed';
  errorMessage?: string;
  req?: Request;
  deviceInfo?: Record<string, unknown>;
}

function parseUserAgent(ua: string): { browser?: string; os?: string } {
  if (!ua) return {};
  const result: { browser?: string; os?: string } = {};
  if (ua.includes('Edg/')) result.browser = 'Edge';
  else if (ua.includes('Chrome/')) result.browser = 'Chrome';
  else if (ua.includes('Firefox/')) result.browser = 'Firefox';
  else if (ua.includes('Safari/')) result.browser = 'Safari';

  if (ua.includes('Windows NT')) result.os = 'Windows';
  else if (ua.includes('Mac OS X')) result.os = 'macOS';
  else if (ua.includes('Linux')) result.os = 'Linux';
  else if (ua.includes('Android')) result.os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) result.os = 'iOS';
  return result;
}

function extractIp(req: Request | undefined): string | undefined {
  if (!req) return undefined;
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip;
}

@Injectable()
export class SystemLogService {
  private readonly logger = new Logger(SystemLogService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async createLog(params: CreateSystemLogParams): Promise<void> {
    try {
      const userAgent = params.req?.headers['user-agent'];
      const uaInfo = parseUserAgent(userAgent ?? '');
      const deviceInfo = {
        ...uaInfo,
        ...(params.deviceInfo ?? {}),
      };
      await this.db.insert(systemLog).values({
        logType: params.logType,
        action: params.action,
        userId: params.userId,
        username: params.username,
        targetType: params.targetType,
        targetId: params.targetId,
        targetName: params.targetName,
        ipAddress: extractIp(params.req),
        userAgent: userAgent,
        deviceInfo: deviceInfo,
        detail: params.detail,
        status: params.status ?? 'success',
        errorMessage: params.errorMessage,
      });
    } catch (err) {
      this.logger.error(`写入系统日志失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async logAsync(params: CreateSystemLogParams): Promise<void> {
    setImmediate(() => {
      void this.createLog(params);
    });
  }

  async listLogs(
    params: SystemLogListRequest,
  ): Promise<SystemLogListResponse> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50));
    const offset = (page - 1) * pageSize;

    const conditions = this.buildConditions(params);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const baseQuery = whereClause
      ? this.db.select().from(systemLog).where(whereClause)
      : this.db.select().from(systemLog);

    const [items, totalResult] = await Promise.all([
      baseQuery
        .orderBy(desc(systemLog.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(systemLog)
        .where(whereClause),
    ]);

    const total = Number(totalResult[0]?.value ?? 0);

    return {
      items: items.map((row) => this.toItem(row)),
      total,
      page,
      pageSize,
    };
  }

  async getStats(): Promise<SystemLogStatsResponse> {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    const [todayTotalResult, todayLoginResult, todayAnomalyResult] =
      await Promise.all([
        this.db
          .select({ value: count() })
          .from(systemLog)
          .where(
            and(
              gte(systemLog.createdAt, todayStart),
              lt(systemLog.createdAt, todayEnd),
            ),
          ),
        this.db
          .select({ value: count() })
          .from(systemLog)
          .where(
            and(
              eq(systemLog.logType, 'login' as SystemLogType),
              gte(systemLog.createdAt, todayStart),
              lt(systemLog.createdAt, todayEnd),
            ),
          ),
        this.db
          .select({ value: count() })
          .from(systemLog)
          .where(
            and(
              eq(systemLog.logType, 'anomaly' as SystemLogType),
              gte(systemLog.createdAt, todayStart),
              lt(systemLog.createdAt, todayEnd),
            ),
          ),
      ]);

    const last7DaysResult = await this.db
      .select({
        date: sql<string>`to_char(${systemLog.createdAt}, 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(systemLog)
      .where(
        and(
          gte(systemLog.createdAt, sevenDaysAgo),
          lt(systemLog.createdAt, todayEnd),
        ),
      )
      .groupBy(sql`to_char(${systemLog.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${systemLog.createdAt}, 'YYYY-MM-DD')`);

    const dateMap = new Map<string, number>();
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(
        sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000,
      );
      const key = d.toISOString().slice(0, 10);
      dateMap.set(key, 0);
    }
    for (const row of last7DaysResult) {
      const key = typeof row.date === 'string' ? row.date : String(row.date);
      dateMap.set(key, Number(row.count));
    }
    const last7Days = Array.from(dateMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    return {
      todayTotal: Number(todayTotalResult[0]?.value ?? 0),
      todayLogin: Number(todayLoginResult[0]?.value ?? 0),
      todayAnomaly: Number(todayAnomalyResult[0]?.value ?? 0),
      last7Days,
    };
  }

  async exportLogs(
    params: SystemLogListRequest & { ids?: string[] },
    limit = 10000,
  ): Promise<SystemLogItem[]> {
    const conditions = this.buildConditions(params);
    if (params.ids && params.ids.length > 0) {
      conditions.push(inArray(systemLog.id, params.ids));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(systemLog)
      .where(whereClause)
      .orderBy(desc(systemLog.createdAt))
      .limit(limit);

    return rows.map((row) => this.toItem(row));
  }

  async getLogCount(
    params: SystemLogListRequest & { ids?: string[] },
  ): Promise<number> {
    const conditions = this.buildConditions(params);
    if (params.ids && params.ids.length > 0) {
      conditions.push(inArray(systemLog.id, params.ids));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const result = await this.db
      .select({ value: count() })
      .from(systemLog)
      .where(whereClause);
    return Number(result[0]?.value ?? 0);
  }

  private buildConditions(params: SystemLogListRequest) {
    const conditions = [];

    if (params.logType) {
      conditions.push(eq(systemLog.logType, params.logType));
    }
    if (params.logTypes && params.logTypes.length > 0) {
      conditions.push(inArray(systemLog.logType, params.logTypes));
    }
    if (params.username) {
      conditions.push(ilike(systemLog.username, `%${params.username}%`));
    }
    if (params.status) {
      conditions.push(eq(systemLog.status, params.status));
    }
    if (params.startDate) {
      const start = new Date(params.startDate);
      if (!isNaN(start.getTime())) {
        conditions.push(gte(systemLog.createdAt, start));
      }
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
      if (!isNaN(end.getTime())) {
        conditions.push(lt(systemLog.createdAt, end));
      }
    }
    if (params.keyword) {
      const kw = `%${params.keyword}%`;
      conditions.push(
        sql`(${systemLog.action} ILIKE ${kw} OR ${systemLog.targetName} ILIKE ${kw} OR ${systemLog.detail} ILIKE ${kw})`,
      );
    }

    return conditions;
  }

  private toItem(row: typeof systemLog.$inferSelect): SystemLogItem {
    return {
      id: row.id,
      logType: row.logType as SystemLogType,
      action: row.action,
      userId: row.userId ?? undefined,
      username: row.username ?? undefined,
      targetType: row.targetType ?? undefined,
      targetId: row.targetId ?? undefined,
      targetName: row.targetName ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      userAgent: row.userAgent ?? undefined,
      deviceInfo: row.deviceInfo as Record<string, unknown> | undefined,
      detail: row.detail ?? undefined,
      status: row.status as 'success' | 'failed',
      errorMessage: row.errorMessage ?? undefined,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
    };
  }
}
