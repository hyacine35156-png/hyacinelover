import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, desc, count, sql, and } from 'drizzle-orm';

import {
  questionBankRating,
  questionBank,
  appUser,
} from '@server/database/schema';
import type {
  BankRatingItem,
  BankRatingListResponse,
  SubmitRatingRequest,
  SubmitRatingResponse,
  DeleteRatingResponse,
} from '@shared/api.interface';

interface RatingWithUsername {
  id: string;
  bankId: string;
  appUserId: string | null;
  rating: number;
  comment: string | null;
  createdAt: Date;
  username: string | null;
}

@Injectable()
export class BankRatingService {
  private readonly logger = new Logger(BankRatingService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listRatings(
    bankId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<BankRatingListResponse> {
    if (!bankId) {
      throw new BadRequestException('缺少题集ID');
    }

    // 校验题库可见性：仅公开题库的评分对匿名用户可见
    const bank = await this.db
      .select({ id: questionBank.id, isPublic: questionBank.isPublic })
      .from(questionBank)
      .where(eq(questionBank.id, bankId))
      .limit(1);
    if (bank.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    if (!bank[0].isPublic) {
      throw new ForbiddenException('私有题集的评分需登录后查看');
    }

    const limit = Math.min(50, Math.max(1, pageSize));
    const offset = (page - 1) * limit;

    const rows = await this.db
      .select({
        id: questionBankRating.id,
        bankId: questionBankRating.bankId,
        appUserId: questionBankRating.appUserId,
        rating: questionBankRating.rating,
        comment: questionBankRating.comment,
        createdAt: questionBankRating.createdAt,
        username: appUser.username,
      })
      .from(questionBankRating)
      .leftJoin(
        appUser,
        eq(questionBankRating.appUserId, appUser.id),
      )
      .where(eq(questionBankRating.bankId, bankId))
      .orderBy(desc(questionBankRating.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await this.db
      .select({ count: count() })
      .from(questionBankRating)
      .where(eq(questionBankRating.bankId, bankId));

    const total = Number(countResult[0]?.count ?? 0);

    const stats = await this.db
      .select({
        avg: sql<number>`ROUND(COALESCE(AVG(${questionBankRating.rating}), 0)::numeric, 1)`,
        cnt: sql<number>`count(*)::bigint`,
      })
      .from(questionBankRating)
      .where(eq(questionBankRating.bankId, bankId));

    const avgRating = Number(stats[0]?.avg ?? 0);
    const ratingCount = Number(stats[0]?.cnt ?? 0);

    const items: BankRatingItem[] = rows.map((row: RatingWithUsername) => ({
      id: row.id,
      bankId: row.bankId,
      userId: row.appUserId ?? '',
      username: row.username ?? '匿名用户',
      rating: row.rating,
      comment: row.comment ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));

    return { items, total, avgRating, ratingCount };
  }

  async submitRating(
    appUserId: string,
    username: string,
    dto: SubmitRatingRequest,
  ): Promise<SubmitRatingResponse> {
    if (!dto.bankId) {
      throw new BadRequestException('缺少题集ID');
    }
    if (dto.rating === undefined || dto.rating === null) {
      throw new BadRequestException('缺少评分');
    }
    const ratingNum = Number(dto.rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      throw new BadRequestException('评分必须在 1-5 之间');
    }

    const bank = await this.db
      .select({ id: questionBank.id, isPublic: questionBank.isPublic, appUserId: questionBank.appUserId })
      .from(questionBank)
      .where(eq(questionBank.id, dto.bankId))
      .limit(1);
    if (bank.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    // 仅允许对公开题库或自己的题库评分
    if (!bank[0].isPublic && bank[0].appUserId !== appUserId) {
      throw new ForbiddenException('无权对该题集评分');
    }

    let ratingId: string = '';

    await this.db.transaction(async (tx) => {
      const existing = await tx
        .select({
          id: questionBankRating.id,
          appUserId: questionBankRating.appUserId,
        })
        .from(questionBankRating)
        .where(and(
          eq(questionBankRating.bankId, dto.bankId),
          eq(questionBankRating.appUserId, appUserId),
        ))
        .limit(1);

      if (existing.length > 0) {
        ratingId = existing[0].id;
        await tx
          .update(questionBankRating)
          .set({
            rating: ratingNum,
            comment: dto.comment !== undefined ? dto.comment : undefined,
          })
          .where(eq(questionBankRating.id, ratingId));
      } else {
        const inserted = await tx
          .insert(questionBankRating)
          .values({
            bankId: dto.bankId,
            userId: appUserId,
            appUserId,
            rating: ratingNum,
            comment: dto.comment,
          })
          .returning({ id: questionBankRating.id });
        ratingId = inserted[0].id;
      }

      await this.recalculateBankStats(tx, dto.bankId);
    });

    const stats = await this.getBankStats(dto.bankId);

    if (!ratingId) {
      throw new BadRequestException('评分提交失败');
    }

    this.logger.log(
      `评分提交 bankId=${dto.bankId} user=${username} rating=${ratingNum}`,
    );

    return {
      id: ratingId,
      avgRating: stats.avgRating,
      ratingCount: stats.ratingCount,
    };
  }

  async deleteRating(
    appUserId: string,
    username: string,
    bankId: string,
  ): Promise<DeleteRatingResponse> {
    if (!bankId) {
      throw new BadRequestException('缺少题集ID');
    }

    let success = false;

    await this.db.transaction(async (tx) => {
      const existing = await tx
        .select({
          id: questionBankRating.id,
          appUserId: questionBankRating.appUserId,
        })
        .from(questionBankRating)
        .where(and(
          eq(questionBankRating.bankId, bankId),
          eq(questionBankRating.appUserId, appUserId),
        ))
        .limit(1);

      if (existing.length === 0) {
        throw new NotFoundException('评分不存在');
      }

      if (existing[0].appUserId !== appUserId) {
        throw new ForbiddenException('只能删除自己的评分');
      }

      await tx
        .delete(questionBankRating)
        .where(eq(questionBankRating.id, existing[0].id));

      await this.recalculateBankStats(tx, bankId);
      success = true;
    });

    const stats = await this.getBankStats(bankId);

    this.logger.log(
      `评分删除 bankId=${bankId} user=${username}`,
    );

    return {
      success,
      avgRating: stats.avgRating,
      ratingCount: stats.ratingCount,
    };
  }

  private async recalculateBankStats(
    tx: PostgresJsDatabase,
    bankId: string,
  ): Promise<void> {
    const stats = await tx
      .select({
        avg: sql<number>`ROUND(COALESCE(AVG(${questionBankRating.rating}), 0)::numeric, 1)`,
        cnt: sql<number>`count(*)::bigint`,
      })
      .from(questionBankRating)
      .where(eq(questionBankRating.bankId, bankId));

    const avgRating = Number(stats[0]?.avg ?? 0);
    const ratingCount = Number(stats[0]?.cnt ?? 0);

    await tx
      .update(questionBank)
      .set({
        avgRating: String(avgRating),
        ratingCount,
      })
      .where(eq(questionBank.id, bankId));
  }

  private async getBankStats(bankId: string): Promise<{
    avgRating: number;
    ratingCount: number;
  }> {
    const result = await this.db
      .select({
        avgRating: questionBank.avgRating,
        ratingCount: questionBank.ratingCount,
      })
      .from(questionBank)
      .where(eq(questionBank.id, bankId))
      .limit(1);

    if (result.length === 0) {
      return { avgRating: 0, ratingCount: 0 };
    }

    return {
      avgRating: Number(result[0].avgRating ?? 0),
      ratingCount: result[0].ratingCount ?? 0,
    };
  }
}
