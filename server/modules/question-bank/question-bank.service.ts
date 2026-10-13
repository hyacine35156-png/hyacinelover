import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, asc, count, sql, inArray, max } from 'drizzle-orm';
import * as XLSX from 'xlsx';

import { questionBank, question, userQuestionState, subject, appUser, practiceRecord, questionBankCollaborator, questionTag, questionTagRel, practiceAnswer, questionBankVersion } from '@server/database/schema';

const IMPORT_MAX_QUESTIONS = 2000;
const IMPORT_MAX_FILE_SIZE = 20 * 1024 * 1024;

const BANK_NAME_SENSITIVE_WORDS = [
  '真题',
  '刷题',
  '考试答案',
  '作弊',
  '泄题',
  '押题',
  '密卷',
  '考前答案',
];

function checkBankNameSensitiveWords(name: string): string[] {
  const warnings: string[] = [];
  for (const word of BANK_NAME_SENSITIVE_WORDS) {
    if (name.includes(word)) {
      warnings.push(`题集名称包含「${word}」敏感词，建议修改为更合规的名称（仅供个人学习自测使用）`);
    }
  }
  return warnings;
}
import type {
  QuestionBankItem,
  QuestionItem,
  CreateQuestionBankRequest,
  CreateQuestionBankResponse,
  CreateQuestionRequest,
  ImportQuestionBankResponse,
  QuestionOption,
  QuestionType,
  UpdateQuestionBankRequest,
  UpdateQuestionRequest,
  GenerateRandomBankRequest,
  QuestionWithFavorite,
  QuestionWithFavoriteListResponse,
  CopyQuestionBankRequest,
  SubQuestion,
  ParsedQuestionItem,
  WordPreviewResponse,
  WrongReason,
  BankSortBy,
  BatchBankOperationRequest,
  BatchBankOperationResponse,
  BankShareInfo,
  BatchDeleteQuestionsRequest,
  BatchDeleteQuestionsResponse,
  BatchReplaceRequest,
  BatchReplacePreviewResponse,
  BatchReplaceResponse,
} from '@shared/api.interface';
import { parseWordToText, smartParseQuestions, computeImportPreview } from './word-parser';

@Injectable()
export class QuestionBankService {
  private readonly logger = new Logger(QuestionBankService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getPublicBanks(subjectId?: string): Promise<QuestionBankItem[]> {
    const conditions: ReturnType<typeof and>[] = [
      eq(questionBank.isPublic, true),
      eq(questionBank.isTemporary, false),
    ];

    if (subjectId) {
      conditions.push(eq(questionBank.subjectId, subjectId));
    } else if (subjectId === null) {
      conditions.push(sql`${questionBank.subjectId} IS NULL`);
    }

    const rows = await this.db
      .select({
        id: questionBank.id,
        name: questionBank.name,
        description: questionBank.description,
        questionCount: questionBank.questionCount,
        isTemporary: questionBank.isTemporary,
        bankType: questionBank.bankType,
        subjectId: questionBank.subjectId,
        subjectName: subject.name,
        isPublic: questionBank.isPublic,
        ownerUsername: appUser.username,
        createdAt: questionBank.createdAt,
      })
      .from(questionBank)
      .leftJoin(subject, eq(questionBank.subjectId, subject.id))
      .leftJoin(appUser, eq(questionBank.appUserId, appUser.id))
      .where(and(...conditions))
      .orderBy(desc(questionBank.createdAt));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      questionCount: row.questionCount,
      isTemporary: Boolean(row.isTemporary),
      bankType: row.bankType as QuestionBankItem['bankType'],
      subjectId: row.subjectId ?? null,
      subjectName: row.subjectName ?? null,
      isPublic: Boolean(row.isPublic),
      ownerUsername: row.ownerUsername ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getPublicBankQuestions(bankId: string): Promise<QuestionItem[]> {
    const bankResult = await this.db
      .select({
        id: questionBank.id,
        isPublic: questionBank.isPublic,
      })
      .from(questionBank)
      .where(eq(questionBank.id, bankId));
    if (bankResult.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    const bank = bankResult[0];
    if (!bank.isPublic) {
      throw new NotFoundException('题集不存在');
    }

    const rows = await this.db
      .select()
      .from(question)
      .where(eq(question.bankId, bankId))
      .orderBy(question.createdAt);

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      questionType: row.questionType as QuestionType,
      options: row.options as unknown as QuestionOption[],
      correctAnswers: row.correctAnswers as unknown as number[],
      analysis: row.analysis,
      subQuestions: (row.subQuestions as unknown as SubQuestion[]) ?? [],
      knowledgePoints: row.knowledgePoints ?? '',
      unitName: row.unitName ?? null,
      sortOrder: row.sortOrder ?? 0,
    }));
  }

  private getOrderByColumns(
    sortBy: BankSortBy = 'created_at_desc',
  ): (ReturnType<typeof desc> | ReturnType<typeof asc>)[] {
    switch (sortBy) {
      case 'created_at_asc':
        return [asc(questionBank.createdAt)];
      case 'question_count_desc':
        return [desc(questionBank.questionCount), desc(questionBank.createdAt)];
      case 'question_count_asc':
        return [asc(questionBank.questionCount), desc(questionBank.createdAt)];
      case 'name_asc':
        return [asc(sql`LOWER(${questionBank.name})`), desc(questionBank.createdAt)];
      case 'name_desc':
        return [desc(sql`LOWER(${questionBank.name})`), desc(questionBank.createdAt)];
      case 'last_practiced_desc':
        return [desc(questionBank.lastPracticedAt), desc(questionBank.createdAt)];
      case 'last_practiced_asc':
        return [sql`${questionBank.lastPracticedAt} IS NULL, ${asc(questionBank.lastPracticedAt)}`, asc(questionBank.createdAt)];
      case 'created_at_desc':
      default:
        return [desc(questionBank.createdAt)];
    }
  }

