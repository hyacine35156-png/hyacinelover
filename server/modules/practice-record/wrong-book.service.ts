import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, sql, gte, lt, inArray } from 'drizzle-orm';

import {
  userQuestionState,
  question,
  questionBank,
  questionTag,
  questionTagRel,
  practiceAnswer,
} from '@server/database/schema';
import type {
  WrongBookStatsResponse,
  WrongReason,
  DifficultyLevel,
  QuestionType,
  WrongBookFilterOptions,
} from '@shared/api.interface';

interface WrongBookExportItem {
  questionId: string;
  content: string;
  questionType: QuestionType;
  options: { label: string; text: string }[];
  correctAnswers: number[];
  analysis: string;
  userAnswers: number[];
  isCorrect: boolean;
  wrongReason: string;
  note: string;
  difficulty: string;
  bankName: string;
}

@Injectable()
export class WrongBookService {
  private readonly logger = new Logger(WrongBookService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ==================== 错题原因 ====================

  async setWrongReason(
    appUserId: string,
    questionId: string,
    reason: WrongReason,
  ): Promise<{ success: boolean; questionId: string; reason: WrongReason }> {
    if (!questionId) {
      throw new BadRequestException('题目ID不能为空');
    }
    if (!reason) {
      throw new BadRequestException('错题原因不能为空');
    }

    await this.db
      .insert(userQuestionState)
      .values({
        userId: sql`ROW(${appUserId})::user_profile`,
        appUserId,
        questionId,
        wrongReason: reason,
        wrongCount: 1,
        isFavorited: false,
        mastered: false,
        attemptCount: 0,
      })
      .onConflictDoUpdate({
        target: [userQuestionState.userId, userQuestionState.questionId],
        set: { wrongReason: reason },
      });

    return { success: true, questionId, reason };
  }

  // ==================== 错题统计 ====================

  async getStats(
    appUserId: string,
    filter: WrongBookFilterOptions,
  ): Promise<WrongBookStatsResponse> {
    // 基础条件：用户 + 错题（wrong_count > 0）
    const baseConditions = [
      eq(userQuestionState.appUserId, appUserId),
      sql`${userQuestionState.wrongCount} > 0`,
    ];

    // 应用筛选条件
    const filterConditions = [...baseConditions];
    if (filter.reason) {
      filterConditions.push(eq(userQuestionState.wrongReason, filter.reason));
    }
    if (filter.difficulty) {
      filterConditions.push(eq(userQuestionState.difficulty, filter.difficulty));
    }
    if (filter.bankId) {
      // 需要联表过滤
    }

    // 总数
    const totalResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userQuestionState)
      .where(and(...filterConditions));
    const totalWrong = Number(totalResult[0]?.count ?? 0);

    // 按原因分布
    const byReasonRows = await this.db
      .select({
        reason: userQuestionState.wrongReason,
        count: sql<number>`COUNT(*)`,
      })
      .from(userQuestionState)
      .where(and(...filterConditions))
      .groupBy(userQuestionState.wrongReason);

    const byReason = byReasonRows
      .filter((r) => r.reason)
      .map((r) => ({
        reason: r.reason as WrongReason,
        count: Number(r.count),
        rate: totalWrong > 0 ? Number(r.count) / totalWrong : 0,
      }));

    // 按题型分布（需要 JOIN question 表）
    const byTypeRows = await this.db
      .select({
        type: question.questionType,
        count: sql<number>`COUNT(*)`,
      })
      .from(userQuestionState)
      .innerJoin(question, eq(userQuestionState.questionId, question.id))
      .where(and(...this.buildFilterConditionsWithBank(appUserId, filter)))
      .groupBy(question.questionType);

    const byType = byTypeRows.map((r) => ({
      type: r.type as QuestionType,
      count: Number(r.count),
      rate: totalWrong > 0 ? Number(r.count) / totalWrong : 0,
    }));

    // 按难度分布
    const byDifficultyRows = await this.db
      .select({
        difficulty: userQuestionState.difficulty,
        count: sql<number>`COUNT(*)`,
      })
      .from(userQuestionState)
      .where(and(...filterConditions))
      .groupBy(userQuestionState.difficulty);

    const diffMap = new Map(
      byDifficultyRows.map((r) => [r.difficulty ?? 'medium', Number(r.count)]),
    );
    const difficultyLevels: DifficultyLevel[] = ['easy', 'medium', 'hard'];
    const byDifficulty = difficultyLevels.map((level) => {
      const count = diffMap.get(level) ?? 0;
      return {
        difficulty: level,
        count,
        rate: totalWrong > 0 ? count / totalWrong : 0,
      };
    });

    // 按知识点（标签）分布
    const byKnowledgeRows = await this.db
      .select({
        tagId: questionTag.id,
        tagName: questionTag.name,
        count: sql<number>`COUNT(*)`,
      })
      .from(userQuestionState)
      .innerJoin(
        questionTagRel,
        eq(userQuestionState.questionId, questionTagRel.questionId),
      )
      .innerJoin(questionTag, eq(questionTagRel.tagId, questionTag.id))
      .where(and(...this.buildFilterConditionsWithBank(appUserId, filter)))
      .groupBy(questionTag.id, questionTag.name);

    const byKnowledge = byKnowledgeRows.map((r) => ({
      tagId: r.tagId,
      tagName: r.tagName,
      count: Number(r.count),
      rate: totalWrong > 0 ? Number(r.count) / totalWrong : 0,
    }));

    // 按日期趋势（近30天，基于 lastWrongAt）
    const byDate = await this.getWrongByDate(appUserId, filter, 30);

    return {
      totalWrong,
      byReason,
      byType,
      byDifficulty,
      byKnowledge,
      byDate,
    };
  }

