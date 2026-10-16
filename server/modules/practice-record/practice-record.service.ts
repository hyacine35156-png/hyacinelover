import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, desc, count, sql, and, gte, lt, inArray } from 'drizzle-orm';
import * as ExcelJS from 'exceljs';

import {
  practiceRecord,
  practiceAnswer,
  question,
  questionBank,
  userQuestionState,
  dailyAnswerRecord,
} from '@server/database/schema';
import type {
  PracticeRecordItem,
  PracticeRecordDetailAnswer,
  PracticeStatisticsResponse,
  CreatePracticeRecordRequest,
  CreatePracticeRecordResponse,
  PracticeRecordListResponse,
  PracticeRecordDetailResponse,
  PracticeSessionProgressResponse,
  PracticeAnswerProgressItem,
  CreatePracticeSessionRequest,
  SaveAnswerProgressRequest,
  FinishPracticeSessionRequest,
  SaveBatchProgressRequest,
  ClearSubsequentAnswersRequest,
  QuestionType,
  SubQuestion,
  PracticeMode,
  QuestionOption,
  PracticeAnswerExportItem,
  PracticeExportFormat,
  PracticeExportRange,
} from '@shared/api.interface';

@Injectable()
export class PracticeRecordService {
  private readonly logger = new Logger(PracticeRecordService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async createSession(
    appUserId: string,
    dto: CreatePracticeSessionRequest,
  ): Promise<PracticeSessionProgressResponse> {
    if (!dto.bankId) {
      throw new BadRequestException('题集ID不能为空');
    }
    if (dto.totalCount <= 0) {
      throw new BadRequestException('题目数量不能为0');
    }

    const bankResult = await this.db
      .select({ id: questionBank.id, appUserId: questionBank.appUserId, isPublic: questionBank.isPublic })
      .from(questionBank)
      .where(eq(questionBank.id, dto.bankId));
    if (bankResult.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    const bank = bankResult[0];
    if (bank.appUserId !== appUserId && !bank.isPublic) {
      throw new NotFoundException('题集不存在');
    }

    const mode: PracticeMode = dto.practiceMode ?? 'basic';

    const [record] = await this.db
      .insert(practiceRecord)
      .values({
        bankId: dto.bankId,
        userId: sql`ROW(${appUserId})::user_profile`,
        appUserId,
        totalCount: dto.totalCount,
        correctCount: 0,
        accuracyRate: '0',
        durationSeconds: 0,
        status: 'in_progress',
        currentIndex: 0,
        startedAt: new Date(),
        finishedAt: null,
        practiceMode: mode,
      })
      .returning({
        id: practiceRecord.id,
        bankId: practiceRecord.bankId,
        status: practiceRecord.status,
        currentIndex: practiceRecord.currentIndex,
        totalCount: practiceRecord.totalCount,
        correctCount: practiceRecord.correctCount,
        startedAt: practiceRecord.startedAt,
        durationSeconds: practiceRecord.durationSeconds,
        practiceMode: practiceRecord.practiceMode,
      });

    return {
      recordId: record.id,
      bankId: record.bankId,
      status: record.status as 'in_progress' | 'finished',
      currentIndex: record.currentIndex,
      totalCount: record.totalCount,
      correctCount: record.correctCount,
      startedAt: record.startedAt.toISOString(),
      durationSeconds: record.durationSeconds,
      orderMode: 'original',
      practiceMode: record.practiceMode as PracticeMode,
      questionIds: [],
      answers: [],
    };
  }

  async getActiveSession(
    appUserId: string,
    bankId: string,
  ): Promise<PracticeSessionProgressResponse | null> {
    const records = await this.db
      .select({
        id: practiceRecord.id,
        bankId: practiceRecord.bankId,
        status: practiceRecord.status,
        currentIndex: practiceRecord.currentIndex,
        totalCount: practiceRecord.totalCount,
        correctCount: practiceRecord.correctCount,
        startedAt: practiceRecord.startedAt,
        durationSeconds: practiceRecord.durationSeconds,
        practiceMode: practiceRecord.practiceMode,
      })
      .from(practiceRecord)
      .where(and(
        eq(practiceRecord.appUserId, appUserId),
        eq(practiceRecord.bankId, bankId),
        eq(practiceRecord.status, 'in_progress'),
      ))
      .orderBy(desc(practiceRecord.startedAt))
      .limit(1);

    if (records.length === 0) return null;

    const record = records[0];

    const answers = await this.db
      .select({
        questionId: practiceAnswer.questionId,
        userAnswers: practiceAnswer.userAnswers,
        isCorrect: practiceAnswer.isCorrect,
      })
      .from(practiceAnswer)
      .where(eq(practiceAnswer.recordId, record.id));

    const answerItems: PracticeAnswerProgressItem[] = answers.map((a, idx) => ({
      questionId: a.questionId,
      questionIndex: idx,
      userAnswers: a.userAnswers as unknown as number[],
      isCorrect: a.isCorrect,
    }));

    return {
      recordId: record.id,
      bankId: record.bankId,
      status: record.status as 'in_progress' | 'finished',
      currentIndex: record.currentIndex,
      totalCount: record.totalCount,
      correctCount: record.correctCount,
      startedAt: record.startedAt.toISOString(),
      durationSeconds: record.durationSeconds,
      orderMode: 'original',
      practiceMode: record.practiceMode as PracticeMode,
      questionIds: answerItems.map((a) => a.questionId),
      answers: answerItems,
    };
  }

  async saveAnswerProgress(
    appUserId: string,
    dto: SaveAnswerProgressRequest,
  ): Promise<{ success: boolean }> {
    if (!dto.recordId) {
      throw new BadRequestException('记录ID不能为空');
    }

    const records = await this.db
      .select({
        id: practiceRecord.id,
        status: practiceRecord.status,
      })
      .from(practiceRecord)
      .where(and(eq(practiceRecord.id, dto.recordId), eq(practiceRecord.appUserId, appUserId)));

    if (records.length === 0) {
      throw new NotFoundException('练习记录不存在');
    }

    const record = records[0];
    if (record.status !== 'in_progress') {
      throw new ConflictException('练习已完成，无法继续保存');
    }

    const existing = await this.db
      .select({ id: practiceAnswer.id })
      .from(practiceAnswer)
      .where(and(
        eq(practiceAnswer.recordId, dto.recordId),
        eq(practiceAnswer.questionId, dto.questionId),
      ));

    if (existing.length > 0) {
      const updateData: Record<string, unknown> = {
        userAnswers: dto.userAnswers as unknown as number[],
        isCorrect: dto.isCorrect,
      };
      if (dto.durationSeconds !== undefined && dto.durationSeconds > 0) {
        updateData.durationSeconds = dto.durationSeconds;
      }
      await this.db
        .update(practiceAnswer)
        .set(updateData)
        .where(eq(practiceAnswer.id, existing[0].id));
    } else {
      await this.db.insert(practiceAnswer).values({
        recordId: dto.recordId,
        questionId: dto.questionId,
        userAnswers: dto.userAnswers as unknown as number[],
        isCorrect: dto.isCorrect,
        appUserId,
        durationSeconds: dto.durationSeconds ?? 0,
      });
    }

    const answerCountResult = await this.db
      .select({ count: count() })
      .from(practiceAnswer)
      .where(eq(practiceAnswer.recordId, dto.recordId));

    const correctCountResult = await this.db
      .select({ count: count() })
      .from(practiceAnswer)
      .where(and(
        eq(practiceAnswer.recordId, dto.recordId),
        eq(practiceAnswer.isCorrect, true),
      ));

    const correctCount = Number(correctCountResult[0]?.count || 0);
    const answeredCount = Number(answerCountResult[0]?.count || 0);
    const accuracyRate = answeredCount > 0 ? correctCount / answeredCount : 0;

    await this.db
      .update(practiceRecord)
      .set({
        currentIndex: dto.currentIndex,
        correctCount,
        accuracyRate: String(accuracyRate),
      })
      .where(and(eq(practiceRecord.id, dto.recordId), eq(practiceRecord.appUserId, appUserId)));

    await this.syncWrongBook(appUserId, dto.recordId);

    return { success: true };
  }

  async saveBatchProgress(
    appUserId: string,
    dto: SaveBatchProgressRequest,
  ): Promise<{ success: boolean }> {
    if (!dto.recordId) {
      throw new BadRequestException('记录ID不能为空');
    }
    if (!Array.isArray(dto.answers)) {
      throw new BadRequestException('作答数据格式错误');
    }

    const records = await this.db
      .select({
        id: practiceRecord.id,
        status: practiceRecord.status,
        practiceMode: practiceRecord.practiceMode,
      })
      .from(practiceRecord)
      .where(and(eq(practiceRecord.id, dto.recordId), eq(practiceRecord.appUserId, appUserId)));

    if (records.length === 0) {
      throw new NotFoundException('练习记录不存在');
    }

    const record = records[0];
    if (record.status !== 'in_progress') {
      throw new ConflictException('练习已完成，无法继续保存');
    }

    const isReciteMode = record.practiceMode === 'recite';

    if (!isReciteMode && dto.answers.length > 0) {
      const existingAnswers = await this.db
        .select({ id: practiceAnswer.id, questionId: practiceAnswer.questionId })
        .from(practiceAnswer)
        .where(eq(practiceAnswer.recordId, dto.recordId));

      const existingMap = new Map(existingAnswers.map((a) => [a.questionId, a.id]));

      const toInsert = dto.answers.filter((a) => !existingMap.has(a.questionId));
      const toUpdate = dto.answers.filter((a) => existingMap.has(a.questionId));

      if (toInsert.length > 0) {
        await this.db.insert(practiceAnswer).values(
          toInsert.map((a) => ({
            recordId: dto.recordId,
            questionId: a.questionId,
            userAnswers: a.userAnswers as unknown as number[],
            isCorrect: a.isCorrect,
            appUserId,
            durationSeconds: a.durationSeconds ?? 0,
          })),
        );

        const todayStr = this.getTodayDateStr();
        await this.db
          .insert(dailyAnswerRecord)
          .values(
            toInsert.map((a) => ({
              userId: appUserId,
              answerDate: todayStr,
              questionId: a.questionId,
            })),
          )
          .onConflictDoNothing({
            target: [
              dailyAnswerRecord.userId,
              dailyAnswerRecord.answerDate,
              dailyAnswerRecord.questionId,
            ],
          });
      }

      for (const a of toUpdate) {
        const existingId = existingMap.get(a.questionId);
        if (existingId) {
          const updateData: Record<string, unknown> = {
            userAnswers: a.userAnswers as unknown as number[],
            isCorrect: a.isCorrect,
          };
          if (a.durationSeconds !== undefined && a.durationSeconds > 0) {
            updateData.durationSeconds = a.durationSeconds;
          }
          await this.db
            .update(practiceAnswer)
            .set(updateData)
            .where(eq(practiceAnswer.id, existingId));
        }
      }
    }

    const updateData: Record<string, number | string> = {
      currentIndex: dto.currentIndex,
    };

    if (!isReciteMode) {
      const answerCountResult = await this.db
        .select({ count: count() })
        .from(practiceAnswer)
        .where(eq(practiceAnswer.recordId, dto.recordId));

      const correctCountResult = await this.db
        .select({ count: count() })
        .from(practiceAnswer)
        .where(and(
          eq(practiceAnswer.recordId, dto.recordId),
          eq(practiceAnswer.isCorrect, true),
        ));

      const correctCount = Number(correctCountResult[0]?.count || 0);
      const answeredCount = Number(answerCountResult[0]?.count || 0);
      const accuracyRate = answeredCount > 0 ? correctCount / answeredCount : 0;
      updateData.correctCount = correctCount;
      updateData.accuracyRate = String(accuracyRate);
    }

    if (dto.durationSeconds !== undefined && dto.durationSeconds > 0) {
      updateData.durationSeconds = dto.durationSeconds;
    }

    await this.db
      .update(practiceRecord)
      .set(updateData)
      .where(and(eq(practiceRecord.id, dto.recordId), eq(practiceRecord.appUserId, appUserId)));

    if (!isReciteMode) {
      await this.syncWrongBook(appUserId, dto.recordId);
    }

    return { success: true };
  }

  async clearSubsequentAnswers(
    appUserId: string,
    dto: ClearSubsequentAnswersRequest,
  ): Promise<{ success: boolean; deletedCount: number }> {
    if (!dto.recordId) {
      throw new BadRequestException('记录ID不能为空');
    }
    if (!Array.isArray(dto.questionIds)) {
      throw new BadRequestException('题目ID列表格式错误');
    }

    const records = await this.db
      .select({
        id: practiceRecord.id,
        status: practiceRecord.status,
      })
      .from(practiceRecord)
      .where(and(eq(practiceRecord.id, dto.recordId), eq(practiceRecord.appUserId, appUserId)));

    if (records.length === 0) {
      throw new NotFoundException('练习记录不存在');
    }

    const record = records[0];
    if (record.status !== 'in_progress') {
      throw new ConflictException('练习已完成，无法清除');
    }

    let deletedCount = 0;
    if (dto.questionIds.length > 0) {
      const deleted = await this.db
        .delete(practiceAnswer)
        .where(and(
          eq(practiceAnswer.recordId, dto.recordId),
          inArray(practiceAnswer.questionId, dto.questionIds),
        ))
        .returning({ id: practiceAnswer.id });
      deletedCount = deleted.length;
    }

    const answerCountResult = await this.db
      .select({ count: count() })
      .from(practiceAnswer)
      .where(eq(practiceAnswer.recordId, dto.recordId));

    const correctCountResult = await this.db
      .select({ count: count() })
      .from(practiceAnswer)
      .where(and(
        eq(practiceAnswer.recordId, dto.recordId),
        eq(practiceAnswer.isCorrect, true),
      ));

    const correctCount = Number(correctCountResult[0]?.count || 0);
    const answeredCount = Number(answerCountResult[0]?.count || 0);
    const accuracyRate = answeredCount > 0 ? correctCount / answeredCount : 0;

    await this.db
      .update(practiceRecord)
      .set({
        currentIndex: dto.currentIndex,
        correctCount,
        accuracyRate: String(accuracyRate),
        durationSeconds: 0,
      })
      .where(and(eq(practiceRecord.id, dto.recordId), eq(practiceRecord.appUserId, appUserId)));

    await this.syncWrongBook(appUserId, dto.recordId);

    return { success: true, deletedCount };
  }

  private async syncWrongBook(appUserId: string, recordId: string): Promise<void> {
    const recordRows = await this.db
      .select({ status: practiceRecord.status, wrongBookSynced: practiceRecord.wrongBookSynced })
      .from(practiceRecord)
      .where(and(eq(practiceRecord.id, recordId), eq(practiceRecord.appUserId, appUserId)));
    if (recordRows.length === 0) return;
    const record = recordRows[0];

    const answers = await this.db
      .select({
        questionId: practiceAnswer.questionId,
        isCorrect: practiceAnswer.isCorrect,
      })
      .from(practiceAnswer)
      .where(eq(practiceAnswer.recordId, recordId));

    if (answers.length === 0) return;

    const allQuestionIds = answers.map((a) => a.questionId);
    const wrongIds = answers
      .filter((a) => !a.isCorrect)
      .map((a) => a.questionId);

    const existing = await this.db
      .select({
        id: userQuestionState.id,
        questionId: userQuestionState.questionId,
        wrongCount: userQuestionState.wrongCount,
      })
      .from(userQuestionState)
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        inArray(userQuestionState.questionId, allQuestionIds),
      ));

    const existingMap = new Map(existing.map((e) => [e.questionId, e]));
    const newQuestionIds = allQuestionIds.filter((id) => !existingMap.has(id));

    if (record.wrongBookSynced) {
      if (newQuestionIds.length === 0) return;
      await this.db.insert(userQuestionState).values(
        newQuestionIds.map((qid) => {
          const isWrong = wrongIds.includes(qid);
          return {
            userId: sql`ROW(${appUserId})::user_profile`,
            appUserId,
            questionId: qid,
            isFavorited: false,
            wrongCount: isWrong ? 1 : 0,
            lastWrongAt: isWrong ? new Date() : null,
            mastered: false,
            attemptCount: 1,
          };
        }),
      );
      return;
    }

    if (newQuestionIds.length > 0) {
      await this.db.insert(userQuestionState).values(
        newQuestionIds.map((qid) => {
          const isWrong = wrongIds.includes(qid);
          return {
            userId: sql`ROW(${appUserId})::user_profile`,
            appUserId,
            questionId: qid,
            isFavorited: false,
            wrongCount: isWrong ? 1 : 0,
            lastWrongAt: isWrong ? new Date() : null,
            mastered: false,
            attemptCount: 1,
          };
        }),
      );
    }

    if (existing.length > 0) {
      for (const e of existing) {
        const isWrong = wrongIds.includes(e.questionId);
        await this.db
          .update(userQuestionState)
          .set({
            wrongCount: isWrong
              ? sql`${userQuestionState.wrongCount} + 1`
              : userQuestionState.wrongCount,
            lastWrongAt: isWrong ? new Date() : userQuestionState.lastWrongAt,
            mastered: isWrong
              ? sql`CASE WHEN ${userQuestionState.manuallyMastered} = true THEN true ELSE false END`
              : userQuestionState.mastered,
            attemptCount: sql`${userQuestionState.attemptCount} + 1`,
          })
          .where(eq(userQuestionState.id, e.id));
      }
    }

    await this.db
      .update(practiceRecord)
      .set({ wrongBookSynced: true })
      .where(and(eq(practiceRecord.id, recordId), eq(practiceRecord.appUserId, appUserId)));
  }

