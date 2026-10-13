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
      await this.db
        .update(practiceAnswer)
        .set({
          userAnswers: dto.userAnswers as unknown as number[],
          isCorrect: dto.isCorrect,
        })
        .where(eq(practiceAnswer.id, existing[0].id));
    } else {
      await this.db.insert(practiceAnswer).values({
        recordId: dto.recordId,
        questionId: dto.questionId,
        userAnswers: dto.userAnswers as unknown as number[],
        isCorrect: dto.isCorrect,
        appUserId,
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
          const prevCorrect = existingAnswers.find((e) => e.questionId === a.questionId);
          const wasWrong = prevCorrect ? false : false;
          await this.db
            .update(practiceAnswer)
            .set({
              userAnswers: a.userAnswers as unknown as number[],
              isCorrect: a.isCorrect,
            })
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
            mastered: isWrong ? false : userQuestionState.mastered,
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
    );

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
            await this.db
              .delete(userQuestionState)
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
      await this.db
        .delete(userQuestionState)
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
            await this.db
              .delete(userQuestionState)
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