  private buildFilterConditionsWithBank(
    appUserId: string,
    filter: WrongBookFilterOptions,
  ): ReturnType<typeof and>[] {
    const conditions = [
      eq(userQuestionState.appUserId, appUserId),
      sql`${userQuestionState.wrongCount} > 0`,
    ];
    if (filter.reason) {
      conditions.push(eq(userQuestionState.wrongReason, filter.reason));
    }
    if (filter.difficulty) {
      conditions.push(eq(userQuestionState.difficulty, filter.difficulty));
    }
    if (filter.tagId) {
      // tag 过滤需要用子查询或 EXISTS，这里简化处理
    }
    if (filter.bankId) {
      conditions.push(eq(question.bankId, filter.bankId));
    }
    return conditions;
  }

  private async getWrongByDate(
    appUserId: string,
    filter: WrongBookFilterOptions,
    days: number,
  ): Promise<{ date: string; count: number }[]> {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days + 1);
    const startStr = this.formatDate(startDate);

    const baseConditions = [
      eq(userQuestionState.appUserId, appUserId),
      sql`${userQuestionState.wrongCount} > 0`,
      gte(userQuestionState.lastWrongAt, startDate),
    ];
    if (filter.reason) {
      baseConditions.push(eq(userQuestionState.wrongReason, filter.reason));
    }
    if (filter.difficulty) {
      baseConditions.push(eq(userQuestionState.difficulty, filter.difficulty));
    }