  async finishSession(
    appUserId: string,
    dto: FinishPracticeSessionRequest,
  ): Promise<CreatePracticeRecordResponse> {
    if (!dto.recordId) {
      throw new BadRequestException('记录ID不能为空');
    }

    const records = await this.db
      .select({
        id: practiceRecord.id,
        status: practiceRecord.status,
        totalCount: practiceRecord.totalCount,
      })
      .from(practiceRecord)
      .where(and(eq(practiceRecord.id, dto.recordId), eq(practiceRecord.appUserId, appUserId)));

    if (records.length === 0) {
      throw new NotFoundException('练习记录不存在');
    }

    const record = records[0];
    if (record.status !== 'in_progress') {
      throw new ConflictException('练习已完成，无法重复提交');
    }

    const originalTotalCount = record.totalCount;

    // 基于 practice_answer 独立重算正确数和已答数，不信任前端传入
    const answerStats = await this.db
      .select({
        answeredCount: count(),
        correctCount: sql<number>`count(*) filter (where ${practiceAnswer.isCorrect} = true)`,
      })
      .from(practiceAnswer)
      .where(eq(practiceAnswer.recordId, dto.recordId));

    const answeredCount = Number(answerStats[0]?.answeredCount || 0);
    const correctCount = Number(answerStats[0]?.correctCount || 0);
    const accuracyRate = answeredCount > 0 ? correctCount / answeredCount : 0;

    this.logger.log(
      `[finishSession] recordId=${dto.recordId}, beforeTotal=${originalTotalCount}, answered=${answeredCount}, correct=${correctCount}`,
    );

    const [updated] = await this.db
      .update(practiceRecord)
      .set({
        status: 'finished',
        correctCount,
        accuracyRate: String(accuracyRate),
        durationSeconds: dto.durationSeconds,
        finishedAt: new Date(dto.finishedAt),
        totalCount: originalTotalCount,
      })
      .where(and(eq(practiceRecord.id, dto.recordId), eq(practiceRecord.appUserId, appUserId)))
      .returning({
        id: practiceRecord.id,
        accuracyRate: practiceRecord.accuracyRate,
        correctCount: practiceRecord.correctCount,
        totalCount: practiceRecord.totalCount,
      });

    await this.syncWrongBook(appUserId, dto.recordId);

    return {
      id: updated.id,
      accuracyRate: Number(updated.accuracyRate),
      correctCount: updated.correctCount,
      totalCount: updated.totalCount,
    };
  }

