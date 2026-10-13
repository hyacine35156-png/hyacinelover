import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, asc, count, sql, inArray } from 'drizzle-orm';

import {
  favoriteGroup,
  favoriteGroupItem,
  question,
  userQuestionState,
} from '@server/database/schema';
import type {
  FavoriteGroupItem,
  QuestionWithFavorite,
  QuestionOption,
  QuestionType,
  SubQuestion,
  WrongReason,
} from '@shared/api.interface';

function extractPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string') return code;
    current = cause;
  }
  return undefined;
}

@Injectable()
export class FavoriteGroupService {
  private readonly logger = new Logger(FavoriteGroupService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listGroups(appUserId: string): Promise<{ items: FavoriteGroupItem[]; totalCount: number }> {
    const rows = await this.db
      .select({
        id: favoriteGroup.id,
        name: favoriteGroup.name,
        sortOrder: favoriteGroup.sortOrder,
        color: favoriteGroup.color,
        questionCount: sql<number>`count(${favoriteGroupItem.questionId})`,
      })
      .from(favoriteGroup)
      .leftJoin(favoriteGroupItem, eq(favoriteGroupItem.groupId, favoriteGroup.id))
      .where(eq(favoriteGroup.appUserId, appUserId))
      .groupBy(favoriteGroup.id)
      .orderBy(asc(favoriteGroup.sortOrder), asc(favoriteGroup.createdAt));

    const items: FavoriteGroupItem[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
      color: row.color,
      questionCount: Number(row.questionCount),
    }));

