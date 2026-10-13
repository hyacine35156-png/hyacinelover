import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, asc, ilike, count, sql } from 'drizzle-orm';
import * as nodemailer from 'nodemailer';

import {
  questionFeedback,
  clientErrorLog,
  appUser,
} from '@server/database/schema';
import type {
  AdminFeedbackItem,
  AdminFeedbackListRequest,
  AdminFeedbackListResponse,
  AdminFeedbackStatsResponse,
  FeedbackSource,
  FeedbackStatus,
  MyFeedbackItem,
  MyFeedbackListResponse,
} from '@shared/api.interface';

const VALID_STATUSES: FeedbackStatus[] = [
  'unread', 'read', 'processing', 'resolved', 'closed',
];

interface UnifiedFeedbackRow {
  id: string;
  source: FeedbackSource;
  feedbackType: string;
  content: string;
  username: string | null;
  userId: string | null;
  questionId: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  appVersion: string | null;
  errorStack: string | null;
  status: string;
  adminReply: string | null;
  handledAt: Date | null;
  handledBy: string | null;
  createdAt: Date;
}

@Injectable()
export class AdminFeedbackService {
  private readonly logger = new Logger(AdminFeedbackService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getStats(): Promise<AdminFeedbackStatsResponse> {
    const qfCounts = await this.db
      .select({
        status: questionFeedback.status,
        cnt: sql<number>`count(*)::bigint`,
      })
      .from(questionFeedback)
      .groupBy(questionFeedback.status);

    const ceCounts = await this.db
      .select({
        status: clientErrorLog.status,
        cnt: sql<number>`count(*)::bigint`,
      })
      .from(clientErrorLog)
      .where(sql`${clientErrorLog.userFeedback} IS NOT NULL AND ${clientErrorLog.userFeedback} <> ''`)
      .groupBy(clientErrorLog.status);

    const allCounts = [...qfCounts, ...ceCounts];
    let total = 0;
    let unread = 0;
    let processing = 0;
    let resolved = 0;

    for (const row of allCounts) {
      const c = Number(row.cnt ?? 0);
      total += c;
      if (row.status === 'unread') unread += c;
      else if (row.status === 'processing') processing += c;
      else if (row.status === 'resolved') resolved += c;
    }

    return { total, unread, processing, resolved };
  }

  async listFeedbacks(
    params: AdminFeedbackListRequest,
  ): Promise<AdminFeedbackListResponse> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const rows: UnifiedFeedbackRow[] = await this.fetchUnifiedRows({
      source: params.source,
      status: params.status,
      keyword: params.keyword,
      sort: params.sort ?? 'newest',
      limit: pageSize,
      offset,
    });

    const total = await this.countUnifiedRows({
      source: params.source,
      status: params.status,
      keyword: params.keyword,
    });

    const items: AdminFeedbackItem[] = await this.enrichWithUsernames(rows);

    return { items, total, page, pageSize };
  }

  async getFeedbackDetail(id: string): Promise<AdminFeedbackItem> {
    const row = await this.findOneById(id);
    if (!row) {
      throw new NotFoundException('反馈不存在');
    }
    const [item] = await this.enrichWithUsernames([row]);
    return item;
  }

  async updateStatus(
    id: string,
    status: FeedbackStatus,
    adminReply: string | undefined,
    adminUserId: string,
    adminUsername: string,
  ): Promise<{ success: boolean }> {
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestException('无效的状态值');
    }

    const row = await this.findOneById(id);
    if (!row) {
      throw new NotFoundException('反馈不存在');
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      status,
    };
    if (adminReply !== undefined) {
      updateData.adminReply = adminReply;
    }
    if (status !== 'unread') {
      updateData.handledAt = now;
      updateData.handledBy = adminUserId;
    }

    if (row.source === 'question') {
      await this.db
        .update(questionFeedback)
        .set(updateData)
        .where(eq(questionFeedback.id, id));
    } else {
      await this.db
        .update(clientErrorLog)
        .set(updateData)
        .where(eq(clientErrorLog.id, id));
    }

