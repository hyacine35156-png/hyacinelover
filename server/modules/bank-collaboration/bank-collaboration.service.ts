import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, count, sql, inArray, max } from 'drizzle-orm';

import {
  questionBank,
  question,
  questionBankCollaborator,
  questionBankEditRequest,
  questionBankVersion,
  appUser,
} from '@server/database/schema';
import type {
  SubmitEditRequestResponse,
  ReviewEditRequestResponse,
  CollaboratorListResponse,
  RemoveCollaboratorResponse,
  BankVersionListResponse,
  BankVersionDetailResponse,
  RollbackVersionResponse,
  EditRequestListResponse,
  QuestionOption,
  SubQuestion,
  QuestionItemV2,
} from '@shared/api.interface';

const MAX_VERSIONS = 20;

interface VersionSnapshotQuestion {
  content: string;
  questionType: string;
  options: Array<{ label: string; text: string }>;
  correctAnswers: number[];
  analysis: string;
  subQuestions: Array<{ content: string; correctAnswer: string; analysis: string }>;
  knowledgePoints: string;
  unitName: string | null;
}

interface VersionSnapshot {
  questions: VersionSnapshotQuestion[];
}

@Injectable()
export class BankCollaborationService {
  private readonly logger = new Logger(BankCollaborationService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ========== 编辑申请 ==========

  async submitEditRequest(
    appUserId: string,
    userId: string,
    username: string,
    bankId: string,
    reason: string,
  ): Promise<SubmitEditRequestResponse> {
    if (!reason?.trim()) {
      throw new BadRequestException('申请理由不能为空');
    }

    // 检查题库是否存在且是公开的
    const bankRows = await this.db
      .select({
        id: questionBank.id,
        isPublic: questionBank.isPublic,
        ownerAppUserId: questionBank.appUserId,
      })
      .from(questionBank)
      .where(eq(questionBank.id, bankId));

    if (bankRows.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    const bank = bankRows[0];
    if (!bank.isPublic) {
      throw new BadRequestException('仅公开题集可申请编辑');
    }

    // 检查是否是所有者
    if (bank.ownerAppUserId === appUserId) {
      throw new BadRequestException('您已有编辑权限');
    }

    // 检查是否已经是协作者
    const collaboratorRows = await this.db
      .select({ id: questionBankCollaborator.id })
      .from(questionBankCollaborator)
      .where(and(
        eq(questionBankCollaborator.bankId, bankId),
        eq(questionBankCollaborator.appUserId, appUserId),
      ));
    if (collaboratorRows.length > 0) {
      throw new BadRequestException('您已有编辑权限');
    }

    // 检查是否已有 pending 状态的申请
    const pendingRows = await this.db
      .select({ id: questionBankEditRequest.id })
      .from(questionBankEditRequest)
      .where(and(
        eq(questionBankEditRequest.bankId, bankId),
        eq(questionBankEditRequest.appUserId, appUserId),
        eq(questionBankEditRequest.status, 'pending'),
      ));
    if (pendingRows.length > 0) {
      throw new BadRequestException('您已提交过申请，请等待审核');
    }

    // 提交申请
    const inserted = await this.db
      .insert(questionBankEditRequest)
      .values({
        bankId,
        userId,
        appUserId,
        reason: reason.trim(),
        status: 'pending',
      })
      .returning({ id: questionBankEditRequest.id, status: questionBankEditRequest.status });

    return {
      id: inserted[0].id,
      status: inserted[0].status,
    };
  }

  async getReceivedEditRequests(
    appUserId: string,
    role: string,
    page: number,
    pageSize: number,
    status: 'pending' | 'approved' | 'rejected' | 'all',
  ): Promise<EditRequestListResponse> {
    // 查询当前用户作为所有者的题库 + 所有公开题库（如果是 admin）下的申请
    const bankConditions: ReturnType<typeof and>[] = [];
    if (role === 'admin') {
      bankConditions.push(eq(questionBank.isPublic, true));
    } else {
      bankConditions.push(eq(questionBank.appUserId, appUserId));
    }

    const bankRows = await this.db
      .select({ id: questionBank.id })
      .from(questionBank)
      .where(and(...bankConditions));
    const bankIds = bankRows.map((b) => b.id);

    if (bankIds.length === 0) {
      return { items: [], total: 0 };
    }

    const conditions: ReturnType<typeof and>[] = [
      inArray(questionBankEditRequest.bankId, bankIds),
    ];
    if (status !== 'all') {
      conditions.push(eq(questionBankEditRequest.status, status));
    }

    const offset = (page - 1) * pageSize;

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(questionBankEditRequest)
        .where(and(...conditions)),
      this.db
        .select({
          id: questionBankEditRequest.id,
          bankId: questionBankEditRequest.bankId,
          bankName: questionBank.name,
          userId: questionBankEditRequest.userId,
          username: appUser.username,
          reason: questionBankEditRequest.reason,
          status: questionBankEditRequest.status,
          reviewerId: questionBankEditRequest.reviewerId,
          reviewedAt: questionBankEditRequest.reviewedAt,
          reviewNote: questionBankEditRequest.reviewNote,
          createdAt: questionBankEditRequest.createdAt,
        })
        .from(questionBankEditRequest)
        .leftJoin(questionBank, eq(questionBankEditRequest.bankId, questionBank.id))
        .leftJoin(appUser, eq(questionBankEditRequest.appUserId, appUser.id))
        .where(and(...conditions))
        .orderBy(desc(questionBankEditRequest.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    // 单独查询 reviewer 用户名
    const reviewerIds = rows
      .map((r) => r.reviewerId)
      .filter((id): id is string => !!id);
    const reviewerMap = new Map<string, string>();
    if (reviewerIds.length > 0) {
      const reviewerRows = await this.db
        .select({ id: appUser.id, username: appUser.username })
        .from(appUser)
        .where(inArray(appUser.id, reviewerIds));
      for (const r of reviewerRows) {
        reviewerMap.set(r.id, r.username);
      }
    }

    const total = Number(countResult[0]?.count ?? 0);

    return {
      items: rows.map((row) => ({
        id: row.id,
        bankId: row.bankId,
        bankName: row.bankName ?? '',
        userId: row.userId,
        username: row.username ?? '',
        reason: row.reason,
        status: row.status as 'pending' | 'approved' | 'rejected',
        reviewerId: row.reviewerId ?? undefined,
        reviewerUsername: row.reviewerId
          ? reviewerMap.get(row.reviewerId) ?? undefined
          : undefined,
        reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : undefined,
        reviewNote: row.reviewNote ?? undefined,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
    };
  }

  async reviewEditRequest(
    requestId: string,
    reviewerUserId: string,
    reviewerAppUserId: string,
    role: string,
    action: 'approve' | 'reject',
    reviewNote?: string,
  ): Promise<ReviewEditRequestResponse> {
    // 检查申请是否存在
    const requestRows = await this.db
      .select({
        id: questionBankEditRequest.id,
        bankId: questionBankEditRequest.bankId,
        status: questionBankEditRequest.status,
        userId: questionBankEditRequest.userId,
        appUserId: questionBankEditRequest.appUserId,
      })
      .from(questionBankEditRequest)
      .where(eq(questionBankEditRequest.id, requestId));

    if (requestRows.length === 0) {
      throw new NotFoundException('申请不存在');
    }
    const req = requestRows[0];
    if (req.status !== 'pending') {
      throw new BadRequestException('该申请已被审核');
    }

    // 权限检查：题库所有者或 admin
    const bankRows = await this.db
      .select({ appUserId: questionBank.appUserId })
      .from(questionBank)
      .where(eq(questionBank.id, req.bankId));
    if (bankRows.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    const isOwner = bankRows[0].appUserId === reviewerAppUserId;
    const isAdmin = role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('无审核权限');
    }

    const now = new Date();

    if (action === 'approve') {
      // 更新状态 + 添加协作者
      await this.db.transaction(async (tx) => {
        await tx
          .update(questionBankEditRequest)
          .set({
            status: 'approved',
            reviewerId: reviewerUserId,
            reviewedAt: now,
            reviewNote: reviewNote ?? null,
          })
          .where(eq(questionBankEditRequest.id, requestId));

        // 检查是否已有协作者记录（schema 限制 bankId unique，所以 upsert）
        const existing = await tx
          .select({ id: questionBankCollaborator.id })
          .from(questionBankCollaborator)
          .where(eq(questionBankCollaborator.bankId, req.bankId));

        if (existing.length > 0) {
          await tx
            .update(questionBankCollaborator)
            .set({
              userId: req.userId,
              appUserId: req.appUserId,
              permission: 'edit',
              joinedAt: now,
            })
            .where(eq(questionBankCollaborator.bankId, req.bankId));
        } else {
          await tx
            .insert(questionBankCollaborator)
            .values({
              bankId: req.bankId,
              userId: req.userId,
              appUserId: req.appUserId,
              permission: 'edit',
              joinedAt: now,
            });
        }
      });
    } else {
      // 拒绝
      await this.db
        .update(questionBankEditRequest)
        .set({
          status: 'rejected',
          reviewerId: reviewerUserId,
          reviewedAt: now,
          reviewNote: reviewNote ?? null,
        })
        .where(eq(questionBankEditRequest.id, requestId));
    }

    return { success: true };
  }

  // ========== 协作者 ==========

  async getCollaborators(
    bankId: string,
    appUserId: string,
    role: string,
  ): Promise<CollaboratorListResponse> {
    await this.ensureBankAccess(bankId, appUserId, role, 'ownerOrAdmin');

    const rows = await this.db
      .select({
        id: questionBankCollaborator.id,
        bankId: questionBankCollaborator.bankId,
        userId: questionBankCollaborator.userId,
        username: appUser.username,
        permission: questionBankCollaborator.permission,
        joinedAt: questionBankCollaborator.joinedAt,
      })
      .from(questionBankCollaborator)
      .leftJoin(appUser, eq(questionBankCollaborator.appUserId, appUser.id))
      .where(eq(questionBankCollaborator.bankId, bankId))
      .orderBy(desc(questionBankCollaborator.joinedAt));

    return {
      items: rows.map((row) => ({
        id: row.id,
        bankId: row.bankId,
        userId: row.userId,
        username: row.username ?? '',
        permission: row.permission,
        joinedAt: row.joinedAt.toISOString(),
      })),
    };
  }

  async removeCollaborator(
    bankId: string,
    collaboratorId: string,
    appUserId: string,
    role: string,
  ): Promise<RemoveCollaboratorResponse> {
    await this.ensureBankAccess(bankId, appUserId, role, 'ownerOrAdmin');

    const deleted = await this.db
      .delete(questionBankCollaborator)
      .where(and(
        eq(questionBankCollaborator.id, collaboratorId),
        eq(questionBankCollaborator.bankId, bankId),
      ))
      .returning({ id: questionBankCollaborator.id });

    if (deleted.length === 0) {
      throw new NotFoundException('协作者不存在');
    }

    return { success: true };
  }

  // ========== 版本历史 ==========

  async getVersionList(
    bankId: string,
    appUserId: string,
    role: string,
    page: number,
    pageSize: number,
  ): Promise<BankVersionListResponse> {
    await this.ensureBankAccess(bankId, appUserId, role, 'ownerCollaboratorOrAdmin');

    const offset = (page - 1) * pageSize;

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(questionBankVersion)
        .where(eq(questionBankVersion.bankId, bankId)),
      this.db
        .select({
          id: questionBankVersion.id,
          bankId: questionBankVersion.bankId,
          versionNumber: questionBankVersion.versionNumber,
          changeSummary: questionBankVersion.changeSummary,
          questionCount: questionBankVersion.questionCount,
          createdBy: questionBankVersion.createdBy,
          createdAt: questionBankVersion.createdAt,
          appUserId: questionBankVersion.appUserId,
        })
        .from(questionBankVersion)
        .leftJoin(appUser, eq(questionBankVersion.appUserId, appUser.id))
        .where(eq(questionBankVersion.bankId, bankId))
        .orderBy(desc(questionBankVersion.versionNumber))
        .limit(pageSize)
        .offset(offset),
    ]);

    const creatorAppUserIds = rows
      .map((r) => r.appUserId)
      .filter((id): id is string => !!id);
    const creatorMap = new Map<string, { id: string; username: string }>();
    if (creatorAppUserIds.length > 0) {
      const creatorRows = await this.db
        .select({ id: appUser.id, username: appUser.username })
        .from(appUser)
        .where(inArray(appUser.id, creatorAppUserIds));
      for (const r of creatorRows) {
        creatorMap.set(r.id, { id: r.id, username: r.username });
      }
    }

    const total = Number(countResult[0]?.count ?? 0);

    return {
      items: rows.map((row) => {
        const creator = row.appUserId ? creatorMap.get(row.appUserId) : undefined;
        return {
          id: row.id,
          bankId: row.bankId,
          versionNumber: row.versionNumber,
          changeSummary: row.changeSummary,
          questionCount: row.questionCount,
          createdByUserId: row.createdBy ?? undefined,
          createdByUsername: creator?.username ?? undefined,
          createdAt: row.createdAt.toISOString(),
        };
      }),
      total,
    };
  }

  async getVersionDetail(
    versionId: string,
    appUserId: string,
    role: string,
  ): Promise<BankVersionDetailResponse> {
    const versionRows = await this.db
      .select({
        id: questionBankVersion.id,
        bankId: questionBankVersion.bankId,
        versionNumber: questionBankVersion.versionNumber,
        changeSummary: questionBankVersion.changeSummary,
        questionCount: questionBankVersion.questionCount,
        snapshot: questionBankVersion.snapshot,
        createdAt: questionBankVersion.createdAt,
      })
      .from(questionBankVersion)
      .where(eq(questionBankVersion.id, versionId));

    if (versionRows.length === 0) {
      throw new NotFoundException('版本不存在');
    }
    const ver = versionRows[0];

    await this.ensureBankAccess(ver.bankId, appUserId, role, 'ownerCollaboratorOrAdmin');

    const snapshot = ver.snapshot as unknown as VersionSnapshot;
    const questions: QuestionItemV2[] = (snapshot.questions ?? []).map((q, index) => ({
      id: `snapshot-${index}`,
      content: q.content,
      questionType: q.questionType as QuestionItemV2['questionType'],
      options: q.options as QuestionOption[],
      correctAnswers: q.correctAnswers,
      analysis: q.analysis,
      subQuestions: (q.subQuestions ?? []) as SubQuestion[],
      knowledgePoints: q.knowledgePoints,
      unitName: q.unitName ?? null,
      sortOrder: index,
    }));

    return {
      id: ver.id,
      versionNumber: ver.versionNumber,
      changeSummary: ver.changeSummary,
      questionCount: ver.questionCount,
      questions,
      createdAt: ver.createdAt.toISOString(),
    };
  }

  async rollbackVersion(
    versionId: string,
    appUserId: string,
    userId: string,
    role: string,
  ): Promise<RollbackVersionResponse> {
    const versionRows = await this.db
      .select({
        id: questionBankVersion.id,
        bankId: questionBankVersion.bankId,
        versionNumber: questionBankVersion.versionNumber,
        snapshot: questionBankVersion.snapshot,
      })
      .from(questionBankVersion)
      .where(eq(questionBankVersion.id, versionId));

    if (versionRows.length === 0) {
      throw new NotFoundException('版本不存在');
    }
    const ver = versionRows[0];

    // 权限：题库所有者或 admin
    await this.ensureBankAccess(ver.bankId, appUserId, role, 'ownerOrAdmin');

    const snapshot = ver.snapshot as unknown as VersionSnapshot;
    const snapshotQuestions = snapshot.questions ?? [];

    let newVersionNumber = 1;

    await this.db.transaction(async (tx) => {
      // 1. 删除当前题库所有题目
      await tx.delete(question).where(eq(question.bankId, ver.bankId));

      // 2. 批量插入快照中的题目
      if (snapshotQuestions.length > 0) {
        const insertValues = snapshotQuestions.map((q, idx) => ({
          bankId: ver.bankId,
          content: q.content,
          questionType: q.questionType,
          options: q.options as unknown as typeof question.$inferInsert.options,
          correctAnswers: q.correctAnswers as unknown as typeof question.$inferInsert.correctAnswers,
          analysis: q.analysis,
          subQuestions: q.subQuestions as unknown as typeof question.$inferInsert.subQuestions,
          knowledgePoints: q.knowledgePoints,
          unitName: q.unitName,
          sortOrder: idx,
          appUserId,
        }));
        await tx.insert(question).values(insertValues);
      }

      // 3. 更新题库 questionCount
      await tx
        .update(questionBank)
        .set({ questionCount: snapshotQuestions.length })
        .where(eq(questionBank.id, ver.bankId));

      // 4. 创建新版本记录（回退后的当前状态）
      const maxResult = await tx
        .select({ max: max(questionBankVersion.versionNumber) })
        .from(questionBankVersion)
        .where(eq(questionBankVersion.bankId, ver.bankId));
      const currentMax = Number(maxResult[0]?.max ?? 0);
      newVersionNumber = currentMax + 1;

      await tx.insert(questionBankVersion).values({
        bankId: ver.bankId,
        versionNumber: newVersionNumber,
        snapshot: snapshot as unknown as typeof questionBankVersion.$inferInsert.snapshot,
        changeSummary: `回退到版本 v${ver.versionNumber}`,
        questionCount: snapshotQuestions.length,
        createdBy: userId,
        appUserId,
      });

      // 5. 保留最近 MAX_VERSIONS 个版本，删除最旧的
      const versionIds = await tx
        .select({ id: questionBankVersion.id })
        .from(questionBankVersion)
        .where(eq(questionBankVersion.bankId, ver.bankId))
        .orderBy(desc(questionBankVersion.versionNumber))
        .limit(MAX_VERSIONS);

      const keepIds = new Set(versionIds.map((v) => v.id));
      const allVersions = await tx
        .select({ id: questionBankVersion.id })
        .from(questionBankVersion)
        .where(eq(questionBankVersion.bankId, ver.bankId));

      const toDelete = allVersions
        .map((v) => v.id)
        .filter((id) => !keepIds.has(id));

      if (toDelete.length > 0) {
        await tx
          .delete(questionBankVersion)
          .where(inArray(questionBankVersion.id, toDelete));
      }
    });

    return {
      success: true,
      newVersionNumber,
    };
  }

  // ========== 版本快照工具方法（供其他模块调用） ==========

  async createVersionSnapshot(
    bankId: string,
    userId: string,
    appUserId: string,
    changeSummary: string,
  ): Promise<number> {
    // 1. 查询当前题库所有题目
    const questionRows = await this.db
      .select({
        content: question.content,
        questionType: question.questionType,
        options: question.options,
        correctAnswers: question.correctAnswers,
        analysis: question.analysis,
        subQuestions: question.subQuestions,
        knowledgePoints: question.knowledgePoints,
        unitName: question.unitName,
      })
      .from(question)
      .where(eq(question.bankId, bankId))
      .orderBy(question.sortOrder);

    const snapshotQuestions: VersionSnapshotQuestion[] = questionRows.map((row) => ({
      content: row.content,
      questionType: row.questionType,
      options: row.options as unknown as Array<{ label: string; text: string }>,
      correctAnswers: row.correctAnswers as unknown as number[],
      analysis: row.analysis,
      subQuestions: row.subQuestions as unknown as Array<{
        content: string;
        correctAnswer: string;
        analysis: string;
      }>,
      knowledgePoints: row.knowledgePoints,
      unitName: row.unitName ?? null,
    }));

    const snapshot: VersionSnapshot = { questions: snapshotQuestions };

    // 2. 计算当前最新版本号
    const maxResult = await this.db
      .select({ max: max(questionBankVersion.versionNumber) })
      .from(questionBankVersion)
      .where(eq(questionBankVersion.bankId, bankId));
    const currentMax = Number(maxResult[0]?.max ?? 0);
    const newVersionNumber = currentMax + 1;

    // 3. 插入新版本记录
    await this.db.insert(questionBankVersion).values({
      bankId,
      versionNumber: newVersionNumber,
      snapshot: snapshot as unknown as typeof questionBankVersion.$inferInsert.snapshot,
      changeSummary: changeSummary || '保存版本',
      questionCount: snapshotQuestions.length,
      createdBy: userId,
      appUserId,
    });

    // 4. 如果超过 MAX_VERSIONS 个版本，删除最旧的
    const versionCountResult = await this.db
      .select({ count: count() })
      .from(questionBankVersion)
      .where(eq(questionBankVersion.bankId, bankId));
    const totalVersions = Number(versionCountResult[0]?.count ?? 0);

    if (totalVersions > MAX_VERSIONS) {
      const oldest = await this.db
        .select({ id: questionBankVersion.id })
        .from(questionBankVersion)
        .where(eq(questionBankVersion.bankId, bankId))
        .orderBy(questionBankVersion.versionNumber)
        .limit(totalVersions - MAX_VERSIONS);

      const toDelete = oldest.map((v) => v.id);
      if (toDelete.length > 0) {
        await this.db
          .delete(questionBankVersion)
          .where(inArray(questionBankVersion.id, toDelete));
      }
    }

    return newVersionNumber;
  }

  // ========== 权限辅助 ==========

  private async ensureBankAccess(
    bankId: string,
    appUserId: string,
    role: string,
    level: 'ownerOrAdmin' | 'ownerCollaboratorOrAdmin',
  ): Promise<void> {
    const bankRows = await this.db
      .select({ appUserId: questionBank.appUserId })
      .from(questionBank)
      .where(eq(questionBank.id, bankId));

    if (bankRows.length === 0) {
      throw new NotFoundException('题集不存在');
    }

    const isOwner = bankRows[0].appUserId === appUserId;
    const isAdmin = role === 'admin';

    if (isOwner || isAdmin) return;

    if (level === 'ownerCollaboratorOrAdmin') {
      const collaboratorRows = await this.db
        .select({ id: questionBankCollaborator.id })
        .from(questionBankCollaborator)
        .where(and(
          eq(questionBankCollaborator.bankId, bankId),
          eq(questionBankCollaborator.appUserId, appUserId),
        ));
      if (collaboratorRows.length > 0) return;
    }

    throw new ForbiddenException('无权限访问');
  }
}