    return { items, totalCount: items.length };
  }

  async createGroup(
    appUserId: string,
    dto: { name: string; color?: string },
  ): Promise<FavoriteGroupItem> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('分组名称不能为空');
    }
    if (name.length > 50) {
      throw new BadRequestException('分组名称不能超过 50 个字符');
    }
    const color = dto.color?.trim() || 'purple';

    // 获取当前最大 sortOrder
    const maxResult = await this.db
      .select({ max: sql<number>`coalesce(max(${favoriteGroup.sortOrder}), -1)` })
      .from(favoriteGroup)
      .where(eq(favoriteGroup.appUserId, appUserId));
    const nextSortOrder = Number(maxResult[0].max) + 1;

    try {
      const [row] = await this.db
        .insert(favoriteGroup)
        .values({
          name,
          color,
          sortOrder: nextSortOrder,
          userId: appUserId,
          appUserId,
        })
        .returning({
          id: favoriteGroup.id,
          name: favoriteGroup.name,
          sortOrder: favoriteGroup.sortOrder,
          color: favoriteGroup.color,
        });
      return {
        id: row.id,
        name: row.name,
        sortOrder: row.sortOrder,
        color: row.color,
        questionCount: 0,
      };
    } catch (error) {
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('同名分组已存在');
      }
      throw error;
    }
  }

  async updateGroup(
    appUserId: string,
    groupId: string,
    dto: { name?: string; color?: string; sortOrder?: number },
  ): Promise<{ success: boolean }> {
    const existing = await this.db
      .select({
        id: favoriteGroup.id,
        appUserId: favoriteGroup.appUserId,
      })
      .from(favoriteGroup)
      .where(eq(favoriteGroup.id, groupId));
    if (existing.length === 0) {
      throw new NotFoundException('分组不存在');
    }
    if (existing[0].appUserId !== appUserId) {
      throw new ForbiddenException('只有分组创建者可以修改');
    }

    const patch: Partial<typeof favoriteGroup.$inferInsert> = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('分组名称不能为空');
      if (name.length > 50) throw new BadRequestException('分组名称不能超过 50 个字符');
      patch.name = name;
    }
    if (dto.color !== undefined) {
      patch.color = dto.color.trim() || 'purple';
    }
    if (dto.sortOrder !== undefined) {
      patch.sortOrder = dto.sortOrder;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    try {
      const updated = await this.db
        .update(favoriteGroup)
        .set(patch)
        .where(and(eq(favoriteGroup.id, groupId), eq(favoriteGroup.appUserId, appUserId)))
        .returning({ id: favoriteGroup.id });
      if (updated.length === 0) throw new NotFoundException('分组不存在');
      return { success: true };
    } catch (error) {
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('同名分组已存在');
      }
      throw error;
    }
  }

  async deleteGroup(appUserId: string, groupId: string): Promise<{ success: boolean }> {
    const existing = await this.db
      .select({
        id: favoriteGroup.id,
        appUserId: favoriteGroup.appUserId,
      })
      .from(favoriteGroup)
      .where(eq(favoriteGroup.id, groupId));
    if (existing.length === 0) {
      throw new NotFoundException('分组不存在');
    }
    if (existing[0].appUserId !== appUserId) {
      throw new ForbiddenException('只有分组创建者可以删除');
    }
    await this.db
      .delete(favoriteGroup)
      .where(and(eq(favoriteGroup.id, groupId), eq(favoriteGroup.appUserId, appUserId)));
    return { success: true };
  }

  async addQuestions(
    appUserId: string,
    groupId: string,
    questionIds: string[],
  ): Promise<{ success: boolean; addedCount: number }> {
    // 验证分组归属
    const group = await this.db
      .select({ id: favoriteGroup.id, appUserId: favoriteGroup.appUserId })
      .from(favoriteGroup)
      .where(eq(favoriteGroup.id, groupId));
    if (group.length === 0) throw new NotFoundException('分组不存在');
    if (group[0].appUserId !== appUserId) {
      throw new ForbiddenException('只有分组创建者可以操作');
    }

    const uniqueIds = Array.from(new Set(questionIds));
    if (uniqueIds.length === 0) {
      throw new BadRequestException('题目 ID 列表不能为空');
    }

    // 验证题目存在
    const validQuestions = await this.db
      .select({ id: question.id })
      .from(question)
      .where(inArray(question.id, uniqueIds));
    if (validQuestions.length !== uniqueIds.length) {
      throw new BadRequestException('部分题目不存在');
    }

    // 批量插入，冲突时忽略
    let addedCount = 0;
    try {
      const result = await this.db
        .insert(favoriteGroupItem)
        .values(
          uniqueIds.map((qid) => ({
            groupId,
            questionId: qid,
            appUserId,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: favoriteGroupItem.id });
      addedCount = result.length;
    } catch (error) {
      const code = extractPostgresErrorCode(error);
      if (code !== '23505') throw error;
    }

    return { success: true, addedCount };
  }

  async removeQuestion(
    appUserId: string,
    groupId: string,
    questionId: string,
  ): Promise<{ success: boolean }> {
    const group = await this.db
      .select({ id: favoriteGroup.id, appUserId: favoriteGroup.appUserId })
      .from(favoriteGroup)
      .where(eq(favoriteGroup.id, groupId));
    if (group.length === 0) throw new NotFoundException('分组不存在');
    if (group[0].appUserId !== appUserId) {
      throw new ForbiddenException('只有分组创建者可以操作');
    }

    await this.db
      .delete(favoriteGroupItem)
      .where(
        and(
          eq(favoriteGroupItem.groupId, groupId),
          eq(favoriteGroupItem.questionId, questionId),
          eq(favoriteGroupItem.appUserId, appUserId),
        ),
      );
    return { success: true };
  }

  async moveQuestions(
    appUserId: string,
    dto: { fromGroupId?: string | null; toGroupId: string; questionIds: string[] },
  ): Promise<{ success: boolean; movedCount: number }> {
    const { fromGroupId, toGroupId, questionIds } = dto;
    const uniqueIds = Array.from(new Set(questionIds));
    if (uniqueIds.length === 0) {
      throw new BadRequestException('题目 ID 列表不能为空');
    }

    // 验证目标分组
    const toGroup = await this.db
      .select({ id: favoriteGroup.id, appUserId: favoriteGroup.appUserId })
      .from(favoriteGroup)
      .where(eq(favoriteGroup.id, toGroupId));
    if (toGroup.length === 0) throw new NotFoundException('目标分组不存在');
    if (toGroup[0].appUserId !== appUserId) {
      throw new ForbiddenException('只有分组创建者可以操作');
    }

    // 验证题目存在
    const validQuestions = await this.db
      .select({ id: question.id })
      .from(question)
      .where(inArray(question.id, uniqueIds));
    if (validQuestions.length !== uniqueIds.length) {
      throw new BadRequestException('部分题目不存在');
    }

    await this.db.transaction(async (tx) => {
      // 如果有来源分组，先从来源分组移除
      if (fromGroupId) {
        const fromGroup = await tx
          .select({ id: favoriteGroup.id, appUserId: favoriteGroup.appUserId })
          .from(favoriteGroup)
          .where(eq(favoriteGroup.id, fromGroupId));
        if (fromGroup.length === 0) throw new NotFoundException('来源分组不存在');
        if (fromGroup[0].appUserId !== appUserId) {
          throw new ForbiddenException('只有分组创建者可以操作');
        }

        await tx
          .delete(favoriteGroupItem)
          .where(
            and(
              eq(favoriteGroupItem.groupId, fromGroupId),
              inArray(favoriteGroupItem.questionId, uniqueIds),
              eq(favoriteGroupItem.appUserId, appUserId),
            ),
          );
      }

      // 插入到目标分组
      try {
        await tx
          .insert(favoriteGroupItem)
          .values(
            uniqueIds.map((qid) => ({
              groupId: toGroupId,
              questionId: qid,
              appUserId,
            })),
          )
          .onConflictDoNothing();
      } catch (error) {
        const code = extractPostgresErrorCode(error);
        if (code !== '23505') throw error;
      }
    });

    return { success: true, movedCount: uniqueIds.length };
  }

  async getGroupQuestions(
    appUserId: string,
    groupId: string,
  ): Promise<{ items: QuestionWithFavorite[]; total: number }> {
    // 验证分组归属
    const group = await this.db
      .select({ id: favoriteGroup.id, appUserId: favoriteGroup.appUserId })
      .from(favoriteGroup)
      .where(eq(favoriteGroup.id, groupId));
    if (group.length === 0) throw new NotFoundException('分组不存在');
    if (group[0].appUserId !== appUserId) {
      throw new ForbiddenException('只有分组创建者可以查看');
    }

    const rows = await this.db
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
        isFavorited: userQuestionState.isFavorited,
        wrongCount: userQuestionState.wrongCount,
        mastered: userQuestionState.mastered,
        wrongReason: userQuestionState.wrongReason,
        note: userQuestionState.note,
        difficulty: userQuestionState.difficulty,
      })
      .from(favoriteGroupItem)
      .innerJoin(question, eq(question.id, favoriteGroupItem.questionId))
      .leftJoin(
        userQuestionState,
        and(
          eq(userQuestionState.questionId, question.id),
          eq(userQuestionState.appUserId, appUserId),
        ),
      )
      .where(
        and(
          eq(favoriteGroupItem.groupId, groupId),
          eq(favoriteGroupItem.appUserId, appUserId),
        ),
      )
      .orderBy(favoriteGroupItem.createdAt);

    const items: QuestionWithFavorite[] = rows.map((row) => ({
      id: row.id,
      content: row.content,
      questionType: row.questionType as QuestionType,
      options: row.options as QuestionOption[],
      correctAnswers: row.correctAnswers as number[],
      analysis: row.analysis,
      subQuestions: row.subQuestions as SubQuestion[],
      isFavorited: row.isFavorited ?? false,
      wrongCount: row.wrongCount ?? 0,
      mastered: row.mastered ?? false,
      wrongReason: (row.wrongReason ?? null) as WrongReason | null,
      note: row.note ?? null,
      difficulty: (row.difficulty as any) ?? null,
      knowledgePoints: row.knowledgePoints ?? '',
      unitName: row.unitName ?? null,
      sortOrder: row.sortOrder ?? 0,
    }));

    return { items, total: items.length };
  }
}