    const rows = await this.db
      .select({
        date: sql<string>`DATE(${userQuestionState.lastWrongAt})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(userQuestionState)
      .where(and(...baseConditions))
      .groupBy(sql`DATE(${userQuestionState.lastWrongAt})`)
      .orderBy(sql`DATE(${userQuestionState.lastWrongAt})`);

    const dateMap = new Map<string, number>();
    for (const row of rows) {
      dateMap.set(String(row.date), Number(row.count));
    }

    const result: { date: string; count: number }[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = this.formatDate(d);
      result.push({
        date: dateStr,
        count: dateMap.get(dateStr) ?? 0,
      });
    }
    return result;
  }

  // ==================== 错题导出 ====================

  async exportWrongBook(
    appUserId: string,
    params: {
      format: 'pdf' | 'word';
      scope: 'all' | 'filtered' | 'date_range';
      reasonFilter?: string[];
      startDate?: string;
      endDate?: string;
    },
  ): Promise<{ items: WrongBookExportItem[] }> {
    const conditions: ReturnType<typeof and>[] = [
      eq(userQuestionState.appUserId, appUserId),
      sql`${userQuestionState.wrongCount} > 0`,
    ];

    if (params.reasonFilter && params.reasonFilter.length > 0) {
      conditions.push(inArray(userQuestionState.wrongReason, params.reasonFilter));
    }

    if (params.scope === 'date_range') {
      if (params.startDate) {
        conditions.push(gte(userQuestionState.lastWrongAt, new Date(params.startDate)));
      }
      if (params.endDate) {
        const end = new Date(params.endDate);
        end.setDate(end.getDate() + 1);
        conditions.push(lt(userQuestionState.lastWrongAt, end));
      }
    }

    // 获取错题状态列表
    const wrongStates = await this.db
      .select({
        questionId: userQuestionState.questionId,
        wrongReason: userQuestionState.wrongReason,
        note: userQuestionState.note,
        difficulty: userQuestionState.difficulty,
      })
      .from(userQuestionState)
      .where(and(...conditions));

    if (wrongStates.length === 0) {
      return { items: [] };
    }

    const questionIds = wrongStates.map((s) => s.questionId);

    // 获取题目详情及所属题库
    const questionRows = await this.db
      .select({
        id: question.id,
        content: question.content,
        questionType: question.questionType,
        options: question.options,
        correctAnswers: question.correctAnswers,
        analysis: question.analysis,
        bankId: question.bankId,
        bankName: questionBank.name,
      })
      .from(question)
      .leftJoin(questionBank, eq(question.bankId, questionBank.id))
      .where(inArray(question.id, questionIds));

    const questionMap = new Map(questionRows.map((q) => [q.id, q]));

    // 获取用户最新的答题记录（找最近一次作答）
    const answerRows = await this.db
      .select({
        questionId: practiceAnswer.questionId,
        userAnswers: practiceAnswer.userAnswers,
        isCorrect: practiceAnswer.isCorrect,
      })
      .from(practiceAnswer)
      .where(and(
        eq(practiceAnswer.appUserId, appUserId),
        inArray(practiceAnswer.questionId, questionIds),
      ))
      .orderBy(sql`${practiceAnswer.createdAt} DESC`);

    const answerMap = new Map<string, {
      userAnswers: number[];
      isCorrect: boolean;
    }>();
    for (const a of answerRows) {
      if (!answerMap.has(a.questionId)) {
        answerMap.set(a.questionId, {
          userAnswers: a.userAnswers as unknown as number[],
          isCorrect: a.isCorrect,
        });
      }
    }

    const items: WrongBookExportItem[] = wrongStates.map((state) => {
      const q = questionMap.get(state.questionId);
      const ans = answerMap.get(state.questionId);
      return {
        questionId: state.questionId,
        content: q?.content ?? '',
        questionType: (q?.questionType ?? 'single') as QuestionType,
        options: (q?.options as unknown as { label: string; text: string }[]) ?? [],
        correctAnswers: (q?.correctAnswers as unknown as number[]) ?? [],
        analysis: q?.analysis ?? '',
        userAnswers: ans?.userAnswers ?? [],
        isCorrect: ans?.isCorrect ?? false,
        wrongReason: state.wrongReason ?? '',
        note: state.note ?? '',
        difficulty: state.difficulty ?? 'medium',
        bankName: q?.bankName ?? '',
      };
    });

    return { items };
  }

  // ==================== 工具方法 ====================

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
