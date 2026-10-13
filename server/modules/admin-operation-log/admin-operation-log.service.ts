import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, desc, count, sql, and, gte, lt } from 'drizzle-orm';
import type { Request } from 'express';

import {
  adminOperationLog,
} from '@server/database/schema';
import type {
  AdminOperationLogItem,
  AdminOperationLogListRequest,
  AdminOperationLogListResponse,
} from '@shared/api.interface';

interface LogOperationParams {
  adminId: string;
  adminUsername: string;
  operationType: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  operationDetail?: string;
  req?: Request;
}

@Injectable()
export class AdminOperationLogService {
  private readonly logger = new Logger(AdminOperationLogService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listLogs(
    params: AdminOperationLogListRequest,
  ): Promise<AdminOperationLogListResponse> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (params.operationType) {
      conditions.push(eq(adminOperationLog.operationType, params.operationType));
    }

    if (params.adminId) {
      conditions.push(
        sql`(${adminOperationLog.adminId}).user_id = ${params.adminId}`,
      );
    }

    if (params.startDate) {
      const start = new Date(params.startDate);
      if (isNaN(start.getTime())) {
        throw new BadRequestException('startDate 格式无效');
      }
      conditions.push(gte(adminOperationLog.createdAt, start));
    }

    if (params.endDate) {
      const end = new Date(params.endDate);
      if (isNaN(end.getTime())) {
        throw new BadRequestException('endDate 格式无效');
      }
      conditions.push(lt(adminOperationLog.createdAt, end));
    }

    const whereClause = conditions.length > 0
      ? and(...conditions)
      : undefined;

    const query = whereClause
      ? this.db.select().from(adminOperationLog).where(whereClause)
      : this.db.select().from(adminOperationLog);

    const rows = await query
      .orderBy(desc(adminOperationLog.createdAt))
      .limit(pageSize)
      .offset(offset);

    const countQuery = whereClause
      ? this.db.select({ count: count() }).from(adminOperationLog).where(whereClause)
      : this.db.select({ count: count() }).from(adminOperationLog);

    const countResult = await countQuery;
    const total = Number(countResult[0]?.count ?? 0);

    const items: AdminOperationLogItem[] = rows.map((row) => ({
      id: row.id,
      adminId: row.adminId,
      adminUsername: row.adminUsername,
      operationType: row.operationType,
      targetType: row.targetType ?? undefined,
      targetId: row.targetId ?? undefined,
      targetName: row.targetName ?? undefined,
      operationDetail: row.operationDetail ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      userAgent: row.userAgent ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));

    return { items, total, page, pageSize };
  }

  async logOperation(params: LogOperationParams): Promise<void> {
    const {
      adminId,
      adminUsername,
      operationType,
      targetType,
      targetId,
      targetName,
      operationDetail,
      req,
    } = params;

    if (!adminId || !adminUsername || !operationType) {
      this.logger.warn(
        `日志参数不完整 adminId=${adminId} operationType=${operationType}`,
      );
      return;
    }

    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    if (req) {
      const xff = req.headers['x-forwarded-for'];
      if (typeof xff === 'string') {
        ipAddress = xff.split(',')[0]?.trim();
      }
      if (!ipAddress) {
        ipAddress = req.ip;
      }
      userAgent = req.headers['user-agent'];
    }

    try {
      await this.db.insert(adminOperationLog).values({
        adminId,
        adminUsername,
        operationType,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        targetName: targetName ?? null,
        operationDetail: operationDetail ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      });

      this.logger.log(
        `操作日志 admin=${adminUsername} type=${operationType} target=${targetType ?? ''}/${targetId ?? ''}`,
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `操作日志写入失败 admin=${adminUsername} type=${operationType} error=${errMsg}`,
      );
    }
  }
}
