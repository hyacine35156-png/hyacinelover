import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

import {
  userQuestionState,
  question,
  questionBank,
  userSettings,
} from '@server/database/schema';
import { isKeyWrongQuestion } from '@shared/wrongbook-thresholds';
import type {
  SmartRecommendResponse,
  SmartRecommendQuestion,
  SmartRecommendReason,
} from '@shared/api.interface';

interface StreakStateResult {
  questionId: string;
  streak: number;
  target: number;
  wrongCount: number;
}

interface StreakSubmitResult {
  streak: number;
  mastered: boolean;
  wrongCount: number;
}

const DEFAULT_STREAK_TARGET = 3;

const REASON_TEXT: Record<SmartRecommendReason, string> = {
  high_freq_wrong: '高频错题',
  recent_wrong: '最近答错',
  weak_knowledge: '薄弱知识点',
};

@Injectable()
export class SmartPracticeService {
  private readonly logger = new Logger(SmartPracticeService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ==================== 智能推荐 ====================

  async getRecommend(
    appUserId: string,
    limit: number,
  ): Promise<SmartRecommendResponse> {
    const safeLimit = Math.max(1, Math.min(limit || 20, 100));

    // 7 天前日期（ISO string 用于 raw SQL 参数）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoIso = sevenDaysAgo.toISOString();

    // 一次查出所有错题状态 + 题目 + 题库
    const rows = await this.db
      .select({
        questionId: userQuestionState.questionId,
        bankId: question.bankId,
        bankName: questionBank.name,
        content: question.content,
        questionType: question.questionType,
        wrongCount: userQuestionState.wrongCount,
        attemptCount: userQuestionState.attemptCount,
        lastWrongAt: userQuestionState.lastWrongAt,
        mastered: userQuestionState.mastered,
      })
      .from(userQuestionState)
      .innerJoin(question, eq(userQuestionState.questionId, question.id))
      .leftJoin(questionBank, eq(question.bankId, questionBank.id))
      .where(
        and(
          eq(userQuestionState.appUserId, appUserId),
          sql`${userQuestionState.wrongCount} > 0`,
        ),
      );

    // 统计各维度数量
    let highFreqCount = 0;
    let recentWrongCount = 0;
    let weakKnowledgeCount = 0;

    // 按 reason 分组，用于合并去重
    const byQuestion = new Map<
      string,
      SmartRecommendQuestion & { reasons: SmartRecommendReason[] }
    >();

    for (const row of rows) {
      const reasons: SmartRecommendReason[] = [];

      // 高频错题：使用与错题本一致的判定标准
      if (isKeyWrongQuestion({
        mastered: Boolean(row.mastered),
        attemptCount: row.attemptCount ?? 0,
        wrongCount: row.wrongCount ?? 0,
      })) {
        reasons.push('high_freq_wrong');
        highFreqCount += 1;
      }

      // 最近答错：last_wrong_at 在最近 7 天内
      if (
        row.lastWrongAt &&
        new Date(row.lastWrongAt).getTime() >= new Date(sevenDaysAgoIso).getTime()
      ) {
        reasons.push('recent_wrong');
        recentWrongCount += 1;
      }

      // 薄弱知识点：mastered = false 且 wrong_count > 0
      if (!row.mastered && row.wrongCount > 0) {
        reasons.push('weak_knowledge');
        weakKnowledgeCount += 1;
      }

      if (reasons.length === 0) continue;

      const primaryReason = this.pickPrimaryReason(reasons);
      byQuestion.set(row.questionId, {
        questionId: row.questionId,
        bankId: row.bankId,
        bankName: row.bankName ?? '',
        content: row.content,
        questionType: row.questionType,
        wrongCount: row.wrongCount,
        lastWrongAt: row.lastWrongAt
          ? new Date(row.lastWrongAt).toISOString()
          : undefined,
        reason: primaryReason,
        reasonText: REASON_TEXT[primaryReason],
        reasons,
      });
    }

    // 排序：先按 reason 优先级（high_freq > recent_wrong > weak_knowledge），再按 wrongCount 降序
    const items = Array.from(byQuestion.values())
      .sort((a, b) => {
        const reasonOrder: Record<SmartRecommendReason, number> = {
          high_freq_wrong: 0,
          recent_wrong: 1,
          weak_knowledge: 2,
        };
        const orderDiff = reasonOrder[a.reason] - reasonOrder[b.reason];
        if (orderDiff !== 0) return orderDiff;
        return b.wrongCount - a.wrongCount;
      })
      .slice(0, safeLimit)
      .map((item) => {
        const { reasons: _reasons, ...rest } = item;
        return rest;
      });

    return {
      items,
      totalCount: items.length,
      highFreqCount,
      recentWrongCount,
      weakKnowledgeCount,
    };
  }

  private pickPrimaryReason(
    reasons: SmartRecommendReason[],
  ): SmartRecommendReason {
    const priority: SmartRecommendReason[] = [
      'high_freq_wrong',
      'recent_wrong',
      'weak_knowledge',
    ];
    for (const r of priority) {
      if (reasons.includes(r)) return r;
    }
    return reasons[0] ?? 'weak_knowledge';
  }

  // ==================== 错题重练 streak ====================

  async getStreakState(
    appUserId: string,
    questionId: string,
  ): Promise<StreakStateResult> {
    if (!questionId) {
      throw new BadRequestException('题目ID不能为空');
    }

    const target = await this.getStreakTarget(appUserId);

    const stateRows = await this.db
      .select({
        correctStreak: userQuestionState.correctStreak,
        wrongCount: userQuestionState.wrongCount,
      })
      .from(userQuestionState)
      .where(
        and(
          eq(userQuestionState.appUserId, appUserId),
          eq(userQuestionState.questionId, questionId),
        ),
      );

    const state = stateRows[0];
    return {
      questionId,
      streak: state?.correctStreak ?? 0,
      target,
      wrongCount: state?.wrongCount ?? 0,
    };
  }

  async submitStreak(
    appUserId: string,
    questionId: string,
    isCorrect: boolean,
  ): Promise<StreakSubmitResult> {
    if (!questionId) {
      throw new BadRequestException('题目ID不能为空');
    }

    const target = await this.getStreakTarget(appUserId);

    // 查询当前状态
    const stateRows = await this.db
      .select({
        id: userQuestionState.id,
        correctStreak: userQuestionState.correctStreak,
        wrongCount: userQuestionState.wrongCount,
        mastered: userQuestionState.mastered,
        manuallyMastered: userQuestionState.manuallyMastered,
      })
      .from(userQuestionState)
      .where(
        and(
          eq(userQuestionState.appUserId, appUserId),
          eq(userQuestionState.questionId, questionId),
        ),
      );

    if (stateRows.length === 0) {
      throw new NotFoundException('该题不存在作答记录');
    }

    const current = stateRows[0];
    let newStreak: number;
    let newWrongCount: number;
    let newMastered: boolean;

    if (isCorrect) {
      newStreak = (current.correctStreak ?? 0) + 1;
      newWrongCount = current.wrongCount ?? 0;
      if (newStreak >= target) {
        // 达标：wrong_count 置 0，mastered 置 true（移出错题本）
        newWrongCount = 0;
        newMastered = true;
      } else {
        newMastered = current.mastered ?? false;
      }
    } else {
      // 错误：streak 重置为 0，wrong_count + 1
      newStreak = 0;
      newWrongCount = (current.wrongCount ?? 0) + 1;
      // 用户手动标记的掌握不被答错重置
      newMastered = current.manuallyMastered ? true : false;
    }

    await this.db
      .update(userQuestionState)
      .set({
        correctStreak: newStreak,
        wrongCount: newWrongCount,
        mastered: newMastered,
        lastPracticedAt: new Date(),
        ...(isCorrect
          ? {}
          : { lastWrongAt: new Date() }),
      })
      .where(eq(userQuestionState.id, current.id));

    return {
      streak: newStreak,
      mastered: newMastered,
      wrongCount: newWrongCount,
    };
  }

  private async getStreakTarget(appUserId: string): Promise<number> {
    const rows = await this.db
      .select({
        wrongBookStreakTarget: userSettings.wrongBookStreakTarget,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, appUserId));

    if (rows.length > 0 && rows[0].wrongBookStreakTarget != null) {
      return Number(rows[0].wrongBookStreakTarget);
    }
    return DEFAULT_STREAK_TARGET;
  }
}