  async getBanks(
    appUserId: string,
    subjectId?: string,
    visibility: 'all' | 'private' | 'public' = 'all',
    sortBy: BankSortBy = 'created_at_desc',
  ): Promise<QuestionBankItem[]> {
    const baseConditions: ReturnType<typeof and>[] = [];
    const orderBy = this.getOrderByColumns(sortBy);

    if (visibility === 'public') {
      baseConditions.push(eq(questionBank.isPublic, true));
      if (subjectId) {
        baseConditions.push(eq(questionBank.subjectId, subjectId));
      } else if (subjectId === null) {
        baseConditions.push(sql`${questionBank.subjectId} IS NULL`);
      }

      const rows = await this.db
        .select({
          id: questionBank.id,
          name: questionBank.name,
          description: questionBank.description,
          questionCount: questionBank.questionCount,
          isTemporary: questionBank.isTemporary,
          bankType: questionBank.bankType,
          subjectId: questionBank.subjectId,
          subjectName: subject.name,
          isPublic: questionBank.isPublic,
          ownerUsername: appUser.username,
          createdAt: questionBank.createdAt,
        })
        .from(questionBank)
        .leftJoin(subject, eq(questionBank.subjectId, subject.id))
        .leftJoin(appUser, eq(questionBank.appUserId, appUser.id))
        .where(and(...baseConditions))
        .orderBy(...orderBy);

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        questionCount: row.questionCount,
        isTemporary: Boolean(row.isTemporary),
        bankType: row.bankType as QuestionBankItem['bankType'],
        subjectId: row.subjectId ?? null,
        subjectName: row.subjectName ?? null,
        isPublic: Boolean(row.isPublic),
        ownerUsername: row.ownerUsername ?? undefined,
        createdAt: row.createdAt.toISOString(),
      }));
    }

    const conditions = [eq(questionBank.appUserId, appUserId)];
    if (visibility === 'private') {
      conditions.push(eq(questionBank.isPublic, false));
    }
    if (subjectId) {
      conditions.push(eq(questionBank.subjectId, subjectId));
    } else if (subjectId === null) {
      conditions.push(sql`${questionBank.subjectId} IS NULL`);
    }

    const needsAccuracyJoin = sortBy === 'accuracy_desc' || sortBy === 'accuracy_asc';

    if (needsAccuracyJoin) {
      // 正确率排序：关联 practice_record 计算每个题库的平均正确率
      const accuracySubquery = this.db
        .select({
          bankId: practiceRecord.bankId,
          avgAccuracy: sql<number>`AVG(${practiceRecord.accuracyRate})`.as('avg_accuracy'),
        })
        .from(practiceRecord)
        .where(and(
          eq(practiceRecord.appUserId, appUserId),
          eq(practiceRecord.status, 'finished'),
        ))
        .groupBy(practiceRecord.bankId)
        .as('acc_sub');

      const rows = await this.db
        .select({
          id: questionBank.id,
          name: questionBank.name,
          description: questionBank.description,
          questionCount: questionBank.questionCount,
          isTemporary: questionBank.isTemporary,
          bankType: questionBank.bankType,
          subjectId: questionBank.subjectId,
          subjectName: subject.name,
          isPublic: questionBank.isPublic,
          createdAt: questionBank.createdAt,
          avgAccuracy: accuracySubquery.avgAccuracy,
        })
        .from(questionBank)
        .leftJoin(subject, eq(questionBank.subjectId, subject.id))
        .leftJoin(accuracySubquery, eq(questionBank.id, accuracySubquery.bankId))
        .where(and(...conditions))
        .orderBy(
          sortBy === 'accuracy_desc'
            ? sql`${accuracySubquery.avgAccuracy} IS NULL, ${desc(accuracySubquery.avgAccuracy)}`
            : sql`${accuracySubquery.avgAccuracy} IS NULL, ${asc(accuracySubquery.avgAccuracy)}`,
          desc(questionBank.createdAt),
        );

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        questionCount: row.questionCount,
        isTemporary: Boolean(row.isTemporary),
        bankType: row.bankType as QuestionBankItem['bankType'],
        subjectId: row.subjectId ?? null,
        subjectName: row.subjectName ?? null,
        isPublic: Boolean(row.isPublic),
        createdAt: row.createdAt.toISOString(),
      }));
    }

    const rows = await this.db
      .select({
        id: questionBank.id,
        name: questionBank.name,
        description: questionBank.description,
        questionCount: questionBank.questionCount,
        isTemporary: questionBank.isTemporary,
        bankType: questionBank.bankType,
        subjectId: questionBank.subjectId,
        subjectName: subject.name,
        isPublic: questionBank.isPublic,
        createdAt: questionBank.createdAt,
      })
      .from(questionBank)
      .leftJoin(subject, eq(questionBank.subjectId, subject.id))
      .where(and(...conditions))
      .orderBy(questionBank.isTemporary, ...orderBy);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      questionCount: row.questionCount,
      isTemporary: Boolean(row.isTemporary),
      bankType: row.bankType as QuestionBankItem['bankType'],
      subjectId: row.subjectId ?? null,
      subjectName: row.subjectName ?? null,
      isPublic: Boolean(row.isPublic),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createBank(
    appUserId: string,
    dto: CreateQuestionBankRequest,
  ): Promise<CreateQuestionBankResponse> {
    if (!dto.name?.trim()) {
      throw new BadRequestException('题集名称不能为空');
    }
    const nameWarnings = checkBankNameSensitiveWords(dto.name.trim());
    const [row] = await this.db
      .insert(questionBank)
      .values({
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        subjectId: dto.subjectId ?? null,
        isPublic: dto.isPublic ?? false,
        appUserId,
      })
      .returning({ id: questionBank.id, name: questionBank.name, questionCount: questionBank.questionCount, createdAt: questionBank.createdAt });

    return {
      id: row.id,
      name: row.name,
      questionCount: row.questionCount,
      createdAt: row.createdAt.toISOString(),
      warnings: nameWarnings.length > 0 ? nameWarnings : undefined,
    };
  }

  async deleteBank(appUserId: string, id: string): Promise<{ success: boolean }> {
    const deleted = await this.db
      .delete(questionBank)
      .where(and(eq(questionBank.id, id), eq(questionBank.appUserId, appUserId)))
      .returning({ id: questionBank.id });

    if (deleted.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    return { success: true };
  }

  async batchOperation(
    appUserId: string,
    dto: BatchBankOperationRequest,
  ): Promise<BatchBankOperationResponse> {
    const { bankIds, operation, subjectId } = dto;
    if (!bankIds || bankIds.length === 0) {
      return { successCount: 0, failCount: 0 };
    }

    const totalCount = bankIds.length;
    let successCount = 0;

    const baseWhere = and(
      inArray(questionBank.id, bankIds),
      eq(questionBank.appUserId, appUserId),
    );

    try {
      if (operation === 'delete') {
        const deleted = await this.db
          .delete(questionBank)
          .where(baseWhere)
          .returning({ id: questionBank.id });
        successCount = deleted.length;
      } else if (operation === 'move_subject') {
        const targetSubjectId = subjectId ?? null;
        const updated = await this.db
          .update(questionBank)
          .set({ subjectId: targetSubjectId })
          .where(baseWhere)
          .returning({ id: questionBank.id });
        successCount = updated.length;
      } else if (operation === 'set_public') {
        const updated = await this.db
          .update(questionBank)
          .set({ isPublic: true })
          .where(baseWhere)
          .returning({ id: questionBank.id });
        successCount = updated.length;
      } else if (operation === 'set_private') {
        const updated = await this.db
          .update(questionBank)
          .set({ isPublic: false })
          .where(baseWhere)
          .returning({ id: questionBank.id });
        successCount = updated.length;
      } else {
        throw new BadRequestException('不支持的操作类型');
      }
    } catch (error) {
      this.logger.error(`批量操作失败: ${operation}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }

    return {
      successCount,
      failCount: totalCount - successCount,
    };
  }

  async getShareInfo(
    appUserId: string,
    bankId: string,
    baseUrl: string,
  ): Promise<BankShareInfo> {
    const result = await this.db
      .select({
        id: questionBank.id,
        name: questionBank.name,
        isPublic: questionBank.isPublic,
        appUserId: questionBank.appUserId,
      })
      .from(questionBank)
      .where(eq(questionBank.id, bankId));

    if (result.length === 0) {
      throw new NotFoundException('题集不存在');
    }

    const bank = result[0];
    const isOwner = bank.appUserId === appUserId;
    if (!isOwner) {
      throw new NotFoundException('题集不存在');
    }

    const isPublic = Boolean(bank.isPublic);

    return {
      bankId: bank.id,
      bankName: bank.name,
      shareUrl: isPublic ? `${baseUrl}/banks` : '',
      isPublic,
    };
  }

  async getQuestions(appUserId: string, bankId: string): Promise<QuestionItem[]> {
    const bankResult = await this.db
      .select({ id: questionBank.id, appUserId: questionBank.appUserId, isPublic: questionBank.isPublic })
      .from(questionBank)
      .where(eq(questionBank.id, bankId));
    if (bankResult.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    const bank = bankResult[0];
    const isOwner = bank.appUserId === appUserId;
    const isPublicBank = Boolean(bank.isPublic);
    if (!isOwner && !isPublicBank) {
      throw new NotFoundException('题集不存在');
    }

    const rows = await this.db
      .select()
      .from(question)
      .where(eq(question.bankId, bankId))
      .orderBy(question.createdAt);

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      questionType: row.questionType as QuestionType,
      options: (row.options as unknown as QuestionOption[]),
      correctAnswers: row.correctAnswers as unknown as number[],
      analysis: row.analysis,
      subQuestions: (row.subQuestions as unknown as SubQuestion[]) ?? [],
      knowledgePoints: row.knowledgePoints ?? '',
      unitName: row.unitName ?? null,
      sortOrder: row.sortOrder ?? 0,
    }));
  }

  async addQuestion(
    appUserId: string,
    bankId: string,
    dto: CreateQuestionRequest,
  ): Promise<{ id: string; content: string }> {
    const bankResult = await this.db
      .select({ id: questionBank.id })
      .from(questionBank)
      .where(and(eq(questionBank.id, bankId), eq(questionBank.appUserId, appUserId)));
    if (bankResult.length === 0) {
      throw new NotFoundException('题集不存在');
    }

    if (!dto.content?.trim()) {
      throw new BadRequestException('题干不能为空');
    }
    if (dto.questionType === 'b1') {
      if (!dto.options || dto.options.length < 2) {
        throw new BadRequestException('B1型题至少需要2个备选答案');
      }
      if (!dto.subQuestions || dto.subQuestions.length < 1) {
        throw new BadRequestException('B1型题至少需要1个子问题');
      }
      const labels = dto.options.map((o: QuestionOption) => o.label);
      for (const sq of dto.subQuestions) {
        if (!sq.content?.trim()) {
          throw new BadRequestException('子问题题干不能为空');
        }
        if (!sq.correctAnswer || !labels.includes(sq.correctAnswer)) {
          throw new BadRequestException(`子问题正确答案「${sq.correctAnswer}」不在备选答案中`);
        }
      }
    } else {
      if (!dto.options || dto.options.length < 2) {
        throw new BadRequestException('至少需要2个选项');
      }
      if (!dto.correctAnswers || dto.correctAnswers.length === 0) {
        throw new BadRequestException('请选择正确答案');
      }
      if (dto.questionType === 'single' && dto.correctAnswers.length !== 1) {
        throw new BadRequestException('单选题只能有一个正确答案');
      }
    }

    const [inserted] = await this.db
      .insert(question)
      .values({
        bankId,
        content: dto.content.trim(),
        questionType: dto.questionType,
        options: dto.options as unknown as Record<string, unknown>[],
        correctAnswers: dto.correctAnswers as unknown as number[],
        analysis: dto.analysis?.trim() ?? '',
        subQuestions: (dto.subQuestions ?? []) as unknown as Record<string, unknown>[],
        knowledgePoints: dto.knowledgePoints ?? '',
        unitName: dto.unitName ?? null,
        appUserId,
      })
      .returning({ id: question.id, content: question.content });

    await this.db
      .update(questionBank)
      .set({ questionCount: sql`${questionBank.questionCount} + 1` })
      .where(and(eq(questionBank.id, bankId), eq(questionBank.appUserId, appUserId)));

    this.createVersionSnapshot(bankId, appUserId, '新增 1 题');

    return { id: inserted.id, content: inserted.content };
  }

  async updateBank(
    appUserId: string,
    id: string,
    dto: UpdateQuestionBankRequest,
  ): Promise<{ success: boolean }> {
    const bankResult = await this.db
      .select({ id: questionBank.id })
      .from(questionBank)
      .where(and(eq(questionBank.id, id), eq(questionBank.appUserId, appUserId)));
    if (bankResult.length === 0) {
      throw new NotFoundException('题集不存在');
    }

    const patch: Partial<typeof questionBank.$inferInsert> = {};
    if (dto.name !== undefined && dto.name.trim()) {
      patch.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      patch.description = dto.description.trim();
    }
    if (dto.subjectId !== undefined) {
      patch.subjectId = dto.subjectId ?? null;
    }
    if (dto.isPublic !== undefined) {
      patch.isPublic = dto.isPublic;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(questionBank)
      .set(patch)
      .where(and(eq(questionBank.id, id), eq(questionBank.appUserId, appUserId)))
      .returning({ id: questionBank.id });
    if (updated.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    return { success: true };
  }

  async copyBank(
    appUserId: string,
    sourceBankId: string,
    targetName: string,
    targetSubjectId?: string,
  ): Promise<{ id: string; name: string; questionCount: number; createdAt: string }> {
    if (!targetName?.trim()) {
      throw new BadRequestException('目标题集名称不能为空');
    }

    const sourceBanks = await this.db
      .select({
        id: questionBank.id,
        name: questionBank.name,
        description: questionBank.description,
        isPublic: questionBank.isPublic,
        appUserId: questionBank.appUserId,
      })
      .from(questionBank)
      .where(eq(questionBank.id, sourceBankId));

    if (sourceBanks.length === 0) {
      throw new NotFoundException('源题集不存在');
    }

    const sourceBank = sourceBanks[0];
    if (!sourceBank.isPublic && sourceBank.appUserId !== appUserId) {
      throw new ForbiddenException('只能复制公开题集');
    }

    const sourceQuestions = await this.db
      .select({
        id: question.id,
        content: question.content,
        questionType: question.questionType,
        options: question.options,
        correctAnswers: question.correctAnswers,
        analysis: question.analysis,
        subQuestions: question.subQuestions,
        knowledgePoints: question.knowledgePoints,
        unitName: question.unitName,
        sortOrder: question.sortOrder,
      })
      .from(question)
      .where(eq(question.bankId, sourceBankId))
      .orderBy(question.createdAt);

    const [newBank] = await this.db
      .insert(questionBank)
      .values({
        name: targetName.trim(),
        description: sourceBank.description,
        subjectId: targetSubjectId ?? null,
        questionCount: sourceQuestions.length,
        isPublic: false,
        appUserId,
      })
      .returning({
        id: questionBank.id,
        name: questionBank.name,
        questionCount: questionBank.questionCount,
        createdAt: questionBank.createdAt,
      });

    if (sourceQuestions.length > 0) {
      await this.db.insert(question).values(
        sourceQuestions.map((q) => ({
          bankId: newBank.id,
          content: q.content,
          questionType: q.questionType,
          options: q.options as unknown as Record<string, unknown>[],
          correctAnswers: q.correctAnswers as unknown as number[],
          analysis: q.analysis,
          subQuestions: q.subQuestions as unknown as Record<string, unknown>[],
          knowledgePoints: q.knowledgePoints ?? '',
          unitName: q.unitName ?? null,
          sortOrder: q.sortOrder ?? 0,
          appUserId,
        })),
      );
    }

    return {
      id: newBank.id,
      name: newBank.name,
      questionCount: newBank.questionCount,
      createdAt: newBank.createdAt.toISOString(),
    };
  }

  async updateQuestion(
    appUserId: string,
    bankId: string,
    questionId: string,
    dto: UpdateQuestionRequest,
  ): Promise<{ success: boolean }> {
    const bankResult = await this.db
      .select({ id: questionBank.id })
      .from(questionBank)
      .where(and(eq(questionBank.id, bankId), eq(questionBank.appUserId, appUserId)));
    if (bankResult.length === 0) {
      throw new NotFoundException('题集不存在');
    }

    const existing = await this.db
      .select({ id: question.id })
      .from(question)
      .where(and(
        eq(question.id, questionId),
        eq(question.bankId, bankId),
        eq(question.appUserId, appUserId),
      ));
    if (existing.length === 0) {
      throw new NotFoundException('题目不存在');
    }

    const patch: Partial<typeof question.$inferInsert> = {};
    if (dto.content !== undefined) {
      if (!dto.content.trim()) {
        throw new BadRequestException('题干不能为空');
      }
      patch.content = dto.content.trim();
    }
    if (dto.questionType !== undefined) {
      patch.questionType = dto.questionType;
    }
    if (dto.options !== undefined) {
      if (!Array.isArray(dto.options) || dto.options.length < 2) {
        throw new BadRequestException('至少需要2个选项');
      }
      patch.options = dto.options as unknown as Record<string, unknown>[];
    }
    if (dto.correctAnswers !== undefined) {
      if (dto.questionType === 'b1') {
        throw new BadRequestException('B1型题请通过 subQuestions 提交正确答案');
      }
      if (!Array.isArray(dto.correctAnswers) || dto.correctAnswers.length === 0) {
        throw new BadRequestException('请选择正确答案');
      }
      const opts = dto.options || [];
      if (dto.questionType === 'single' && dto.correctAnswers.length !== 1) {
        throw new BadRequestException('单选题只能有一个正确答案');
      }
      if (opts.length > 0 && dto.correctAnswers.some((idx: number) => idx < 0 || idx >= opts.length)) {
        throw new BadRequestException('正确答案索引超出选项范围');
      }
      patch.correctAnswers = dto.correctAnswers as unknown as number[];
    }
    if (dto.analysis !== undefined) {
      patch.analysis = dto.analysis.trim();
    }
    if (dto.subQuestions !== undefined) {
      const opts = dto.options || [];
      const labels = opts.map((o: QuestionOption) => o.label);
      for (const sq of dto.subQuestions) {
        if (!sq.content?.trim()) {
          throw new BadRequestException('子问题题干不能为空');
        }
        if (dto.questionType === 'b1' && !sq.correctAnswer) {
          throw new BadRequestException('子问题必须指定正确答案');
        }
        if (sq.correctAnswer && labels.length > 0 && !labels.includes(sq.correctAnswer)) {
          throw new BadRequestException(`子问题正确答案「${sq.correctAnswer}」不在备选答案中`);
        }
      }
      patch.subQuestions = dto.subQuestions as unknown as Record<string, unknown>[];
    }
    if (dto.knowledgePoints !== undefined) {
      patch.knowledgePoints = dto.knowledgePoints;
    }
    if (dto.unitName !== undefined) {
      patch.unitName = dto.unitName ?? null;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(question)
      .set(patch)
      .where(and(eq(question.id, questionId), eq(question.appUserId, appUserId)))
      .returning({ id: question.id });
    if (updated.length === 0) {
      throw new NotFoundException('题目不存在');
    }

    this.createVersionSnapshot(bankId, appUserId, '编辑 1 题');

    return { success: true };
  }

  async deleteQuestion(
    appUserId: string,
    bankId: string,
    questionId: string,
  ): Promise<{ success: boolean }> {
    const bankResult = await this.db
      .select({ id: questionBank.id })
      .from(questionBank)
      .where(and(eq(questionBank.id, bankId), eq(questionBank.appUserId, appUserId)));
    if (bankResult.length === 0) {
      throw new NotFoundException('题集不存在');
    }

    const deleted = await this.db
      .delete(question)
      .where(and(
        eq(question.id, questionId),
        eq(question.bankId, bankId),
        eq(question.appUserId, appUserId),
      ))
      .returning({ id: question.id });

    if (deleted.length === 0) {
      throw new NotFoundException('题目不存在');
    }

    await this.db
      .update(questionBank)
      .set({ questionCount: sql`${questionBank.questionCount} - 1` })
      .where(and(eq(questionBank.id, bankId), eq(questionBank.appUserId, appUserId)));

    this.createVersionSnapshot(bankId, appUserId, '删除 1 题');

    return { success: true };
  }

  async importBank(
    appUserId: string,
    name: string,
    fileBuffer: Buffer,
    fileOriginalName: string,
    isPublic = false,
  ): Promise<ImportQuestionBankResponse> {
    if (!name?.trim()) {
      throw new BadRequestException('题集名称不能为空');
    }
    const nameWarnings = checkBankNameSensitiveWords(name.trim());

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('文件内容为空');
    }

    if (fileBuffer.length > IMPORT_MAX_FILE_SIZE) {
      throw new BadRequestException(`文件大小不能超过 20MB（当前 ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB）`);
    }

    const ext = fileOriginalName.split('.').pop()?.toLowerCase();
    let parsedRows: Record<string, unknown>[] = [];
    let wordQuestions: ParsedQuestionItem[] = [];
    const wordFailures: { index: number; reason: string }[] = [];

    try {
      if (ext === 'json') {
        let jsonStr = fileBuffer.toString('utf8');
        if (jsonStr.charCodeAt(0) === 0xFEFF) {
          jsonStr = jsonStr.slice(1);
        }
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
          parsedRows = parsed;
        } else if (parsed.questions && Array.isArray(parsed.questions)) {
          parsedRows = parsed.questions;
        } else {
          throw new BadRequestException('JSON 文件格式不正确，应为题目数组');
        }
      } else if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const firstSheet = workbook.SheetNames[0];
        if (!firstSheet) {
          throw new BadRequestException('文件中没有工作表');
        }
        parsedRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' }) as Record<string, unknown>[];
      } else if (ext === 'docx' || ext === 'doc') {
        const text = await parseWordToText(fileBuffer);
        const { questions, failures: parseFailures } = smartParseQuestions(text);
        if (questions.length === 0 && parseFailures.length > 0) {
          throw new BadRequestException(parseFailures[0].reason);
        }
        wordQuestions = questions;
        wordFailures.push(...parseFailures);
      } else {
        throw new BadRequestException('不支持的文件格式，请上传符合特定格式的 JSON 文件');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('解析文件失败', String(err));
      throw new BadRequestException('文件解析失败，请检查文件格式');
    }

    const isWord = ext === 'docx' || ext === 'doc';
    const rawCount = isWord ? wordQuestions.length : parsedRows.length;
    if (rawCount === 0) {
      throw new BadRequestException('文件中没有题目数据');
    }
    if (rawCount > IMPORT_MAX_QUESTIONS) {
      throw new BadRequestException(`单次导入题目数量不能超过 ${IMPORT_MAX_QUESTIONS} 道`);
    }

    const [bank] = await this.db
      .insert(questionBank)
      .values({
        name: name.trim(),
        description: '',
        questionCount: 0,
        appUserId,
        isPublic,
      })
      .returning({ id: questionBank.id });

    const bankId = bank.id;
    const validQuestions: {
      content: string;
      questionType: string;
      options: QuestionOption[];
      correctAnswers: number[];
      analysis: string;
      subQuestions: SubQuestion[];
    }[] = [];
    const failures: { row: number; reason: string }[] = [];
    let sourceFormat: 'excel' | 'csv' | 'json' | 'word' = 'json';

    if (isWord) {
      validQuestions.push(
        ...wordQuestions.map((q) => ({
          content: q.content,
          questionType: q.questionType,
          options: q.options,
          correctAnswers: q.correctAnswers,
          analysis: q.analysis,
          subQuestions: q.subQuestions,
        })),
      );
      sourceFormat = 'word';
    } else {
      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        const rowNum = i + 1;
        try {
          const { content, options, correctAnswers, questionType, analysis, subQuestions } = this.parseRow(row);
          validQuestions.push({ content, questionType, options, correctAnswers, analysis, subQuestions });
        } catch (err) {
          const contentPreview = this.getStringField(row, ['题干', 'content', 'question', 'title', '题目']).slice(0, 20);
          const prefix = contentPreview ? `「${contentPreview}」` : `第 ${rowNum} 行`;
          failures.push({
            row: rowNum,
            reason: `${prefix}：${err instanceof Error ? err.message : '未知错误'}`,
          });
        }
      }
      if (ext === 'csv') sourceFormat = 'csv';
      else if (ext === 'xlsx' || ext === 'xls') sourceFormat = 'excel';
      else sourceFormat = 'json';
    }

    if (validQuestions.length > 0) {
      await this.db.insert(question).values(
        validQuestions.map((q) => ({
          bankId,
          content: q.content,
          questionType: q.questionType,
          options: q.options,
          correctAnswers: q.correctAnswers,
          analysis: q.analysis,
          subQuestions: q.subQuestions,
          knowledgePoints: '',
          appUserId,
        })),
      );
      await this.db
        .update(questionBank)
        .set({ questionCount: validQuestions.length })
        .where(and(eq(questionBank.id, bankId), eq(questionBank.appUserId, appUserId)));
    } else {
      await this.db
        .delete(questionBank)
        .where(and(eq(questionBank.id, bankId), eq(questionBank.appUserId, appUserId)));
    }

    let singleCount = 0;
    let multipleCount = 0;
    let b1Count = 0;
    for (const q of validQuestions) {
      if (q.questionType === 'single') singleCount += 1;
      else if (q.questionType === 'multiple') multipleCount += 1;
      else if (q.questionType === 'b1') b1Count += 1;
    }

    if (validQuestions.length > 0) {
      this.createVersionSnapshot(bankId, appUserId, `导入 ${validQuestions.length} 题`);
    }

    return {
      bankId,
      successCount: validQuestions.length,
      failCount: failures.length,
      failures,
      singleCount,
      multipleCount,
      b1Count,
      sourceFormat,
      warnings: nameWarnings.length > 0 ? nameWarnings : undefined,
    };
  }
  async previewWordImport(fileBuffer: Buffer): Promise<WordPreviewResponse> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('文件内容为空');
    }
    const MAX_FILE_SIZE = IMPORT_MAX_FILE_SIZE;
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException(`文件大小不能超过 20MB（当前 ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB）`);
    }

    const text = await parseWordToText(fileBuffer);
    const { questions, failures } = smartParseQuestions(text);

    if (questions.length === 0 && failures.length > 0) {
      throw new BadRequestException(failures[0].reason);
    }
    if (questions.length > IMPORT_MAX_QUESTIONS) {
      throw new BadRequestException(`单次导入题目数量不能超过 ${IMPORT_MAX_QUESTIONS} 道`);
    }

    const stats = computeImportPreview(questions);
    return {
      ...stats,
      questions,
      failures,
    };
  }

  async generateRandomBank(
    appUserId: string,
    dto: GenerateRandomBankRequest,
  ): Promise<{ bankId: string; name: string; questionCount: number; createdAt: string }> {
    const { sourceBankIds, questionCount, name } = dto;

    if (!sourceBankIds || sourceBankIds.length === 0) {
      throw new BadRequestException('请至少选择一个题集作为抽题来源');
    }
    if (!questionCount || questionCount <= 0) {
      throw new BadRequestException('抽题数量必须大于 0');
    }

    const validBanks = await this.db
      .select({ id: questionBank.id, name: questionBank.name, questionCount: questionBank.questionCount })
      .from(questionBank)
      .where(and(
        inArray(questionBank.id, Array.from(new Set(sourceBankIds))),
        eq(questionBank.appUserId, appUserId),
      ));

    if (validBanks.length === 0) {
      throw new BadRequestException('所选题集不存在');
    }

    const totalAvailable = validBanks.reduce((sum: number, b) => sum + b.questionCount, 0);
    if (totalAvailable === 0) {
      throw new BadRequestException('所选题集中没有可用题目');
    }
    if (questionCount > totalAvailable) {
      throw new BadRequestException(`抽题数量不能超过可用题目总数（${totalAvailable} 道）`);
    }

    const bankIds = validBanks.map((b) => b.id);
    const sourceQuestions = await this.db
      .select({
        id: question.id,
        bankId: question.bankId,
        content: question.content,
        questionType: question.questionType,
        options: question.options,
        correctAnswers: question.correctAnswers,
        analysis: question.analysis,
        subQuestions: question.subQuestions,
        knowledgePoints: question.knowledgePoints,
        unitName: question.unitName,
        sortOrder: question.sortOrder,
      })
      .from(question)
      .where(and(inArray(question.bankId, bankIds), eq(question.appUserId, appUserId)));

    const shuffled = sourceQuestions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, questionCount);

    const defaultName = `临时题集_${new Date().toISOString().slice(0, 10)}_${questionCount}题`;
    const finalName = name?.trim() || defaultName;

    const [newBank] = await this.db
      .insert(questionBank)
      .values({
        name: finalName,
        description: `从 ${validBanks.length} 个题集中随机抽取 ${questionCount} 道题`,
        questionCount: selected.length,
        isTemporary: true,
        appUserId,
      })
      .returning({ id: questionBank.id, name: questionBank.name, questionCount: questionBank.questionCount, createdAt: questionBank.createdAt });

    if (selected.length > 0) {
      await this.db.insert(question).values(
        selected.map((q) => ({
          bankId: newBank.id,
          content: q.content,
          questionType: q.questionType,
          options: q.options as unknown as Record<string, unknown>[],
          correctAnswers: q.correctAnswers as unknown as number[],
          analysis: q.analysis,
          subQuestions: q.subQuestions as unknown as Record<string, unknown>[],
          knowledgePoints: q.knowledgePoints ?? '',
          unitName: q.unitName ?? null,
          sortOrder: q.sortOrder ?? 0,
          appUserId,
        })),
      );
    }

    return {
      bankId: newBank.id,
      name: newBank.name,
      questionCount: newBank.questionCount,
      createdAt: newBank.createdAt.toISOString(),
    };
  }

  async generateRandomBankByIds(
    appUserId: string,
    questionIds: string[],
    name?: string,
  ): Promise<{ bankId: string; name: string; questionCount: number; createdAt: string }> {
    if (!questionIds || questionIds.length === 0) {
      throw new BadRequestException('抽题数量必须大于 0');
    }

    const uniqueIds = Array.from(new Set(questionIds));
    const sourceQuestions = await this.db
      .select({
        id: question.id,
        content: question.content,
        questionType: question.questionType,
        options: question.options,
        correctAnswers: question.correctAnswers,
        analysis: question.analysis,
        subQuestions: question.subQuestions,
        knowledgePoints: question.knowledgePoints,
        unitName: question.unitName,
        sortOrder: question.sortOrder,
      })
      .from(question)
      .leftJoin(questionBank, eq(question.bankId, questionBank.id))
      .where(and(
        inArray(question.id, uniqueIds),
        sql`(
          ${question.appUserId} = ${appUserId}::uuid
          OR ${questionBank.isPublic} = true
        )`,
      ));

    if (sourceQuestions.length === 0) {
      throw new BadRequestException('未找到匹配的题目');
    }

    const finalName = name?.trim() || `临时题集_${new Date().toISOString().slice(0, 10)}_${sourceQuestions.length}题`;

    const [newBank] = await this.db
      .insert(questionBank)
      .values({
        name: finalName,
        description: `随机抽取 ${sourceQuestions.length} 道题`,
        questionCount: sourceQuestions.length,
        isTemporary: true,
        appUserId,
      })
      .returning({
        id: questionBank.id,
        name: questionBank.name,
        questionCount: questionBank.questionCount,
        createdAt: questionBank.createdAt,
      });

    await this.db.insert(question).values(
      sourceQuestions.map((q) => ({
        bankId: newBank.id,
        content: q.content,
        questionType: q.questionType,
        options: q.options as unknown as Record<string, unknown>[],
        correctAnswers: q.correctAnswers as unknown as number[],
        analysis: q.analysis,
        subQuestions: q.subQuestions as unknown as Record<string, unknown>[],
        knowledgePoints: q.knowledgePoints ?? '',
        unitName: q.unitName ?? null,
        sortOrder: q.sortOrder ?? 0,
        appUserId,
      })),
    );

    return {
      bankId: newBank.id,
      name: newBank.name,
      questionCount: newBank.questionCount,
      createdAt: newBank.createdAt.toISOString(),
    };
  }

  async getQuestionsWithUserState(
    appUserId: string,
    bankId: string,
  ): Promise<QuestionWithFavoriteListResponse> {
    const bankResult = await this.db
      .select({ id: questionBank.id, appUserId: questionBank.appUserId, isPublic: questionBank.isPublic })
      .from(questionBank)
      .where(eq(questionBank.id, bankId));
    if (bankResult.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    const bank = bankResult[0];
    const isOwner = bank.appUserId === appUserId;
    const isPublicBank = Boolean(bank.isPublic);
    if (!isOwner && !isPublicBank) {
      throw new NotFoundException('题集不存在');
    }

    const questionRows = await this.db
      .select()
      .from(question)
      .where(eq(question.bankId, bankId))
      .orderBy(question.createdAt);

    if (questionRows.length === 0) {
      return { items: [] };
    }

    const questionIds = questionRows.map((q) => q.id);
    const stateRows = await this.db
      .select({
        questionId: userQuestionState.questionId,
        isFavorited: userQuestionState.isFavorited,
        wrongCount: userQuestionState.wrongCount,
        mastered: userQuestionState.mastered,
      })
      .from(userQuestionState)
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        inArray(userQuestionState.questionId, questionIds),
      ));

    const stateMap = new Map(stateRows.map((s) => [s.questionId, s]));

    const items: QuestionWithFavorite[] = questionRows.map((row) => {
      const state = stateMap.get(row.id);
      return {
        id: row.id,
        content: row.content,
        questionType: row.questionType as QuestionType,
        options: row.options as unknown as QuestionOption[],
        correctAnswers: row.correctAnswers as unknown as number[],
        analysis: row.analysis,
        isFavorited: state ? Boolean(state.isFavorited) : false,
        wrongCount: state ? state.wrongCount : 0,
        mastered: state ? Boolean(state.mastered) : false,
        subQuestions: (row.subQuestions as unknown as SubQuestion[]) ?? [],
        knowledgePoints: row.knowledgePoints ?? '',
        unitName: row.unitName ?? null,
        sortOrder: row.sortOrder ?? 0,
      };
    });

    return { items };
  }

  async updateFavorite(
    appUserId: string,
    questionId: string,
    isFavorited: boolean,
  ): Promise<{ success: boolean; isFavorited: boolean }> {
    const q = await this.db
      .select({ id: question.id })
      .from(question)
      .where(and(eq(question.id, questionId), eq(question.appUserId, appUserId)));
    if (q.length === 0) {
      throw new NotFoundException('题目不存在');
    }

    const existing = await this.db
      .select({ id: userQuestionState.id, isFavorited: userQuestionState.isFavorited })
      .from(userQuestionState)
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        eq(userQuestionState.questionId, questionId),
      ));

    if (existing.length > 0) {
      await this.db
        .update(userQuestionState)
        .set({ isFavorited })
        .where(eq(userQuestionState.id, existing[0].id));
    } else if (isFavorited) {
      await this.db.insert(userQuestionState).values({
        userId: sql`ROW(${appUserId})::user_profile`,
        appUserId,
        questionId,
        isFavorited: true,
      });
    }

    return { success: true, isFavorited };
  }

  async getFavoriteQuestions(
    appUserId: string,
  ): Promise<QuestionWithFavoriteListResponse> {
    const rows = await this.db
      .select({
        id: question.id,
        bankId: question.bankId,
        content: question.content,
        questionType: question.questionType,
        options: question.options,
        correctAnswers: question.correctAnswers,
        analysis: question.analysis,
        subQuestions: question.subQuestions,
        knowledgePoints: question.knowledgePoints,
        unitName: question.unitName,
        sortOrder: question.sortOrder,
        wrongCount: userQuestionState.wrongCount,
        mastered: userQuestionState.mastered,
      })
      .from(userQuestionState)
      .innerJoin(question, eq(userQuestionState.questionId, question.id))
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        eq(userQuestionState.isFavorited, true),
      ))
      .orderBy(desc(userQuestionState.id));

    const items: QuestionWithFavorite[] = rows.map((row) => ({
      id: row.id,
      content: row.content,
      questionType: row.questionType as QuestionType,
      options: row.options as unknown as QuestionOption[],
      correctAnswers: row.correctAnswers as unknown as number[],
      analysis: row.analysis,
      isFavorited: true,
      wrongCount: row.wrongCount || 0,
      mastered: Boolean(row.mastered),
      subQuestions: (row.subQuestions as unknown as SubQuestion[]) ?? [],
      knowledgePoints: row.knowledgePoints ?? '',
      unitName: row.unitName ?? null,
      sortOrder: row.sortOrder ?? 0,
    }));

    return { items };
  }

  async getFavoriteCount(appUserId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(userQuestionState)
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        eq(userQuestionState.isFavorited, true),
      ));
    return Number(result[0]?.count || 0);
  }

  async exportFavoriteQuestions(
    appUserId: string,
    _params: { format: string },
  ): Promise<QuestionWithFavoriteListResponse> {
    const rows = await this.db
      .select({
        id: question.id,
        bankId: question.bankId,
        content: question.content,
        questionType: question.questionType,
        options: question.options,
        correctAnswers: question.correctAnswers,
        analysis: question.analysis,
        subQuestions: question.subQuestions,
        knowledgePoints: question.knowledgePoints,
        unitName: question.unitName,
        sortOrder: question.sortOrder,
        wrongCount: userQuestionState.wrongCount,
        mastered: userQuestionState.mastered,
        note: userQuestionState.note,
        wrongReason: userQuestionState.wrongReason,
      })
      .from(userQuestionState)
      .innerJoin(question, eq(userQuestionState.questionId, question.id))
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        eq(userQuestionState.isFavorited, true),
      ))
      .orderBy(desc(userQuestionState.id));

    const items: QuestionWithFavorite[] = rows.map((row) => ({
      id: row.id,
      content: row.content,
      questionType: row.questionType as QuestionType,
      options: row.options as unknown as QuestionOption[],
      correctAnswers: row.correctAnswers as unknown as number[],
      analysis: row.analysis,
      isFavorited: true,
      wrongCount: row.wrongCount || 0,
      mastered: Boolean(row.mastered),
      subQuestions: (row.subQuestions as unknown as SubQuestion[]) ?? [],
      note: row.note ?? null,
      wrongReason: (row.wrongReason as WrongReason | null) ?? null,
      knowledgePoints: row.knowledgePoints ?? '',
      unitName: row.unitName ?? null,
      sortOrder: row.sortOrder ?? 0,
    }));

    return { items };
  }

  async getWrongBookQuestions(
    appUserId: string,
  ): Promise<QuestionWithFavoriteListResponse> {
    const rows = await this.db
      .select({
        id: question.id,
        bankId: question.bankId,
        content: question.content,
        questionType: question.questionType,
        options: question.options,
        correctAnswers: question.correctAnswers,
        analysis: question.analysis,
        subQuestions: question.subQuestions,
        knowledgePoints: question.knowledgePoints,
        unitName: question.unitName,
        sortOrder: question.sortOrder,
        isFavorited: userQuestionState.isFavorited,
        wrongCount: userQuestionState.wrongCount,
        mastered: userQuestionState.mastered,
      })
      .from(userQuestionState)
      .innerJoin(question, eq(userQuestionState.questionId, question.id))
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        sql`${userQuestionState.wrongCount} > 0`,
        eq(userQuestionState.mastered, false),
      ))
      .orderBy(desc(userQuestionState.lastWrongAt));

    const items: QuestionWithFavorite[] = rows.map((row) => ({
      id: row.id,
      content: row.content,
      questionType: row.questionType as QuestionType,
      options: row.options as unknown as QuestionOption[],
      correctAnswers: row.correctAnswers as unknown as number[],
      analysis: row.analysis,
      isFavorited: Boolean(row.isFavorited),
      wrongCount: row.wrongCount || 0,
      mastered: Boolean(row.mastered),
      subQuestions: (row.subQuestions as unknown as SubQuestion[]) ?? [],
      knowledgePoints: row.knowledgePoints ?? '',
      unitName: row.unitName ?? null,
      sortOrder: row.sortOrder ?? 0,
    }));

    return { items };
  }

  async removeFromWrongBook(
    appUserId: string,
    questionId: string,
  ): Promise<{ success: boolean; removed: boolean }> {
    const q = await this.db
      .select({ id: question.id })
      .from(question)
      .where(eq(question.id, questionId));
    if (q.length === 0) {
      throw new NotFoundException('题目不存在');
    }

    const existing = await this.db
      .select({
        id: userQuestionState.id,
        isFavorited: userQuestionState.isFavorited,
        mastered: userQuestionState.mastered,
      })
      .from(userQuestionState)
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        eq(userQuestionState.questionId, questionId),
      ));

    if (existing.length === 0) {
      return { success: true, removed: false };
    }

    const state = existing[0];
    const hasOtherState = state.isFavorited || state.mastered;

    if (hasOtherState) {
      await this.db
        .update(userQuestionState)
        .set({ wrongCount: 0, lastWrongAt: null })
        .where(eq(userQuestionState.id, state.id));
    } else {
      await this.db
        .delete(userQuestionState)
        .where(eq(userQuestionState.id, state.id));
    }

    return { success: true, removed: true };
  }

  async getWrongCount(appUserId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(userQuestionState)
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        sql`${userQuestionState.wrongCount} > 0`,
        eq(userQuestionState.mastered, false),
      ));
    return Number(result[0]?.count || 0);
  }

  async getImportantWrongBookQuestions(
    appUserId: string,
  ): Promise<QuestionWithFavoriteListResponse> {
    const rows = await this.db
      .select({
        id: question.id,
        bankId: question.bankId,
        content: question.content,
        questionType: question.questionType,
        options: question.options,
        correctAnswers: question.correctAnswers,
        analysis: question.analysis,
        subQuestions: question.subQuestions,
        knowledgePoints: question.knowledgePoints,
        unitName: question.unitName,
        sortOrder: question.sortOrder,
        isFavorited: userQuestionState.isFavorited,
        wrongCount: userQuestionState.wrongCount,
        mastered: userQuestionState.mastered,
        attemptCount: userQuestionState.attemptCount,
      })
      .from(userQuestionState)
      .innerJoin(question, eq(userQuestionState.questionId, question.id))
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        eq(userQuestionState.mastered, false),
        sql`${userQuestionState.attemptCount} >= 2`,
        sql`(
          ${userQuestionState.wrongCount} >= 2
          OR ${userQuestionState.wrongCount}::numeric / NULLIF(${userQuestionState.attemptCount}, 0)::numeric > 0.5
        )`,
      ))
      .orderBy(desc(userQuestionState.lastWrongAt));

    const items: QuestionWithFavorite[] = rows.map((row) => ({
      id: row.id,
      content: row.content,
      questionType: row.questionType as QuestionType,
      options: row.options as unknown as QuestionOption[],
      correctAnswers: row.correctAnswers as unknown as number[],
      analysis: row.analysis,
      isFavorited: Boolean(row.isFavorited),
      wrongCount: row.wrongCount || 0,
      mastered: Boolean(row.mastered),
      subQuestions: (row.subQuestions as unknown as SubQuestion[]) ?? [],
      knowledgePoints: row.knowledgePoints ?? '',
      unitName: row.unitName ?? null,
      sortOrder: row.sortOrder ?? 0,
    }));

    return { items };
  }

  async getImportantWrongCount(appUserId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(userQuestionState)
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        eq(userQuestionState.mastered, false),
        sql`${userQuestionState.attemptCount} >= 2`,
        sql`(
          ${userQuestionState.wrongCount} >= 2
          OR ${userQuestionState.wrongCount}::numeric / NULLIF(${userQuestionState.attemptCount}, 0)::numeric > 0.5
        )`,
      ));
    return Number(result[0]?.count || 0);
  }

  async markQuestionMastered(
    appUserId: string,
    questionId: string,
    mastered: boolean,
  ): Promise<{ success: boolean }> {
    const q = await this.db
      .select({ id: question.id })
      .from(question)
      .where(eq(question.id, questionId));
    if (q.length === 0) {
      throw new NotFoundException('题目不存在');
    }

    const existing = await this.db
      .select({ id: userQuestionState.id })
      .from(userQuestionState)
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        eq(userQuestionState.questionId, questionId),
      ));

    if (existing.length > 0) {
      await this.db
        .update(userQuestionState)
        .set({ mastered })
        .where(eq(userQuestionState.id, existing[0].id));
    } else if (mastered) {
      await this.db.insert(userQuestionState).values({
        userId: sql`ROW(${appUserId})::user_profile`,
        appUserId,
        questionId,
        isFavorited: false,
        wrongCount: 0,
        mastered: true,
      });
    }

    return { success: true };
  }

  private parseRow(row: Record<string, unknown>): {
    content: string;
    questionType: string;
    options: QuestionOption[];
    correctAnswers: number[];
    analysis: string;
    subQuestions: SubQuestion[];
  } {
    const content = this.getStringField(row, ['题干', 'content', 'question', 'title', '题目']);
    if (!content) {
      throw new Error('缺少题干');
    }

    const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const options: QuestionOption[] = [];

    for (const label of optionLabels) {
      const text = this.getStringField(row, [`选项${label}`, `${label}选项`, `option_${label.toLowerCase()}`, `${label}选项`, label.toLowerCase()]);
      if (text) {
        options.push({ label, text });
      }
    }

    if (options.length === 0) {
      const optionsField = this.getField(row, ['options', '选项', 'choices', '选择项']);
      if (optionsField) {
        if (Array.isArray(optionsField)) {
          optionsField.forEach((opt: unknown, idx: number) => {
            if (typeof opt === 'string') {
              options.push({ label: optionLabels[idx] || String(idx + 1), text: opt });
            } else if (opt && typeof opt === 'object') {
              const o = opt as { label?: string; text?: string };
              options.push({
                label: o.label || optionLabels[idx] || String(idx + 1),
                text: o.text || '',
              });
            }
          });
        } else if (typeof optionsField === 'string') {
          try {
            const parsed = JSON.parse(optionsField);
            if (Array.isArray(parsed)) {
              parsed.forEach((opt: unknown, idx: number) => {
                if (typeof opt === 'string') {
                  options.push({ label: optionLabels[idx] || String(idx + 1), text: opt });
                } else if (opt && typeof opt === 'object') {
                  const o = opt as { label?: string; text?: string };
                  options.push({
                    label: o.label || optionLabels[idx] || String(idx + 1),
                    text: o.text || '',
                  });
                }
              });
            }
          } catch {
            // 忽略解析失败
          }
        }
      }
    }

    if (options.length < 2) {
      throw new Error('选项不足 2 个（需至少包含选项A/B 或 options 数组）');
    }

    let correctAnswers: number[] = [];

    const correctAnswersField = this.getField(row, ['correct_answers', 'correctAnswers', '正确答案', '答案', 'answer', 'correctAnswer']);
    if (correctAnswersField !== undefined && correctAnswersField !== null) {
      if (Array.isArray(correctAnswersField)) {
        for (const item of correctAnswersField) {
          if (typeof item === 'number') {
            correctAnswers.push(item);
          } else if (typeof item === 'string') {
            const idx = this.parseAnswerIndex(item.trim(), options);
            if (idx >= 0) correctAnswers.push(idx);
          }
        }
      } else if (typeof correctAnswersField === 'string') {
        const cleaned = correctAnswersField.trim();
        if (cleaned !== '') {
          const parts = cleaned.split(/[\s,，、;；]+/).filter(Boolean);
          for (const part of parts) {
            const idx = this.parseAnswerIndex(part, options);
            if (idx >= 0) correctAnswers.push(idx);
          }
        }
      } else if (typeof correctAnswersField === 'number') {
        correctAnswers.push(correctAnswersField);
      }
    }

    const typeField = this.getStringField(row, ['题型', 'type', 'questionType', 'question_type']);
    let questionType: string = correctAnswers.length === 1 ? 'single' : 'multiple';
    if (typeField) {
      const t = typeField.toLowerCase().trim();
      if (t === 'single' || t.includes('单选')) {
        questionType = 'single';
      } else if (t === 'multiple' || t.includes('多选')) {
        questionType = 'multiple';
      } else if (t === 'b1' || t.includes('配伍') || t.includes('b1型')) {
        questionType = 'b1';
      } else if (t.includes('填空') || t === 'fill' || t === 'blank' || t === 'fill_blank') {
        throw new Error('暂不支持填空题，请使用单选题、多选题或B1型配伍题格式');
      } else if (t.includes('判断') || t === 'judge' || t === 'true_false' || t === 'boolean') {
        throw new Error('暂不支持判断题，请使用单选题格式（选项为"正确/错误"）');
      }
    }

    const analysis = this.getStringField(row, ['解析', 'analysis', 'explanation', '解析说明', '答案解析']) || '';

    let subQuestions: SubQuestion[] = [];
    const subQField = this.getField(row, ['subQuestions', 'sub_questions', '子问题', '子题目', '配伍问题']);
    if (subQField && typeof subQField === 'string') {
      try {
        const parsed = JSON.parse(subQField);
        if (Array.isArray(parsed)) subQuestions = parsed as SubQuestion[];
      } catch {
        // 忽略解析失败
      }
    } else if (subQField && Array.isArray(subQField)) {
      subQuestions = subQField as SubQuestion[];
    }

    correctAnswers = correctAnswers.filter((n) => typeof n === 'number' && !isNaN(n));
    if (correctAnswers.length > 0 && correctAnswers.some((idx) => idx < 0 || idx >= options.length)) {
      const outOfRange = correctAnswers.filter((i) => i < 0 || i >= options.length);
      throw new Error(`正确答案索引超出选项范围：[${outOfRange.join(', ')}]，共 ${options.length} 个选项`);
    }

    if (questionType === 'b1') {
      if (subQuestions.length === 0) {
        throw new Error('B1型题需要提供 subQuestions 子问题列表');
      }
      for (let i = 0; i < subQuestions.length; i += 1) {
        const sq = subQuestions[i];
        if (!sq.content || sq.correctAnswer === undefined || sq.correctAnswer === null || sq.correctAnswer === '') {
          throw new Error(`B1型题第 ${i + 1} 个子问题缺少题干或正确答案`);
        }
        const ans = String(sq.correctAnswer).trim();
        let optIdx = options.findIndex((o: QuestionOption) => o.label.toUpperCase() === ans.toUpperCase());
        if (optIdx < 0) {
          const num = Number(ans);
          if (!isNaN(num) && Number.isInteger(num) && num >= 1 && num <= options.length) {
            optIdx = num - 1;
          }
        }
        if (optIdx < 0) {
          throw new Error(`B1型题第 ${i + 1} 个子问题的正确答案「${sq.correctAnswer}」不在选项中`);
        }
      }
      correctAnswers = [];
    } else if (questionType === 'single') {
      if (correctAnswers.length !== 1) {
        throw new Error(`单选题只能有 1 个正确答案，当前有 ${correctAnswers.length} 个`);
      }
    } else if (correctAnswers.length === 0) {
      throw new Error('缺少正确答案（支持字母A/B、数字序号或数字索引数组）');
    }

    return {
      content,
      questionType,
      options,
      correctAnswers,
      analysis,
      subQuestions,
    };
  }

  private getStringField(row: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const val = row[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
    return '';
  }

  private getField(row: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (row[key] !== undefined) {
        return row[key];
      }
    }
    return undefined;
  }

  private parseAnswerIndex(
    value: string,
    options: QuestionOption[],
  ): number {
    if (!value) return -1;
    const upper = value.toUpperCase();
    const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    for (let i = 0; i < options.length; i++) {
      if (options[i].label && options[i].label.toUpperCase() === upper) {
        return i;
      }
    }
    const letterIdx = optionLabels.indexOf(upper);
    if (letterIdx >= 0 && letterIdx < options.length) {
      return letterIdx;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= options.length) {
      return num - 1;
    }
    return -1;
  }

  // ==================== 题库编辑权限与批量操作 ====================

  /**
   * 校验用户是否有题库编辑权限（所有者 / 协作者 / admin）
   * TODO: 协作模块会复用
   */
  private async ensureBankEditPermission(
    appUserId: string,
    bankId: string,
  ): Promise<void> {
    const userRows = await this.db
      .select({ role: appUser.role })
      .from(appUser)
      .where(eq(appUser.id, appUserId))
      .limit(1);
    if (userRows.length > 0 && userRows[0].role === 'admin') {
      return;
    }

    const bankRows = await this.db
      .select({ id: questionBank.id, appUserId: questionBank.appUserId })
      .from(questionBank)
      .where(eq(questionBank.id, bankId))
      .limit(1);
    if (bankRows.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    if (bankRows[0].appUserId === appUserId) {
      return;
    }

    const collabRows = await this.db
      .select({ id: questionBankCollaborator.id })
      .from(questionBankCollaborator)
      .where(and(
        eq(questionBankCollaborator.bankId, bankId),
        eq(questionBankCollaborator.appUserId, appUserId),
      ))
      .limit(1);
    if (collabRows.length > 0) {
      return;
    }

    throw new ForbiddenException('无权编辑该题集');
  }

  /**
   * 批量删除题目
   */
  async batchDeleteQuestions(
    appUserId: string,
    bankId: string,
    dto: BatchDeleteQuestionsRequest,
  ): Promise<BatchDeleteQuestionsResponse> {
    if (!bankId) {
      throw new BadRequestException('题集ID不能为空');
    }
    const questionIds = dto.questionIds || [];
    if (questionIds.length === 0) {
      return { successCount: 0, failCount: 0 };
    }

    await this.ensureBankEditPermission(appUserId, bankId);

    const total = questionIds.length;
    let successCount = 0;

    try {
      const deleted = await this.db
        .delete(question)
        .where(and(
          eq(question.bankId, bankId),
          inArray(question.id, questionIds),
        ))
        .returning({ id: question.id });
      successCount = deleted.length;

      if (successCount > 0) {
        await this.db
          .update(questionBank)
          .set({ questionCount: sql`${questionBank.questionCount} - ${successCount}` })
          .where(eq(questionBank.id, bankId));
      }
    } catch (error) {
      this.logger.error(
        `批量删除题目失败: bankId=${bankId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }

    return {
      successCount,
      failCount: total - successCount,
    };
  }

  /**
   * 按条件查询受影响的题目列表（用于预览和执行）
   */
  private async queryAffectedQuestions(
    bankId: string,
    dto: BatchReplaceRequest,
  ): Promise<Array<typeof question.$inferSelect>> {
    const conditions = [eq(question.bankId, bankId)];
    if (dto.knowledgePoint && dto.knowledgePoint.trim()) {
      conditions.push(
        sql`${question.knowledgePoints} ILIKE ${'%' + dto.knowledgePoint.trim() + '%'}` as unknown as ReturnType<typeof eq>,
      );
    }
    return this.db.select().from(question).where(and(...conditions)).orderBy(question.createdAt);
  }

  /**
   * 批量替换预览
   */
  async batchReplacePreview(
    appUserId: string,
    bankId: string,
    dto: BatchReplaceRequest,
  ): Promise<BatchReplacePreviewResponse> {
    if (!bankId) {
      throw new BadRequestException('题集ID不能为空');
    }

    await this.ensureBankEditPermission(appUserId, bankId);

    // 先查总数
    const countResult = await this.db
      .select({ count: count() })
      .from(question)
      .where(this.buildBatchWhere(bankId, dto));
    const affectedCount = Number(countResult[0]?.count ?? 0);

    // 前 5 题样例
    const sampleRows = await this.db
      .select()
      .from(question)
      .where(this.buildBatchWhere(bankId, dto))
      .orderBy(question.createdAt)
      .limit(5);

    const sampleQuestions: QuestionItem[] = sampleRows.map((row) => ({
      id: row.id,
      content: row.content,
      questionType: row.questionType as QuestionType,
      options: row.options as unknown as QuestionOption[],
      correctAnswers: row.correctAnswers as unknown as number[],
      analysis: row.analysis,
      subQuestions: row.subQuestions as unknown as SubQuestion[],
      knowledgePoints: row.knowledgePoints,
      unitName: row.unitName,
      sortOrder: row.sortOrder,
    }));

    return { affectedCount, sampleQuestions };
  }

  private buildBatchWhere(
    bankId: string,
    dto: BatchReplaceRequest,
  ): ReturnType<typeof and> {
    const conditions: ReturnType<typeof eq>[] = [eq(question.bankId, bankId)];
    if (dto.knowledgePoint && dto.knowledgePoint.trim()) {
      conditions.push(
        sql`${question.knowledgePoints} ILIKE ${'%' + dto.knowledgePoint.trim() + '%'}` as unknown as ReturnType<typeof eq>,
      );
    }
    return and(...conditions);
  }

  /**
   * 批量替换执行
   */
  async batchReplace(
    appUserId: string,
    bankId: string,
    dto: BatchReplaceRequest,
  ): Promise<BatchReplaceResponse> {
    if (!bankId) {
      throw new BadRequestException('题集ID不能为空');
    }

    const hasAnyOp = !!(dto.analysisTemplate || (dto.replaceTextFrom && dto.replaceTextTo !== undefined) ||
      (dto.addTags && dto.addTags.length > 0) || (dto.removeTags && dto.removeTags.length > 0));
    if (!hasAnyOp) {
      throw new BadRequestException('请至少指定一项批量操作');
    }

    await this.ensureBankEditPermission(appUserId, bankId);

    const questions = await this.db
      .select()
      .from(question)
      .where(this.buildBatchWhere(bankId, dto))
      .orderBy(question.createdAt);

    const total = questions.length;
    const failReasons: { questionId: string; reason: string }[] = [];
    let successCount = 0;

    // 预准备标签（addTags 中的标签不存在时先创建）
    let addTagIds: string[] = [];
    if (dto.addTags && dto.addTags.length > 0) {
      addTagIds = await this.ensureTagsExist(appUserId, dto.addTags);
    }
    let removeTagIds: string[] = [];
    if (dto.removeTags && dto.removeTags.length > 0) {
      removeTagIds = await this.getTagIdsByName(dto.removeTags);
    }

    for (const q of questions) {
      try {
        await this.db.transaction(async (tx) => {
          const patch: Partial<typeof question.$inferInsert> = {};

          // 1. 批量替换解析模板
          if (dto.analysisTemplate !== undefined) {
            const newAnalysis = dto.analysisTemplate.replace(/\{\{analysis\}\}/g, q.analysis);
            patch.analysis = newAnalysis;
          }

          // 2. 文本替换（题干 + 选项文本）
          if (dto.replaceTextFrom && dto.replaceTextTo !== undefined) {
            const from = dto.replaceTextFrom;
            const to = dto.replaceTextTo;
            if (from !== '') {
              patch.content = q.content.split(from).join(to);
              const opts = q.options as unknown as QuestionOption[];
              patch.options = opts.map((opt: QuestionOption) => ({
                ...opt,
                text: opt.text.split(from).join(to),
              })) as unknown as Record<string, unknown>[];
            }
          }

          if (Object.keys(patch).length > 0) {
            await tx
              .update(question)
              .set(patch)
              .where(eq(question.id, q.id));
          }

          // 3. 批量添加标签
          if (addTagIds.length > 0) {
            for (const tagId of addTagIds) {
              await tx
                .insert(questionTagRel)
                .values({
                  questionId: q.id,
                  tagId,
                  appUserId,
                })
                .onConflictDoNothing({
                  target: [questionTagRel.questionId, questionTagRel.tagId],
                });
            }
          }

          // 4. 批量移除标签
          if (removeTagIds.length > 0) {
            await tx
              .delete(questionTagRel)
              .where(and(
                eq(questionTagRel.questionId, q.id),
                inArray(questionTagRel.tagId, removeTagIds),
              ));
          }
        });
        successCount += 1;
      } catch (err) {
        failReasons.push({
          questionId: q.id,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (successCount > 0) {
      this.createVersionSnapshot(bankId, appUserId, `批量替换 ${successCount} 题`);
    }

    return {
      successCount,
      failCount: total - successCount,
      failReasons,
    };
  }

  private async createVersionSnapshot(
    bankId: string,
    appUserId: string,
    changeSummary: string,
  ): Promise<number> {
    try {
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

      const snapshot = { questions: questionRows };

      const maxResult = await this.db
        .select({ max: max(questionBankVersion.versionNumber) })
        .from(questionBankVersion)
        .where(eq(questionBankVersion.bankId, bankId));
      const currentMax = Number(maxResult[0]?.max ?? 0);
      const newVersionNumber = currentMax + 1;

      await this.db.insert(questionBankVersion).values({
        bankId,
        versionNumber: newVersionNumber,
        snapshot: snapshot as unknown as typeof questionBankVersion.$inferInsert.snapshot,
        changeSummary,
        questionCount: questionRows.length,
        appUserId,
      });

      const MAX_VERSIONS = 20;
      const countResult = await this.db
        .select({ count: count() })
        .from(questionBankVersion)
        .where(eq(questionBankVersion.bankId, bankId));
      const totalVersions = Number(countResult[0]?.count ?? 0);

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
    } catch (err) {
      this.logger.error(`创建版本快照失败: ${JSON.stringify({ bankId, changeSummary, error: (err as Error).message })}`);
      return 0;
    }
  }

  /**
   * 确保标签存在，返回标签 ID 列表（不存在则创建）
   */
  private async ensureTagsExist(appUserId: string, tagNames: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const name of tagNames) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      const existing = await this.db
        .select({ id: questionTag.id })
        .from(questionTag)
        .where(eq(questionTag.name, trimmed))
        .limit(1);
      if (existing.length > 0) {
        ids.push(existing[0].id);
      } else {
        const [created] = await this.db
          .insert(questionTag)
          .values({ name: trimmed, appUserId })
          .onConflictDoNothing({ target: [questionTag.name] })
          .returning({ id: questionTag.id });
        if (created) {
          ids.push(created.id);
        } else {
          const again = await this.db
            .select({ id: questionTag.id })
            .from(questionTag)
            .where(eq(questionTag.name, trimmed))
            .limit(1);
          if (again.length > 0) ids.push(again[0].id);
        }
      }
    }
    return ids;
  }

  /**
   * 按标签名获取标签 ID 列表（仅返回存在的）
   */
  private async getTagIdsByName(tagNames: string[]): Promise<string[]> {
    const trimmedNames = tagNames.map((n) => n.trim()).filter((n) => n.length > 0);
    if (trimmedNames.length === 0) return [];
    const rows = await this.db
      .select({ id: questionTag.id })
      .from(questionTag)
      .where(inArray(questionTag.name, trimmedNames));
    return rows.map((r) => r.id);
  }
}
