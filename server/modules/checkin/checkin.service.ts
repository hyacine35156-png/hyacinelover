import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, count, gte } from 'drizzle-orm';

import { checkinSetting, dailyAnswerRecord } from '@server/database/schema';

import type {
  CheckinSettingItem,
  CheckinStatusResponse,
  UpdateCheckinSettingRequest,
  CheckinHistoryItem,
  CheckinHistoryResponse,
} from '@shared/api.interface';

const DEFAULT_SETTING: CheckinSettingItem = {
  isEnabled: false,
  dailyTarget: 10,
};

const MIN_DAILY_TARGET = 1;
const MAX_DAILY_TARGET = 200;

@Injectable()
export class CheckinService {
  private readonly logger = new Logger(CheckinService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getSetting(userId: string): Promise<CheckinSettingItem> {
    const rows = await this.db
      .select({
        isEnabled: checkinSetting.isEnabled,
        dailyTarget: checkinSetting.dailyTarget,
      })
      .from(checkinSetting)
      .where(eq(checkinSetting.userId, userId))
      .limit(1);

    if (rows.length === 0) {
      return { ...DEFAULT_SETTING };
    }
    return rows[0];
  }

  async updateSetting(
    userId: string,
    dto: UpdateCheckinSettingRequest,
  ): Promise<CheckinSettingItem> {
    if (
      dto.dailyTarget !== undefined &&
      (dto.dailyTarget < MIN_DAILY_TARGET || dto.dailyTarget > MAX_DAILY_TARGET)
    ) {
      throw new BadRequestException(
        `每日目标必须在 ${MIN_DAILY_TARGET}-${MAX_DAILY_TARGET} 之间`,
      );
    }

    const current = await this.getSetting(userId);
    const nextIsEnabled = dto.isEnabled !== undefined ? dto.isEnabled : current.isEnabled;
    const nextDailyTarget =
      dto.dailyTarget !== undefined ? dto.dailyTarget : current.dailyTarget;

    await this.db
      .insert(checkinSetting)
      .values({
        userId,
        isEnabled: nextIsEnabled,
        dailyTarget: nextDailyTarget,
      })
      .onConflictDoUpdate({
        target: checkinSetting.userId,
        set: {
          ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
          ...(dto.dailyTarget !== undefined && { dailyTarget: dto.dailyTarget }),
        },
      });

    return { isEnabled: nextIsEnabled, dailyTarget: nextDailyTarget };
  }

  async getStatus(userId: string): Promise<CheckinStatusResponse> {
    const setting = await this.getSetting(userId);
    const todayStr = this.getTodayStr();

    const todayRows = await this.db
      .select({ count: count() })
      .from(dailyAnswerRecord)
      .where(
        and(
          eq(dailyAnswerRecord.userId, userId),
          eq(dailyAnswerRecord.answerDate, todayStr),
        ),
      );
    const todayAnswered = Number(todayRows[0]?.count ?? 0);
    const todayCompleted = todayAnswered >= setting.dailyTarget;

    const dailyCounts = await this.getDailyCountsMap(userId);
    const streakDays = this.calcStreakDays(dailyCounts, setting.dailyTarget, todayStr);
    const totalCheckinDays = this.calcTotalCheckinDays(
      dailyCounts,
      setting.dailyTarget,
    );

    return {
      isEnabled: setting.isEnabled,
      dailyTarget: setting.dailyTarget,
      todayAnswered,
      todayCompleted,
      streakDays,
      totalCheckinDays,
    };
  }

  async recordAnswer(
    userId: string,
    questionId: string,
  ): Promise<{ todayAnswered: number; todayCompleted: boolean }> {
    const todayStr = this.getTodayStr();
    const setting = await this.getSetting(userId);

    await this.db
      .insert(dailyAnswerRecord)
      .values({
        userId,
        answerDate: todayStr,
        questionId,
      })
      .onConflictDoNothing({
        target: [
          dailyAnswerRecord.userId,
          dailyAnswerRecord.answerDate,
          dailyAnswerRecord.questionId,
        ],
      });

    const todayRows = await this.db
      .select({ count: count() })
      .from(dailyAnswerRecord)
      .where(
        and(
          eq(dailyAnswerRecord.userId, userId),
          eq(dailyAnswerRecord.answerDate, todayStr),
        ),
      );
    const todayAnswered = Number(todayRows[0]?.count ?? 0);
    const todayCompleted = todayAnswered >= setting.dailyTarget;

    return { todayAnswered, todayCompleted };
  }

  async getHistory(
    userId: string,
    days: number,
  ): Promise<CheckinHistoryResponse> {
    const setting = await this.getSetting(userId);
    const today = this.getShanghaiDate(new Date());
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days + 1);
    const startStr = this.formatDate(startDate);
    const todayStr = this.getTodayStr();

    const rows = await this.db
      .select({
        answerDate: dailyAnswerRecord.answerDate,
        count: count(),
      })
      .from(dailyAnswerRecord)
      .where(
        and(
          eq(dailyAnswerRecord.userId, userId),
          gte(dailyAnswerRecord.answerDate, startStr),
        ),
      )
      .groupBy(dailyAnswerRecord.answerDate)
      .orderBy(dailyAnswerRecord.answerDate);

    const countMap = new Map<string, number>();
    for (const row of rows) {
      countMap.set(row.answerDate, Number(row.count));
    }

    const items: CheckinHistoryItem[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = this.formatDate(d);
      const answered = countMap.get(dateStr) ?? 0;
      items.push({
        date: dateStr,
        answered,
        completed: answered >= setting.dailyTarget,
      });
    }

    // streak and total computed from all history (same as getStatus)
    const dailyCounts = await this.getDailyCountsMap(userId);
    const streakDays = this.calcStreakDays(dailyCounts, setting.dailyTarget, todayStr);
    const totalCheckinDays = this.calcTotalCheckinDays(
      dailyCounts,
      setting.dailyTarget,
    );

    return { items, streakDays, totalCheckinDays };
  }

  // --- helpers ---

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

  /**
   * 获取用户所有有答题记录的日期及其答题数，返回 Map<dateStr, count>。
   */
  private async getDailyCountsMap(
    userId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.db
      .select({
        answerDate: dailyAnswerRecord.answerDate,
        count: count(),
      })
      .from(dailyAnswerRecord)
      .where(eq(dailyAnswerRecord.userId, userId))
      .groupBy(dailyAnswerRecord.answerDate);

    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.answerDate, Number(row.count));
    }
    return map;
  }

  /**
   * 计算连续打卡天数：
   * - 今天达标：从今天开始往前数
   * - 今天未达标：从昨天开始往前数（避免用户当天还没做题就显示0）
   * 每天 answered >= target 才算连续，遇到断开停止。
   */
  private calcStreakDays(
    dailyCounts: Map<string, number>,
    target: number,
    todayStr: string,
  ): number {
    let streak = 0;
    const current = new Date(todayStr);
    // 检查今天是否达标
    const todayAnswered = dailyCounts.get(this.formatDate(current)) ?? 0;
    if (todayAnswered < target) {
      // 今天未达标，从昨天开始计数
      current.setDate(current.getDate() - 1);
    }
    // 往前推
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

  /**
   * 累计打卡天数：所有答题数 >= target 的不同日期数量。
   */
  private calcTotalCheckinDays(
    dailyCounts: Map<string, number>,
    target: number,
  ): number {
    let total = 0;
    for (const [, answered] of dailyCounts) {
      if (answered >= target) {
        total += 1;
      }
    }
    return total;
  }
}