    this.logger.log(
      `反馈状态更新 id=${id} status=${status} admin=${adminUsername}`,
    );
    return { success: true };
  }

  async listMyFeedbacks(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<MyFeedbackListResponse> {
    const offset = (page - 1) * pageSize;
    const limit = Math.min(50, Math.max(1, pageSize));

    const qfRows = await this.db
      .select({
        id: questionFeedback.id,
        feedbackType: questionFeedback.feedbackType,
        content: questionFeedback.description,
        status: questionFeedback.status,
        adminReply: questionFeedback.adminReply,
        handledAt: questionFeedback.handledAt,
        createdAt: questionFeedback.createdAt,
      })
      .from(questionFeedback)
      .where(eq(questionFeedback.appUserId, userId))
      .orderBy(desc(questionFeedback.createdAt))
      .limit(limit)
      .offset(offset);

    const qfCount = await this.db
      .select({ count: count() })
      .from(questionFeedback)
      .where(eq(questionFeedback.appUserId, userId));

    const ceRows = await this.db
      .select({
        id: clientErrorLog.id,
        feedbackType: clientErrorLog.errorType,
        content: clientErrorLog.userFeedback,
        status: clientErrorLog.status,
        adminReply: clientErrorLog.adminReply,
        handledAt: clientErrorLog.handledAt,
        createdAt: clientErrorLog.createdAt,
      })
      .from(clientErrorLog)
      .where(and(
        eq(clientErrorLog.userId, sql`${userId}::uuid`),
        sql`${clientErrorLog.userFeedback} IS NOT NULL`,
        sql`${clientErrorLog.userFeedback} <> ''`,
      ))
      .orderBy(desc(clientErrorLog.createdAt))
      .limit(limit)
      .offset(offset);

    const ceCount = await this.db
      .select({ count: count() })
      .from(clientErrorLog)
      .where(and(
        eq(clientErrorLog.userId, sql`${userId}::uuid`),
        sql`${clientErrorLog.userFeedback} IS NOT NULL`,
        sql`${clientErrorLog.userFeedback} <> ''`,
      ));

    const merged: Array<{
      id: string;
      source: FeedbackSource;
      feedbackType: string;
      content: string;
      status: string;
      adminReply: string | null;
      handledAt: Date | null;
      createdAt: Date;
    }> = [
      ...qfRows.map((row) => ({
        id: row.id,
        source: 'question' as FeedbackSource,
        feedbackType: row.feedbackType,
        content: row.content,
        status: row.status,
        adminReply: row.adminReply ?? null,
        handledAt: row.handledAt ?? null,
        createdAt: row.createdAt,
      })),
      ...ceRows.map((row) => ({
        id: row.id,
        source: 'general' as FeedbackSource,
        feedbackType: row.feedbackType,
        content: row.content ?? '',
        status: row.status,
        adminReply: row.adminReply ?? null,
        handledAt: row.handledAt ?? null,
        createdAt: row.createdAt,
      })),
    ];

    merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const items: MyFeedbackItem[] = merged.slice(0, limit).map((row) => ({
      id: row.id,
      source: row.source,
      feedbackType: row.feedbackType,
      content: row.content,
      status: row.status as FeedbackStatus,
      adminReply: row.adminReply ?? undefined,
      handledAt: row.handledAt ? row.handledAt.toISOString() : undefined,
      createdAt: row.createdAt.toISOString(),
    }));

    const total = Number(qfCount[0]?.count ?? 0) + Number(ceCount[0]?.count ?? 0);
    return { items, total, page, pageSize: limit };
  }

  async notifyAdminsOfNewFeedback(
    feedbackType: string,
    content: string,
    submitterUsername: string,
    source: FeedbackSource,
    appVersion?: string,
  ): Promise<void> {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'Hyacine Feedback';

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      this.logger.log('[邮件通知] SMTP 未配置，跳过邮件发送');
      return;
    }

    try {
      const adminRows = await this.db
        .select({ username: appUser.username })
        .from(appUser)
        .where(eq(appUser.role, 'admin'));

      if (adminRows.length === 0) {
        this.logger.log('[邮件通知] 无管理员账号，跳过邮件发送');
        return;
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: parseInt(smtpPort, 10) === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const subject = `[Hyacine 新反馈] ${feedbackType} - ${submitterUsername}`;
      const text = [
        `反馈类型：${feedbackType}`,
        `来源：${source === 'question' ? '题目纠错' : '通用意见'}`,
        `提交用户：${submitterUsername}`,
        `提交时间：${new Date().toLocaleString('zh-CN')}`,
        appVersion ? `应用版本：${appVersion}` : '',
        '',
        '反馈内容：',
        content,
        '',
        '请登录后台查看详情并处理。',
      ].filter(Boolean).join('\n');

      for (const admin of adminRows) {
        try {
          await transporter.sendMail({
            from: `"${smtpFrom}" <${smtpUser}>`,
            to: smtpUser,
            subject,
            text,
          });
        } catch (mailError) {
          const errMsg = mailError instanceof Error ? mailError.message : String(mailError);
          this.logger.error(`[邮件通知] 发送失败 admin=${admin.username} error=${errMsg}`);
        }
      }

      this.logger.log(`[邮件通知] 新反馈通知已发送 adminCount=${adminRows.length}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[邮件通知] 发送异常 error=${errMsg}`);
    }
  }

  private async findOneById(id: string): Promise<UnifiedFeedbackRow | null> {
    const qfRows = await this.db
      .select({
        id: questionFeedback.id,
        feedbackType: questionFeedback.feedbackType,
        content: questionFeedback.description,
        userId: questionFeedback.appUserId,
        questionId: questionFeedback.questionId,
        status: questionFeedback.status,
        adminReply: questionFeedback.adminReply,
        handledAt: questionFeedback.handledAt,
        handledBy: questionFeedback.handledBy,
        createdAt: questionFeedback.createdAt,
      })
      .from(questionFeedback)
      .where(eq(questionFeedback.id, id));

    if (qfRows.length > 0) {
      const row = qfRows[0];
      return {
        id: row.id,
        source: 'question',
        feedbackType: row.feedbackType,
        content: row.content,
        username: null,
        userId: row.userId ?? null,
        questionId: row.questionId,
        pageUrl: null,
        userAgent: null,
        appVersion: null,
        errorStack: null,
        status: row.status,
        adminReply: row.adminReply ?? null,
        handledAt: row.handledAt ?? null,
        handledBy: row.handledBy ?? null,
        createdAt: row.createdAt,
      };
    }

    const ceRows = await this.db
      .select({
        id: clientErrorLog.id,
        errorType: clientErrorLog.errorType,
        userFeedback: clientErrorLog.userFeedback,
        message: clientErrorLog.message,
        pageUrl: clientErrorLog.pageUrl,
        userAgent: clientErrorLog.userAgent,
        appVersion: clientErrorLog.appVersion,
        stack: clientErrorLog.stack,
        status: clientErrorLog.status,
        adminReply: clientErrorLog.adminReply,
        handledAt: clientErrorLog.handledAt,
        handledBy: clientErrorLog.handledBy,
        createdAt: clientErrorLog.createdAt,
      })
      .from(clientErrorLog)
      .where(eq(clientErrorLog.id, id));

    if (ceRows.length > 0) {
      const row = ceRows[0];
      return {
        id: row.id,
        source: 'general',
        feedbackType: row.errorType,
        content: row.userFeedback ?? row.message,
        username: null,
        userId: null,
        questionId: null,
        pageUrl: row.pageUrl,
        userAgent: row.userAgent ?? null,
        appVersion: row.appVersion ?? null,
        errorStack: row.stack ?? null,
        status: row.status,
        adminReply: row.adminReply ?? null,
        handledAt: row.handledAt ?? null,
        handledBy: row.handledBy ?? null,
        createdAt: row.createdAt,
      };
    }

    return null;
  }

  private async fetchUnifiedRows(params: {
    source?: FeedbackSource;
    status?: FeedbackStatus;
    keyword?: string;
    sort: 'newest' | 'oldest';
    limit: number;
    offset: number;
  }): Promise<UnifiedFeedbackRow[]> {
    const results: UnifiedFeedbackRow[] = [];

    if (!params.source || params.source === 'question') {
      const where = this.buildQuestionFeedbackWhere(params);
      const orderFn = params.sort === 'newest' ? desc : asc;
      const rows = await this.db
        .select({
          id: questionFeedback.id,
          feedbackType: questionFeedback.feedbackType,
          content: questionFeedback.description,
          userId: questionFeedback.appUserId,
          questionId: questionFeedback.questionId,
          status: questionFeedback.status,
          adminReply: questionFeedback.adminReply,
          handledAt: questionFeedback.handledAt,
          handledBy: questionFeedback.handledBy,
          createdAt: questionFeedback.createdAt,
        })
        .from(questionFeedback)
        .where(where)
        .orderBy(orderFn(questionFeedback.createdAt))
        .limit(params.limit + 1)
        .offset(params.offset);

      for (const row of rows) {
        results.push({
          id: row.id,
          source: 'question',
          feedbackType: row.feedbackType,
          content: row.content,
          username: null,
          userId: row.userId ?? null,
          questionId: row.questionId,
          pageUrl: null,
          userAgent: null,
          appVersion: null,
          errorStack: null,
          status: row.status,
          adminReply: row.adminReply ?? null,
          handledAt: row.handledAt ?? null,
          handledBy: row.handledBy ?? null,
          createdAt: row.createdAt,
        });
      }
    }

    if (!params.source || params.source === 'general') {
      const where = this.buildClientErrorWhere(params);
      const orderFn = params.sort === 'newest' ? desc : asc;
      const rows = await this.db
        .select({
          id: clientErrorLog.id,
          errorType: clientErrorLog.errorType,
          userFeedback: clientErrorLog.userFeedback,
          message: clientErrorLog.message,
          pageUrl: clientErrorLog.pageUrl,
          userAgent: clientErrorLog.userAgent,
          appVersion: clientErrorLog.appVersion,
          stack: clientErrorLog.stack,
          status: clientErrorLog.status,
          adminReply: clientErrorLog.adminReply,
          handledAt: clientErrorLog.handledAt,
          handledBy: clientErrorLog.handledBy,
          createdAt: clientErrorLog.createdAt,
        })
        .from(clientErrorLog)
        .where(where)
        .orderBy(orderFn(clientErrorLog.createdAt))
        .limit(params.limit + 1)
        .offset(params.offset);

      for (const row of rows) {
        results.push({
          id: row.id,
          source: 'general',
          feedbackType: row.errorType,
          content: row.userFeedback ?? row.message,
          username: null,
          userId: null,
          questionId: null,
          pageUrl: row.pageUrl,
          userAgent: row.userAgent ?? null,
          appVersion: row.appVersion ?? null,
          errorStack: row.stack ?? null,
          status: row.status,
          adminReply: row.adminReply ?? null,
          handledAt: row.handledAt ?? null,
          handledBy: row.handledBy ?? null,
          createdAt: row.createdAt,
        });
      }
    }

    results.sort((a, b) => {
      const diff = a.createdAt.getTime() - b.createdAt.getTime();
      return params.sort === 'newest' ? -diff : diff;
    });

    return results.slice(0, params.limit);
  }

  private buildQuestionFeedbackWhere(params: {
    status?: FeedbackStatus;
    keyword?: string;
  }) {
    const conditions = [];
    if (params.status) {
      conditions.push(eq(questionFeedback.status, params.status));
    }
    if (params.keyword) {
      conditions.push(ilike(questionFeedback.description, `%${params.keyword}%`));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private buildClientErrorWhere(params: {
    status?: FeedbackStatus;
    keyword?: string;
  }) {
    const conditions = [
      sql`${clientErrorLog.userFeedback} IS NOT NULL`,
      sql`${clientErrorLog.userFeedback} <> ''`,
    ];
    if (params.status) {
      conditions.push(eq(clientErrorLog.status, params.status));
    }
    if (params.keyword) {
      conditions.push(ilike(clientErrorLog.userFeedback, `%${params.keyword}%`));
    }
    return and(...conditions);
  }

  private async countUnifiedRows(params: {
    source?: FeedbackSource;
    status?: FeedbackStatus;
    keyword?: string;
  }): Promise<number> {
    let total = 0;

    if (!params.source || params.source === 'question') {
      const where = this.buildQuestionFeedbackWhere(params);
      const rows = await this.db
        .select({ count: count() })
        .from(questionFeedback)
        .where(where);
      total += Number(rows[0]?.count ?? 0);
    }

    if (!params.source || params.source === 'general') {
      const where = this.buildClientErrorWhere(params);
      const rows = await this.db
        .select({ count: count() })
        .from(clientErrorLog)
        .where(where);
      total += Number(rows[0]?.count ?? 0);
    }

    return total;
  }

  private async enrichWithUsernames(
    rows: UnifiedFeedbackRow[],
  ): Promise<AdminFeedbackItem[]> {
    const userIds = new Set<string>();
    for (const row of rows) {
      if (row.userId) userIds.add(row.userId);
      if (row.handledBy) userIds.add(row.handledBy);
    }

    const userMap = new Map<string, string>();
    if (userIds.size > 0) {
      const userRows = await this.db
        .select({ id: appUser.id, username: appUser.username })
        .from(appUser)
        .where(sql`${appUser.id} IN (${sql.join(Array.from(userIds).map((id) => sql`${id}`), sql`, `)})`);
      for (const u of userRows) {
        userMap.set(u.id, u.username);
      }
    }

    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      feedbackType: row.feedbackType,
      content: row.content,
      username: row.userId ? userMap.get(row.userId) ?? undefined : undefined,
      userId: row.userId ?? undefined,
      questionId: row.questionId ?? undefined,
      pageUrl: row.pageUrl ?? undefined,
      userAgent: row.userAgent ?? undefined,
      appVersion: row.appVersion ?? undefined,
      errorStack: row.errorStack ?? undefined,
      status: row.status as FeedbackStatus,
      adminReply: row.adminReply ?? undefined,
      handledAt: row.handledAt ? row.handledAt.toISOString() : undefined,
      handledByUsername: row.handledBy ? userMap.get(row.handledBy) ?? undefined : undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
