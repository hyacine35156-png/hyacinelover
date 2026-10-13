import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, count, sql, gte, lt } from 'drizzle-orm';

import {
  practiceRecord,
  practiceAnswer,
  question,
  questionTag,
  questionTagRel,
  checkinSetting,
  dailyAnswerRecord,
  questionBank,
} from '@server/database/schema';
import type {
  LearningDashboardResponse,
  KnowledgeMasteryResponse,
  KnowledgeMasteryItem,
  LearningGoalsItem,
  UpdateLearningGoalsRequest,
  CheckinCalendarResponse,
  QuestionType,
  PracticeRecordItem,
} from '@shared/api.interface';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ==================== 学习仪表盘 ====================

  async getDashboard(appUserId: string): Promise<LearningDashboardResponse> {
    const today = this.getTodayStr();
    const weekRange = this.getNaturalWeekRange();
    const monthRange = this.getNaturalMonthRange();

    // 今日数据
    const todayStats = await this.getPeriodStats(appUserId, today, null);

    // 本周数据
    const weekStats = await this.getPeriodStats(
      appUserId,
      weekRange.start,
      weekRange.end,
    );

    // 本月数据
    const monthStats = await this.getPeriodStats(
      appUserId,
      monthRange.start,
      monthRange.end,
    );

    // 累计数据
    const totalStats = await this.getTotalStats(appUserId);

    // 趋势数据
    const trend7 = await this.getTrendData(appUserId, 7);
    const trend30 = await this.getTrendData(appUserId, 30);

    // 题型分布
    const typeDistribution = await this.getTypeDistribution(appUserId);

    // 最近5条练习记录
    const recentRecords = await this.getRecentRecords(appUserId, 5);

    return {
      today: todayStats,
      week: weekStats,
      month: monthStats,
      total: totalStats,
      trend7,
      trend30,
      typeDistribution,
      recentRecords,
    };
  }

  private shanghaiDate(dateStr: string, hour: number = 0): Date {
    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const d = new Date(Date.UTC(
      Number(yearStr),
      Number(monthStr) - 1,
      Number(dayStr),
      hour, 0, 0, 0,
    ));
    return new Date(d.getTime() - 8 * 60 * 60 * 1000);
  }

  private async getPeriodStats(
    appUserId: string,
    startDate: string,
    endDate: string | null,
  ): Promise<{
    answeredCount: number;
    correctCount: number;
    accuracyRate: number;
    studySeconds: number;
    dailyAvg: number;
  }> {
    const answerJoinConditions: (ReturnType<typeof eq> | ReturnType<typeof sql>)[] = [
      eq(practiceAnswer.recordId, practiceRecord.id),
      sql`${practiceRecord.practiceMode} <> 'recite'`,
      gte(practiceRecord.startedAt, this.shanghaiDate(startDate)),
    ];
    if (endDate) {
      answerJoinConditions.push(lt(practiceRecord.startedAt, this.shanghaiDate(endDate)));
    }

    const answerResult = await this.db
      .select({
        answeredCount: sql<number>`COUNT(*)`,
        correctCount: sql<number>`SUM(CASE WHEN ${practiceAnswer.isCorrect} THEN 1 ELSE 0 END)`,
      })
      .from(practiceAnswer)
      .innerJoin(
        practiceRecord,
        and(...(answerJoinConditions as [any, ...any[]])),
      )
      .where(eq(practiceAnswer.appUserId, appUserId));

    const durationConditions: ReturnType<typeof and>[] = [
      eq(practiceRecord.appUserId, appUserId),
      sql`${practiceRecord.practiceMode} <> 'recite'`,
      gte(practiceRecord.startedAt, this.shanghaiDate(startDate)),
    ];
    if (endDate) {
      durationConditions.push(lt(practiceRecord.startedAt, this.shanghaiDate(endDate)));
    }
    const durationResult = await this.db
      .select({
        totalDuration: sql<number>`COALESCE(SUM(${practiceRecord.durationSeconds}), 0)`,
      })
      .from(practiceRecord)
      .where(and(...durationConditions));

    const answeredCount = Number(answerResult[0]?.answeredCount || 0);
    const correctCount = Number(answerResult[0]?.correctCount || 0);
    const studySeconds = Number(durationResult[0]?.totalDuration || 0);
    const accuracyRate = answeredCount > 0 ? correctCount / answeredCount : 0;

    const elapsedDays = endDate
      ? Math.min(this.getDaysDiff(startDate, endDate), this.getElapsedDays(startDate, endDate))
      : 1;
    return {
      answeredCount,
      correctCount,
      accuracyRate,
      studySeconds,
      dailyAvg: elapsedDays > 0 ? answeredCount / elapsedDays : 0,
    };
  }

  private async getTotalStats(appUserId: string): Promise<{
    answeredCount: number;
    correctCount: number;
    accuracyRate: number;
    studySeconds: number;
    studyDays: number;
  }> {
    const answerResult = await this.db
      .select({
        answeredCount: sql<number>`COUNT(*)`,
        correctCount: sql<number>`SUM(CASE WHEN ${practiceAnswer.isCorrect} THEN 1 ELSE 0 END)`,
      })
      .from(practiceAnswer)
      .innerJoin(
        practiceRecord,
        and(
          eq(practiceAnswer.recordId, practiceRecord.id),
          sql`${practiceRecord.practiceMode} <> 'recite'`,
        ),
      )
      .where(eq(practiceAnswer.appUserId, appUserId));

    const durationResult = await this.db
      .select({
        totalDuration: sql<number>`COALESCE(SUM(${practiceRecord.durationSeconds}), 0)`,
      })
      .from(practiceRecord)
      .where(and(
        eq(practiceRecord.appUserId, appUserId),
        sql`${practiceRecord.practiceMode} <> 'recite'`,
      ));

    const row = answerResult[0];
    const answeredCount = Number(row.answeredCount || 0);
    const correctCount = Number(row.correctCount || 0);
    const studySeconds = Number(durationResult[0]?.totalDuration || 0);
    const accuracyRate = answeredCount > 0 ? correctCount / answeredCount : 0;

    const daysResult = await this.db
      .select({ count: count() })
      .from(dailyAnswerRecord)
      .where(eq(dailyAnswerRecord.userId, appUserId))
      .groupBy(dailyAnswerRecord.answerDate);

    return {
      answeredCount,
      correctCount,
      accuracyRate,
      studySeconds,
      studyDays: daysResult.length,
    };
  }

  private async getTrendData(
    appUserId: string,
    days: number,
  ): Promise<{ date: string; answeredCount: number; accuracyRate: number }[]> {
    const startDate = this.getDateRange(days).start;
    const start = this.shanghaiDate(startDate);

    const rows = await this.db
      .select({
        date: sql<string>`DATE(${practiceRecord.startedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')`,
        answeredCount: count(),
        correctCount: sql<number>`SUM(CASE WHEN ${practiceAnswer.isCorrect} THEN 1 ELSE 0 END)`,
      })
      .from(practiceAnswer)
      .innerJoin(
        practiceRecord,
        and(
          eq(practiceAnswer.recordId, practiceRecord.id),
          sql`${practiceRecord.practiceMode} <> 'recite'`,
        ),
      )
      .where(and(
        eq(practiceAnswer.appUserId, appUserId),
        gte(practiceRecord.startedAt, start),
      ))
      .groupBy(sql`DATE(${practiceRecord.startedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')`)
      .orderBy(sql`DATE(${practiceRecord.startedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')`);

    const map = new Map<string, { answeredCount: number; correctCount: number }>();
    for (const row of rows) {
      const dateStr = String(row.date);
      map.set(dateStr, {
        answeredCount: Number(row.answeredCount),
        correctCount: Number(row.correctCount),
      });
    }

    const result: { date: string; answeredCount: number; accuracyRate: number }[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = this.formatDate(d);
      const data = map.get(dateStr) ?? { answeredCount: 0, correctCount: 0 };
      result.push({
        date: dateStr,
        answeredCount: data.answeredCount,
        accuracyRate: data.answeredCount > 0
          ? data.correctCount / data.answeredCount
          : 0,
      });
    }
    return result;
  }

  private async getTypeDistribution(appUserId: string): Promise<{
    type: QuestionType;
    count: number;
    accuracyRate: number;
  }[]> {
    const rows = await this.db
      .select({
        questionType: question.questionType,
        totalCount: sql<number>`COUNT(*)`,
        correctCount: sql<number>`SUM(CASE WHEN ${practiceAnswer.isCorrect} THEN 1 ELSE 0 END)`,
      })
      .from(practiceAnswer)
      .innerJoin(question, eq(practiceAnswer.questionId, question.id))
      .innerJoin(
        practiceRecord,
        and(
          eq(practiceAnswer.recordId, practiceRecord.id),
          sql`${practiceRecord.practiceMode} <> 'recite'`,
        ),
      )
      .where(eq(practiceAnswer.appUserId, appUserId))
      .groupBy(question.questionType);

    return rows.map((row) => {
      const count = Number(row.totalCount);
      const correct = Number(row.correctCount);
      return {
        type: row.questionType as QuestionType,
        count,
        accuracyRate: count > 0 ? correct / count : 0,
      };
    });
  }

  private async getRecentRecords(
    appUserId: string,
    limit: number,
  ): Promise<PracticeRecordItem[]> {
    const records = await this.db
      .select({
        id: practiceRecord.id,
        bankId: practiceRecord.bankId,
        bankName: questionBank.name,
        totalCount: practiceRecord.totalCount,
        correctCount: practiceRecord.correctCount,
        wrongCount: sql<number>`(
          SELECT COUNT(*) FROM ${practiceAnswer}
          WHERE ${practiceAnswer.recordId} = ${practiceRecord.id}
            AND ${practiceAnswer.isCorrect} = false
            AND ${practiceAnswer.appUserId} = ${appUserId}
        )`,
        unansweredCount: sql<number>`
          ${practiceRecord.totalCount} - (
            SELECT COUNT(*) FROM ${practiceAnswer}
            WHERE ${practiceAnswer.recordId} = ${practiceRecord.id}
              AND ${practiceAnswer.appUserId} = ${appUserId}
          )
        `,
        accuracyRate: practiceRecord.accuracyRate,
        durationSeconds: practiceRecord.durationSeconds,
        finishedAt: practiceRecord.finishedAt,
        practiceMode: practiceRecord.practiceMode,
      })
      .from(practiceRecord)
      .leftJoin(questionBank, eq(practiceRecord.bankId, questionBank.id))
      .where(and(
        eq(practiceRecord.appUserId, appUserId),
        eq(practiceRecord.status, 'finished'),
        sql`${practiceRecord.practiceMode} <> 'recite'`,
      ))
      .orderBy(desc(practiceRecord.finishedAt))
      .limit(limit);

    return records.map((r) => ({
      id: r.id,
      bankId: r.bankId,
      bankName: r.bankName ?? '',
      totalCount: r.totalCount,
      correctCount: r.correctCount,
      wrongCount: Number(r.wrongCount),
      unansweredCount: Number(r.unansweredCount),
      accuracyRate: Number(r.accuracyRate),
      durationSeconds: r.durationSeconds,
      finishedAt: r.finishedAt?.toISOString() ?? '',
      practiceMode: (r.practiceMode ?? 'basic') as 'basic' | 'recite' | 'quick',
    }));
  }

  // ==================== 知识点掌握度 ====================

  async getKnowledgeMastery(
    appUserId: string,
  ): Promise<KnowledgeMasteryResponse> {
    // 通过 practiceAnswer -> questionTagRel -> questionTag 统计每个标签的正确率
    const rows = await this.db
      .select({
        tagId: questionTag.id,
        tagName: questionTag.name,
        totalCount: sql<number>`COUNT(*)`,
        correctCount: sql<number>`SUM(CASE WHEN ${practiceAnswer.isCorrect} THEN 1 ELSE 0 END)`,
      })
      .from(practiceAnswer)
      .innerJoin(
        practiceRecord,
        and(
          eq(practiceAnswer.recordId, practiceRecord.id),
          sql`${practiceRecord.practiceMode} <> 'recite'`,
        ),
      )
      .innerJoin(
        questionTagRel,
        eq(practiceAnswer.questionId, questionTagRel.questionId),
      )
      .innerJoin(questionTag, eq(questionTagRel.tagId, questionTag.id))
      .where(eq(practiceAnswer.appUserId, appUserId))
      .groupBy(questionTag.id, questionTag.name)
      .orderBy(questionTag.name);

    const items: KnowledgeMasteryItem[] = rows.map((row) => {
      const totalCount = Number(row.totalCount);
      const correctCount = Number(row.correctCount);
      const accuracyRate = totalCount > 0 ? correctCount / totalCount : 0;
      const masteryLevel = this.getMasteryLevel(accuracyRate);
      return {
        tagId: row.tagId,
        tagName: row.tagName,
        totalCount,
        correctCount,
        accuracyRate,
        masteryLevel,
      };
    });

    const weakCount = items.filter((i) => i.masteryLevel === 'weak').length;

    return { items, weakCount };
  }

  private getMasteryLevel(rate: number): KnowledgeMasteryItem['masteryLevel'] {
    if (rate >= 0.8) return 'mastered';
    if (rate >= 0.6) return 'good';
    if (rate >= 0.4) return 'fair';
    return 'weak';
  }

  // ==================== 学习目标 ====================

  async getLearningGoals(appUserId: string): Promise<LearningGoalsItem> {
    const setting = await this.getCheckinSetting(appUserId);
    const todayStr = this.getTodayStr();

    // 今日进度
    const todayAnswered = await this.getDayAnsweredCount(appUserId, todayStr);
    const todayStudySeconds = await this.getDayStudySeconds(appUserId, todayStr);

    // 本周进度
    const weekStart = this.getWeekStart();
    const weekEnd = this.getWeekEnd();
    const weekAnswered = await this.getRangeAnsweredCount(
      appUserId,
      weekStart,
      weekEnd,
    );
    const weekStudySeconds = await this.getRangeStudySeconds(
      appUserId,
      weekStart,
      weekEnd,
    );

    const answeredPercentDaily = setting.dailyTarget > 0
      ? Math.min(100, Math.round((todayAnswered / setting.dailyTarget) * 100))
      : 0;
    const studyPercentDaily = setting.dailyTimeTarget > 0
      ? Math.min(100, Math.round((todayStudySeconds / 60 / setting.dailyTimeTarget) * 100))
      : 0;

    const answeredPercentWeekly = setting.weeklyTarget > 0
      ? Math.min(100, Math.round((weekAnswered / setting.weeklyTarget) * 100))
      : 0;
    const studyPercentWeekly = setting.weeklyTimeTarget > 0
      ? Math.min(100, Math.round((weekStudySeconds / 60 / setting.weeklyTimeTarget) * 100))
      : 0;

    return {
      dailyTarget: setting.dailyTarget,
      weeklyTarget: setting.weeklyTarget,
      dailyTimeTarget: setting.dailyTimeTarget,
      weeklyTimeTarget: setting.weeklyTimeTarget,
      todayProgress: {
        answeredCount: todayAnswered,
        answeredPercent: answeredPercentDaily,
        studySeconds: todayStudySeconds,
        studyPercent: studyPercentDaily,
        completed: todayAnswered >= setting.dailyTarget
          && todayStudySeconds / 60 >= setting.dailyTimeTarget,
      },
      weekProgress: {
        answeredCount: weekAnswered,
        answeredPercent: answeredPercentWeekly,
        studySeconds: weekStudySeconds,
        studyPercent: studyPercentWeekly,
        completed: weekAnswered >= setting.weeklyTarget
          && weekStudySeconds / 60 >= setting.weeklyTimeTarget,
      },
    };
  }

  async updateLearningGoals(
    appUserId: string,
    dto: UpdateLearningGoalsRequest,
  ): Promise<LearningGoalsItem> {
    this.validateGoals(dto);

    const current = await this.getCheckinSetting(appUserId);
    const patch: Record<string, number> = {};
    if (dto.dailyTarget !== undefined) patch.dailyTarget = dto.dailyTarget;
    if (dto.weeklyTarget !== undefined) patch.weeklyTarget = dto.weeklyTarget;
    if (dto.dailyTimeTarget !== undefined) patch.dailyTimeTarget = dto.dailyTimeTarget;
    if (dto.weeklyTimeTarget !== undefined) patch.weeklyTimeTarget = dto.weeklyTimeTarget;

    await this.db
      .insert(checkinSetting)
      .values({
        userId: appUserId,
        isEnabled: true,
        dailyTarget: dto.dailyTarget ?? current.dailyTarget,
        weeklyTarget: dto.weeklyTarget ?? current.weeklyTarget,
        dailyTimeTarget: dto.dailyTimeTarget ?? current.dailyTimeTarget,
        weeklyTimeTarget: dto.weeklyTimeTarget ?? current.weeklyTimeTarget,
      })
      .onConflictDoUpdate({
        target: checkinSetting.userId,
        set: patch,
      });

    return this.getLearningGoals(appUserId);
  }

  private validateGoals(dto: UpdateLearningGoalsRequest): void {
    if (dto.dailyTarget !== undefined && dto.dailyTarget <= 0) {
      throw new BadRequestException('每日目标必须大于0');
    }
    if (dto.weeklyTarget !== undefined && dto.weeklyTarget <= 0) {
      throw new BadRequestException('每周目标必须大于0');
    }
    if (dto.dailyTimeTarget !== undefined && dto.dailyTimeTarget <= 0) {
      throw new BadRequestException('每日时间目标必须大于0');
    }
    if (dto.weeklyTimeTarget !== undefined && dto.weeklyTimeTarget <= 0) {
      throw new BadRequestException('每周时间目标必须大于0');
    }
  }

  private async getCheckinSetting(appUserId: string): Promise<{
    dailyTarget: number;
    weeklyTarget: number;
    dailyTimeTarget: number;
    weeklyTimeTarget: number;
  }> {
    const rows = await this.db
      .select({
        dailyTarget: checkinSetting.dailyTarget,
        weeklyTarget: checkinSetting.weeklyTarget,
        dailyTimeTarget: checkinSetting.dailyTimeTarget,
        weeklyTimeTarget: checkinSetting.weeklyTimeTarget,
      })
      .from(checkinSetting)
      .where(eq(checkinSetting.userId, appUserId))
      .limit(1);

    if (rows.length === 0) {
      return {
        dailyTarget: 10,
        weeklyTarget: 50,
        dailyTimeTarget: 30,
        weeklyTimeTarget: 180,
      };
    }
    return rows[0];
  }

  private async getDayAnsweredCount(
    userId: string,
    dateStr: string,
  ): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(dailyAnswerRecord)
      .where(and(
        eq(dailyAnswerRecord.userId, userId),
        eq(dailyAnswerRecord.answerDate, dateStr),
      ));
    return Number(result[0]?.count ?? 0);
  }

  private async getRangeAnsweredCount(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(dailyAnswerRecord)
      .where(and(
        eq(dailyAnswerRecord.userId, userId),
        gte(dailyAnswerRecord.answerDate, startDate),
        lt(dailyAnswerRecord.answerDate, endDate),
      ));
    return Number(result[0]?.count ?? 0);
  }

  private async getDayStudySeconds(
    appUserId: string,
    dateStr: string,
  ): Promise<number> {
    const start = this.shanghaiDate(dateStr);
    const end = this.shanghaiDate(dateStr, 24);

    const result = await this.db
      .select({
        totalDuration: sql<number>`COALESCE(SUM(${practiceRecord.durationSeconds}), 0)`,
      })
      .from(practiceRecord)
      .where(and(
        eq(practiceRecord.appUserId, appUserId),
        sql`${practiceRecord.practiceMode} <> 'recite'`,
        gte(practiceRecord.startedAt, start),
        lt(practiceRecord.startedAt, end),
      ));

    return Number(result[0]?.totalDuration ?? 0);
  }

  private async getRangeStudySeconds(
    appUserId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const result = await this.db
      .select({
        totalDuration: sql<number>`COALESCE(SUM(${practiceRecord.durationSeconds}), 0)`,
      })
      .from(practiceRecord)
      .where(and(
        eq(practiceRecord.appUserId, appUserId),
        sql`${practiceRecord.practiceMode} <> 'recite'`,
        gte(practiceRecord.startedAt, this.shanghaiDate(startDate)),
        lt(practiceRecord.startedAt, this.shanghaiDate(endDate)),
      ));

    return Number(result[0]?.totalDuration ?? 0);
  }

  // ==================== 打卡日历 ====================

  async getCheckinCalendar(
    appUserId: string,
    days: number,
  ): Promise<CheckinCalendarResponse> {
    const setting = await this.getCheckinSetting(appUserId);
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days + 1);
    const startStr = this.formatDate(startDate);

    const rows = await this.db
      .select({
        answerDate: dailyAnswerRecord.answerDate,
        count: count(),
      })
      .from(dailyAnswerRecord)
      .where(and(
        eq(dailyAnswerRecord.userId, appUserId),
        gte(dailyAnswerRecord.answerDate, startStr),
      ))
      .groupBy(dailyAnswerRecord.answerDate)
      .orderBy(dailyAnswerRecord.answerDate);

    const countMap = new Map<string, number>();
    for (const row of rows) {
      countMap.set(row.answerDate, Number(row.count));
    }

    const calendar: { date: string; answered: number; completed: boolean }[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = this.formatDate(d);
      const answered = countMap.get(dateStr) ?? 0;
      calendar.push({
        date: dateStr,
        answered,
        completed: answered >= setting.dailyTarget,
      });
    }

    // 计算当前连续打卡天数
    const allHistory = await this.db
      .select({
        answerDate: dailyAnswerRecord.answerDate,
        count: count(),
      })
      .from(dailyAnswerRecord)
      .where(eq(dailyAnswerRecord.userId, appUserId))
      .groupBy(dailyAnswerRecord.answerDate);

    const allCountMap = new Map<string, number>();
    for (const row of allHistory) {
      allCountMap.set(row.answerDate, Number(row.count));
    }

    const todayStr = this.getTodayStr();
    const currentStreak = this.calcStreak(allCountMap, setting.dailyTarget, todayStr);
    const maxStreak = this.calcMaxStreak(allCountMap, setting.dailyTarget);
    const totalDays = Array.from(allCountMap.values()).filter(
      (c) => c >= setting.dailyTarget,
    ).length;

    return { currentStreak, maxStreak, totalDays, calendar };
  }

  private calcStreak(
    dailyCounts: Map<string, number>,
    target: number,
    todayStr: string,
  ): number {
    let streak = 0;
    const current = new Date(todayStr);
    while (true) {
      const dateStr = this.formatDate(current);
      const answered = dailyCounts.get(dateStr) ?? 0;
      if (answered >= target) {
        streak += 1;
        current.setDate(current.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  private calcMaxStreak(
    dailyCounts: Map<string, number>,
    target: number,
  ): number {
    const dates = Array.from(dailyCounts.keys()).sort();
    if (dates.length === 0) return 0;

    let maxStreak = 0;
    let currentStreak = 0;
    let prevDate: Date | null = null;

    for (const dateStr of dates) {
      const answered = dailyCounts.get(dateStr) ?? 0;
      const current = new Date(dateStr);

      if (answered >= target) {
        if (prevDate) {
          const diff = Math.round(
            (current.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (diff === 1) {
            currentStreak += 1;
          } else {
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
      prevDate = current;
    }

    return maxStreak;
  }

  // ==================== 工具方法 ====================

  private getShanghaiDate(date: Date): Date {
    const utcMs = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
    return new Date(utcMs + 8 * 60 * 60 * 1000);
  }

  private getTodayStr(): string {
    return this.formatDate(this.getShanghaiDate(new Date()));
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getDateRange(days: number): { start: string; end: string } {
    const today = this.getShanghaiDate(new Date());
    const start = new Date(today);
    start.setDate(today.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(today.getDate() + 1);
    end.setHours(0, 0, 0, 0);
    return {
      start: this.formatDate(start),
      end: this.formatDate(end),
    };
  }

  private getDaysDiff(start: string, end: string): number {
    const s = new Date(start);
    const e = new Date(end);
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  }

  private getNaturalWeekRange(): { start: string; end: string } {
    const start = this.getWeekStart();
    const end = this.getWeekEnd();
    return { start, end };
  }

  private getNaturalMonthRange(): { start: string; end: string } {
    const today = this.getShanghaiDate(new Date());
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    end.setHours(0, 0, 0, 0);
    return {
      start: this.formatDate(start),
      end: this.formatDate(end),
    };
  }

  private getElapsedDays(startDate: string, endDate: string): number {
    const today = this.getTodayStr();
    const endDay = today < endDate ? today : this.formatDate(new Date(this.shanghaiDate(endDate, 0).getTime() - 86400000));
    const diff = this.getDaysDiff(startDate, endDay);
    return Math.max(1, diff + 1);
  }

  private getWeekStart(): string {
    const today = this.getShanghaiDate(new Date());
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const start = new Date(today);
    start.setDate(today.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return this.formatDate(start);
  }

  private getWeekEnd(): string {
    const start = new Date(this.getWeekStart());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return this.formatDate(end);
  }
}