  async submitRecord(
    appUserId: string,
    dto: CreatePracticeRecordRequest,
  ): Promise<CreatePracticeRecordResponse> {
    if (!dto.bankId) {
      throw new BadRequestException('题集ID不能为空');
    }
    if (dto.totalCount <= 0) {
      throw new BadRequestException('题目数量不能为0');
    }
    if (!Array.isArray(dto.answers) || dto.answers.length === 0) {
      throw new BadRequestException('作答详情不能为空');
    }

    const bankResult = await this.db
      .select({ id: questionBank.id, appUserId: questionBank.appUserId, isPublic: questionBank.isPublic })
      .from(questionBank)
      .where(eq(questionBank.id, dto.bankId));
    if (bankResult.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    const bank = bankResult[0];
    if (bank.appUserId !== appUserId && !bank.isPublic) {
      throw new NotFoundException('题集不存在');
    }

    const [record] = await this.db
      .insert(practiceRecord)
      .values({
        bankId: dto.bankId,
        userId: sql`ROW(${appUserId})::user_profile`,
        appUserId,
        totalCount: dto.totalCount,
        correctCount: dto.correctCount,
        accuracyRate: String(dto.accuracyRate),
        durationSeconds: dto.durationSeconds,
        startedAt: new Date(dto.startedAt),
        finishedAt: new Date(dto.finishedAt),
        status: 'finished',
      })
      .returning({
        id: practiceRecord.id,
        accuracyRate: practiceRecord.accuracyRate,
        correctCount: practiceRecord.correctCount,
        totalCount: practiceRecord.totalCount,
      });

    await this.db.insert(practiceAnswer).values(
      dto.answers.map((a) => ({
        recordId: record.id,
        questionId: a.questionId,
        userAnswers: a.userAnswers as unknown as number[],
        isCorrect: a.isCorrect,
        appUserId,
      })),
    ).onConflictDoNothing();

    // 同步写入打卡数据（使用 finishedAt 的日期，避免离线同步把旧记录算到今天）
    const answerDate = new Date(dto.finishedAt).toISOString().slice(0, 10);
    await this.db
      .insert(dailyAnswerRecord)
      .values(
        dto.answers.map((a) => ({
          userId: appUserId,
          answerDate,
          questionId: a.questionId,
        })),
      )
      .onConflictDoNothing({
        target: [
          dailyAnswerRecord.userId,
          dailyAnswerRecord.answerDate,
          dailyAnswerRecord.questionId,
        ],
      });

    await this.syncWrongBook(appUserId, record.id);

    return {
      id: record.id,
      accuracyRate: Number(record.accuracyRate),
      correctCount: record.correctCount,
      totalCount: record.totalCount,
    };
  }

  async getStatistics(appUserId: string): Promise<PracticeStatisticsResponse> {
    const records = await this.db
      .select()
      .from(practiceRecord)
      .where(and(
        eq(practiceRecord.appUserId, appUserId),
        eq(practiceRecord.status, 'finished'),
      ));

    this.logger.log(`[getStatistics] appUserId=${appUserId}, finishedRecordCount=${records.length}`);

    if (records.length === 0) {
      return {
        totalQuestions: 0,
        totalAccuracyRate: 0,
        practicedBanks: 0,
        bankStats: [],
      };
    }

    const totalQuestions = records.reduce((sum, r) => sum + r.totalCount, 0);
    const totalCorrect = records.reduce((sum, r) => sum + r.correctCount, 0);
    const totalAccuracyRate = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;

    const bankMap = new Map<string, { bankId: string; totalCount: number; correctCount: number }>();
    for (const r of records) {
      const existing = bankMap.get(r.bankId);
      if (existing) {
        existing.totalCount += r.totalCount;
        existing.correctCount += r.correctCount;
      } else {
        bankMap.set(r.bankId, {
          bankId: r.bankId,
          totalCount: r.totalCount,
          correctCount: r.correctCount,
        });
      }
    }

    const bankIds = Array.from(bankMap.keys());
    const banks = await this.db
      .select({ id: questionBank.id, name: questionBank.name })
      .from(questionBank)
      .where(sql`${questionBank.id} = ANY(ARRAY[${sql.join(bankIds.map((id) => sql`${id}`), sql`, `)}]::uuid[])`);

    const bankNameMap = new Map(banks.map((b) => [b.id, b.name]));

    const bankStats = Array.from(bankMap.values())
      .map((item) => ({
        bankId: item.bankId,
        bankName: bankNameMap.get(item.bankId) || '未知题集',
        accuracyRate: item.totalCount > 0 ? item.correctCount / item.totalCount : 0,
        totalCount: item.totalCount,
      }))
      .sort((a, b) => a.accuracyRate - b.accuracyRate);

    return {
      totalQuestions,
      totalAccuracyRate,
      practicedBanks: bankStats.length,
      bankStats,
    };
  }

  async getRecords(
    appUserId: string,
    page: number,
    pageSize: number,
  ): Promise<PracticeRecordListResponse> {
    const offset = (page - 1) * pageSize;

    const countResult = await this.db
      .select({ count: count() })
      .from(practiceRecord)
      .where(and(
        eq(practiceRecord.appUserId, appUserId),
        sql`${practiceRecord.practiceMode} <> 'recite'`,
      ));

    const total = Number(countResult[0]?.count || 0);

    const rows = await this.db
      .select({
        id: practiceRecord.id,
        bankId: practiceRecord.bankId,
        totalCount: practiceRecord.totalCount,
        correctCount: practiceRecord.correctCount,
        accuracyRate: practiceRecord.accuracyRate,
        durationSeconds: practiceRecord.durationSeconds,
        finishedAt: practiceRecord.finishedAt,
        bankName: questionBank.name,
        practiceMode: practiceRecord.practiceMode,
      })
      .from(practiceRecord)
      .leftJoin(questionBank, eq(practiceRecord.bankId, questionBank.id))
      .where(and(
        eq(practiceRecord.appUserId, appUserId),
        sql`${practiceRecord.practiceMode} <> 'recite'`,
      ))
      .orderBy(desc(practiceRecord.finishedAt))
      .limit(pageSize)
      .offset(offset);

    const recordIds = rows.map((r) => r.id);

    const answerCounts = recordIds.length > 0
      ? await this.db
        .select({
          recordId: practiceAnswer.recordId,
          answeredCount: count(),
        })
        .from(practiceAnswer)
        .where(inArray(practiceAnswer.recordId, recordIds))
        .groupBy(practiceAnswer.recordId)
      : [];

    const answeredMap = new Map(answerCounts.map((a) => [a.recordId, Number(a.answeredCount)]));

    const items: PracticeRecordItem[] = rows
      .filter((row) => row.finishedAt)
      .map((row) => {
        const answered = answeredMap.get(row.id) || 0;
        const wrong = answered - row.correctCount;
        const unanswered = row.totalCount - answered;
        return {
          id: row.id,
          bankId: row.bankId,
          bankName: row.bankName || '未知题集',
          totalCount: row.totalCount,
          correctCount: row.correctCount,
          wrongCount: wrong,
          unansweredCount: unanswered,
          accuracyRate: Number(row.accuracyRate),
          durationSeconds: row.durationSeconds,
          finishedAt: row.finishedAt!.toISOString(),
          practiceMode: row.practiceMode as PracticeMode,
        };
      });

    return { items, total, page, pageSize };
  }

  async getRecordDetail(
    appUserId: string,
    id: string,
  ): Promise<PracticeRecordDetailResponse> {
    const records = await this.db
      .select({
        id: practiceRecord.id,
        bankId: practiceRecord.bankId,
        totalCount: practiceRecord.totalCount,
        correctCount: practiceRecord.correctCount,
        accuracyRate: practiceRecord.accuracyRate,
        finishedAt: practiceRecord.finishedAt,
        bankName: questionBank.name,
        practiceMode: practiceRecord.practiceMode,
      })
      .from(practiceRecord)
      .leftJoin(questionBank, eq(practiceRecord.bankId, questionBank.id))
      .where(and(eq(practiceRecord.id, id), eq(practiceRecord.appUserId, appUserId)));

    if (records.length === 0) {
      throw new NotFoundException('记录不存在');
    }

    const record = records[0];

    const answers = await this.db
      .select()
      .from(practiceAnswer)
      .where(eq(practiceAnswer.recordId, id));

    const questionIds = answers.map((a) => a.questionId);
    const questions = questionIds.length > 0
      ? await this.db
          .select({
            id: question.id,
            content: question.content,
            questionType: question.questionType,
            options: question.options,
            correctAnswers: question.correctAnswers,
            subQuestions: question.subQuestions,
          })
          .from(question)
          .where(sql`${question.id} = ANY(ARRAY[${sql.join(questionIds.map((qid) => sql`${qid}`), sql`, `)}]::uuid[])` )
      : [];

    const questionMap = new Map(questions.map((q) => [q.id, q]));

    const detailAnswers: PracticeRecordDetailAnswer[] = answers.map((a) => {
      const q = questionMap.get(a.questionId);
      return {
        questionId: a.questionId,
        questionContent: q?.content || '',
        questionType: (q?.questionType as QuestionType) || 'single',
        userAnswers: a.userAnswers as unknown as number[],
        correctAnswers: (q?.correctAnswers as unknown as number[]) || [],
        isCorrect: a.isCorrect,
        options: (q?.options as unknown as { label: string; text: string }[]) || [],
        subQuestions: (q?.subQuestions as unknown as SubQuestion[]) || [],
      };
    });

    return {
      id: record.id,
      bankName: record.bankName || '未知题集',
      totalCount: record.totalCount,
      correctCount: record.correctCount,
      accuracyRate: Number(record.accuracyRate),
      finishedAt: record.finishedAt?.toISOString() || '',
      practiceMode: record.practiceMode as PracticeMode,
      answers: detailAnswers,
    };
  }

  async deleteRecord(appUserId: string, id: string): Promise<{ success: boolean }> {
    const records = await this.db
      .select({ id: practiceRecord.id })
      .from(practiceRecord)
      .where(and(eq(practiceRecord.id, id), eq(practiceRecord.appUserId, appUserId)));

    if (records.length === 0) {
      throw new NotFoundException('记录不存在');
    }

    const recordInfo = await this.db
      .select({ wrongBookSynced: practiceRecord.wrongBookSynced })
      .from(practiceRecord)
      .where(and(eq(practiceRecord.id, id), eq(practiceRecord.appUserId, appUserId)));
    const wasSynced = recordInfo[0]?.wrongBookSynced ?? false;

    if (wasSynced) {
      const wrongAnswers = await this.db
        .select({ questionId: practiceAnswer.questionId })
        .from(practiceAnswer)
        .where(and(
          eq(practiceAnswer.recordId, id),
          eq(practiceAnswer.isCorrect, false),
        ));

      if (wrongAnswers.length > 0) {
        const wrongQids = wrongAnswers.map((a) => a.questionId);
        const existingStates = await this.db
          .select({
            id: userQuestionState.id,
            questionId: userQuestionState.questionId,
            wrongCount: userQuestionState.wrongCount,
          })
          .from(userQuestionState)
          .where(and(
            eq(userQuestionState.appUserId, appUserId),
            inArray(userQuestionState.questionId, wrongQids),
          ));

        for (const state of existingStates) {
          if (state.wrongCount <= 1) {
            // 只重置错题字段，保留笔记/收藏/难度等其他状态
            await this.db
              .update(userQuestionState)
              .set({ wrongCount: 0, lastWrongAt: null, correctStreak: 0 })
              .where(eq(userQuestionState.id, state.id));
          } else {
            await this.db
              .update(userQuestionState)
              .set({
                wrongCount: sql`${userQuestionState.wrongCount} - 1`,
              })
              .where(eq(userQuestionState.id, state.id));
          }
        }
      }
    }

    await this.db
      .delete(practiceAnswer)
      .where(eq(practiceAnswer.recordId, id));
    await this.db
      .delete(practiceRecord)
      .where(and(eq(practiceRecord.id, id), eq(practiceRecord.appUserId, appUserId)));

    return { success: true };
  }

  async clearBankRecords(appUserId: string, bankId: string): Promise<{ success: boolean; deletedCount: number }> {
    const bankResult = await this.db
      .select({ id: questionBank.id, appUserId: questionBank.appUserId, isPublic: questionBank.isPublic })
      .from(questionBank)
      .where(eq(questionBank.id, bankId));
    if (bankResult.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    const bank = bankResult[0];
    if (bank.appUserId !== appUserId && !bank.isPublic) {
      throw new NotFoundException('题集不存在');
    }

    const userRecords = await this.db
      .select({ id: practiceRecord.id })
      .from(practiceRecord)
      .where(and(
        eq(practiceRecord.bankId, bankId),
        eq(practiceRecord.appUserId, appUserId),
      ));

    if (userRecords.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    const recordIds = userRecords.map((r) => r.id);

    const bankQuestions = await this.db
      .select({ id: question.id })
      .from(question)
      .where(and(eq(question.bankId, bankId), eq(question.appUserId, appUserId)));

    if (bankQuestions.length > 0) {
      const bankQids = bankQuestions.map((q) => q.id);
      // 只重置练习相关字段，保留收藏/笔记/难度/掌握状态
      await this.db
        .update(userQuestionState)
        .set({
          wrongCount: 0,
          lastWrongAt: null,
          correctStreak: 0,
          attemptCount: 0,
        })
        .where(and(
          eq(userQuestionState.appUserId, appUserId),
          inArray(userQuestionState.questionId, bankQids),
        ));
    }

    await this.db
      .delete(practiceAnswer)
      .where(inArray(practiceAnswer.recordId, recordIds));
    await this.db
      .delete(practiceRecord)
      .where(inArray(practiceRecord.id, recordIds));

    return { success: true, deletedCount: recordIds.length };
  }

  async batchDeleteRecords(
    appUserId: string,
    ids: string[],
  ): Promise<{ success: boolean; deletedCount: number }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('记录ID列表不能为空');
    }

    const userRecords = await this.db
      .select({ id: practiceRecord.id, wrongBookSynced: practiceRecord.wrongBookSynced })
      .from(practiceRecord)
      .where(and(
        inArray(practiceRecord.id, ids),
        eq(practiceRecord.appUserId, appUserId),
      ));

    if (userRecords.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    const recordIds = userRecords.map((r) => r.id);
    const syncedIds = userRecords
      .filter((r) => r.wrongBookSynced)
      .map((r) => r.id);

    if (syncedIds.length > 0) {
      const wrongAnswers = await this.db
        .select({ questionId: practiceAnswer.questionId })
        .from(practiceAnswer)
        .where(and(
          inArray(practiceAnswer.recordId, syncedIds),
          eq(practiceAnswer.isCorrect, false),
        ));

      if (wrongAnswers.length > 0) {
        const wrongQids = [...new Set(wrongAnswers.map((a) => a.questionId))];
        const existingStates = await this.db
          .select({
            id: userQuestionState.id,
            questionId: userQuestionState.questionId,
            wrongCount: userQuestionState.wrongCount,
          })
          .from(userQuestionState)
          .where(and(
            eq(userQuestionState.appUserId, appUserId),
            inArray(userQuestionState.questionId, wrongQids),
          ));

        const qidWrongCount = new Map<string, number>();
        for (const wa of wrongAnswers) {
          qidWrongCount.set(wa.questionId, (qidWrongCount.get(wa.questionId) ?? 0) + 1);
        }

        for (const state of existingStates) {
          const decrement = qidWrongCount.get(state.questionId) ?? 0;
          if (state.wrongCount <= decrement) {
            // 只重置错题字段，保留笔记/收藏/难度等其他状态
            await this.db
              .update(userQuestionState)
              .set({ wrongCount: 0, lastWrongAt: null, correctStreak: 0 })
              .where(eq(userQuestionState.id, state.id));
          } else {
            await this.db
              .update(userQuestionState)
              .set({
                wrongCount: sql`${userQuestionState.wrongCount} - ${decrement}`,
              })
              .where(eq(userQuestionState.id, state.id));
          }
        }
      }
    }

    await this.db
      .delete(practiceAnswer)
      .where(inArray(practiceAnswer.recordId, recordIds));
    await this.db
      .delete(practiceRecord)
      .where(inArray(practiceRecord.id, recordIds));

    return { success: true, deletedCount: recordIds.length };
  }

  async exportAnswers(
    appUserId: string,
    range: PracticeExportRange,
    format: PracticeExportFormat,
    bankId?: string,
  ): Promise<{ filename: string; content: string; mimeType: string }> {
    const now = new Date();
    let startDate: Date | null = null;

    if (range === 'today') {
      const shanghaiNow = this.getShanghaiDate(now);
      const year = shanghaiNow.getFullYear();
      const month = shanghaiNow.getMonth();
      const day = shanghaiNow.getDate();
      const shanghaiStart = new Date(year, month, day, 0, 0, 0);
      startDate = new Date(shanghaiStart.getTime() - 8 * 60 * 60 * 1000);
    } else if (range === 'week') {
      const shanghaiNow = this.getShanghaiDate(now);
      const year = shanghaiNow.getFullYear();
      const month = shanghaiNow.getMonth();
      const day = shanghaiNow.getDate();
      const dayOfWeek = shanghaiNow.getDay() || 7;
      const mondayShanghai = new Date(year, month, day - dayOfWeek + 1, 0, 0, 0);
      startDate = new Date(mondayShanghai.getTime() - 8 * 60 * 60 * 1000);
    }

    const recordsQuery = this.db
      .select({
        id: practiceRecord.id,
        bankId: practiceRecord.bankId,
        finishedAt: practiceRecord.finishedAt,
        bankName: questionBank.name,
      })
      .from(practiceRecord)
      .leftJoin(questionBank, eq(practiceRecord.bankId, questionBank.id))
      .where(and(
        eq(practiceRecord.appUserId, appUserId),
        eq(practiceRecord.status, 'finished'),
        sql`${practiceRecord.practiceMode} <> 'recite'`,
        ...(startDate ? [gte(practiceRecord.finishedAt, startDate)] : []),
        ...(bankId ? [eq(practiceRecord.bankId, bankId)] : []),
      ));

    const records = await recordsQuery;

    if (records.length === 0) {
      let bankLabel = '全部题集';
      if (bankId) {
        const bankResult = await this.db
          .select({ name: questionBank.name })
          .from(questionBank)
          .where(eq(questionBank.id, bankId))
          .limit(1);
        if (bankResult.length > 0 && bankResult[0].name) {
          bankLabel = bankResult[0].name.replace(/[\\/:*?"<>|]/g, '_');
        }
      }
      const emptyResult: PracticeAnswerExportItem[] = [];
      return await this.formatExportResult(emptyResult, format, now, bankLabel);
    }

    const recordIds = records.map((r) => r.id);
    const answers = await this.db
      .select({
        recordId: practiceAnswer.recordId,
        questionId: practiceAnswer.questionId,
        userAnswers: practiceAnswer.userAnswers,
        isCorrect: practiceAnswer.isCorrect,
        createdAt: practiceAnswer.createdAt,
      })
      .from(practiceAnswer)
      .where(inArray(practiceAnswer.recordId, recordIds));

    const questionIds = [...new Set(answers.map((a) => a.questionId))];
    const questions = questionIds.length > 0
      ? await this.db
          .select({
            id: question.id,
            content: question.content,
            questionType: question.questionType,
            options: question.options,
            correctAnswers: question.correctAnswers,
            subQuestions: question.subQuestions,
          })
          .from(question)
          .where(sql`${question.id} = ANY(ARRAY[${sql.join(questionIds.map((qid) => sql`${qid}`), sql`, `)}]::uuid[])`)
      : [];

    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const recordMap = new Map(records.map((r) => [r.id, r]));

    const exportItems: PracticeAnswerExportItem[] = [];

    for (const answer of answers) {
      const q = questionMap.get(answer.questionId);
      const rec = recordMap.get(answer.recordId);
      if (!q) continue;

      const options = (q.options as unknown as QuestionOption[]) || [];
      const correctAnswers = (q.correctAnswers as unknown as number[]) || [];
      const userAnswerIdxs = (answer.userAnswers as unknown as number[]) || [];
      const subQList = (q.subQuestions as unknown as SubQuestion[]) || [];
      const qType = q.questionType as QuestionType;

      const answeredAt = answer.createdAt?.toISOString() || rec?.finishedAt?.toISOString() || '';
      const bankName = rec?.bankName || '未知题集';

      const correctLabels = correctAnswers
        .map((idx: number) => options[idx]?.label || '')
        .filter(Boolean);

      const userLabels = userAnswerIdxs
        .map((idx: number) => options[idx]?.label || '')
        .filter(Boolean);

      if (qType === 'b1' && subQList.length > 0) {
        for (let i = 0; i < subQList.length; i += 1) {
          const sq = subQList[i];
          const sqCorrect = sq.correctAnswer || '';
          const sqUserLabel = userLabels[i] || '';
          const sqCorrectLabel = sqCorrect || '';
          exportItems.push({
            questionContent: q.content,
            questionType: qType,
            options,
            userAnswerLabels: sqUserLabel ? [sqUserLabel] : [],
            correctAnswerLabels: sqCorrectLabel ? [sqCorrectLabel] : [],
            isCorrect: sqUserLabel.toUpperCase() === sqCorrectLabel.toUpperCase(),
            answeredAt,
            bankName,
            recordId: answer.recordId,
            subQuestionIndex: i + 1,
            subQuestionContent: sq.content,
          });
        }
      } else {
        exportItems.push({
          questionContent: q.content,
          questionType: qType,
          options,
          userAnswerLabels: userLabels,
          correctAnswerLabels: correctLabels,
          isCorrect: answer.isCorrect,
          answeredAt,
          bankName,
          recordId: answer.recordId,
        });
      }
    }

    let bankLabel = '全部题集';
    if (bankId) {
      const bankResult = await this.db
        .select({ name: questionBank.name })
        .from(questionBank)
        .where(eq(questionBank.id, bankId))
        .limit(1);
      if (bankResult.length > 0 && bankResult[0].name) {
        bankLabel = bankResult[0].name.replace(/[\\/:*?"<>|]/g, '_');
      }
    }

    exportItems.sort((a, b) => (a.answeredAt < b.answeredAt ? 1 : -1));

    return await this.formatExportResult(exportItems, format, now, bankLabel);
  }

  private async formatExportResult(
    items: PracticeAnswerExportItem[],
    format: PracticeExportFormat,
    now: Date,
    bankLabel: string,
  ): Promise<{ filename: string; content: string; mimeType: string; isBase64?: boolean }> {
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = bankLabel ? `${bankLabel}_` : '';

    if (format === 'csv') {
      const hasSubQuestion = items.some((item) => item.subQuestionIndex !== undefined);
      const headers: string[] = [
        '所属题集',
        '题目类型',
      ];
      if (hasSubQuestion) {
        headers.push('子题序号', '子题题干');
      }
      headers.push(
        '题干',
        '选项A',
        '选项B',
        '选项C',
        '选项D',
        '选项E',
        '用户选择',
        '正确答案',
        '是否正确',
        '答题时间',
      );

      const typeLabelMap: Record<string, string> = {
        single: '单选题',
        multiple: '多选题',
        b1: 'B1型题',
        judge: '判断题',
        fill: '填空题',
      };

      const getOptionText = (opts: QuestionOption[], label: string): string => {
        const found = opts.find((o) => o.label.toUpperCase() === label.toUpperCase());
        return found ? found.text : '';
      };

      const rows = items.map((item) => {
        const row: string[] = [
          this.escapeCsvField(item.bankName),
          typeLabelMap[item.questionType] || item.questionType,
        ];
        if (hasSubQuestion) {
          row.push(
            item.subQuestionIndex ? String(item.subQuestionIndex) : '',
            item.subQuestionContent ? this.escapeCsvField(item.subQuestionContent) : '',
          );
        }
        row.push(
          this.escapeCsvField(item.questionContent),
          this.escapeCsvField(getOptionText(item.options, 'A')),
          this.escapeCsvField(getOptionText(item.options, 'B')),
          this.escapeCsvField(getOptionText(item.options, 'C')),
          this.escapeCsvField(getOptionText(item.options, 'D')),
          this.escapeCsvField(getOptionText(item.options, 'E')),
          this.escapeCsvField(item.userAnswerLabels.join(', ')),
          this.escapeCsvField(item.correctAnswerLabels.join(', ')),
          item.isCorrect ? '正确' : '错误',
          item.answeredAt,
        );
        return row;
      });

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const bom = '\uFEFF';

      return {
        filename: `${prefix}刷题记录_${dateStr}.csv`,
        content: bom + csvContent,
        mimeType: 'text/csv; charset=utf-8',
      };
    }

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('刷题记录');

      const hasSubQuestion = items.some((item) => item.subQuestionIndex !== undefined);
      const columns: Array<{ header: string; key: string; width: number }> = [
        { header: '所属题集', key: 'bankName', width: 25 },
        { header: '题目类型', key: 'questionType', width: 12 },
      ];
      if (hasSubQuestion) {
        columns.push(
          { header: '子题序号', key: 'subQuestionIndex', width: 10 },
          { header: '子题题干', key: 'subQuestionContent', width: 30 },
        );
      }
      columns.push(
        { header: '题干', key: 'questionContent', width: 50 },
        { header: '选项A', key: 'optionA', width: 30 },
        { header: '选项B', key: 'optionB', width: 30 },
        { header: '选项C', key: 'optionC', width: 30 },
        { header: '选项D', key: 'optionD', width: 30 },
        { header: '选项E', key: 'optionE', width: 30 },
        { header: '用户选择', key: 'userAnswers', width: 15 },
        { header: '正确答案', key: 'correctAnswers', width: 15 },
        { header: '是否正确', key: 'isCorrect', width: 10 },
        { header: '答题时间', key: 'answeredAt', width: 22 },
      );
      worksheet.columns = columns;

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, size: 12 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6366F1' },
      };
      headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 28;

      const typeLabelMap: Record<string, string> = {
        single: '单选题',
        multiple: '多选题',
        b1: 'B1型题',
        judge: '判断题',
        fill: '填空题',
      };

      const getOptionText = (opts: QuestionOption[], label: string): string => {
        const found = opts.find((o) => o.label.toUpperCase() === label.toUpperCase());
        return found ? found.text : '';
      };

      items.forEach((item) => {
        const rowData: Record<string, string | number | boolean> = {
          bankName: item.bankName,
          questionType: typeLabelMap[item.questionType] || item.questionType,
        };
        if (hasSubQuestion) {
          rowData.subQuestionIndex = item.subQuestionIndex || '';
          rowData.subQuestionContent = item.subQuestionContent || '';
        }
        rowData.questionContent = item.questionContent;
        rowData.optionA = getOptionText(item.options, 'A');
        rowData.optionB = getOptionText(item.options, 'B');
        rowData.optionC = getOptionText(item.options, 'C');
        rowData.optionD = getOptionText(item.options, 'D');
        rowData.optionE = getOptionText(item.options, 'E');
        rowData.userAnswers = item.userAnswerLabels.join(', ');
        rowData.correctAnswers = item.correctAnswerLabels.join(', ');
        rowData.isCorrect = item.isCorrect ? '正确' : '错误';
        rowData.answeredAt = item.answeredAt;
        worksheet.addRow(rowData);
      });

      const dataRows = worksheet.getRows(2, items.length);
      if (dataRows) {
        dataRows.forEach((row) => {
          row.alignment = { vertical: 'top', wrapText: true };
          row.height = 40;
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      return {
        filename: `${prefix}刷题记录_${dateStr}.xlsx`,
        content: base64,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        isBase64: true,
      };
    }

    const jsonContent = JSON.stringify({
      exportedAt: now.toISOString(),
      totalCount: items.length,
      data: items,
    }, null, 2);

    return {
      filename: `${prefix}刷题记录_${dateStr}.json`,
      content: jsonContent,
      mimeType: 'application/json; charset=utf-8',
    };
  }

  private escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private getShanghaiDate(date: Date): Date {
    const utcMs = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
    return new Date(utcMs + 8 * 60 * 60 * 1000);
  }

  private getTodayDateStr(): string {
    const d = this.getShanghaiDate(new Date());
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
