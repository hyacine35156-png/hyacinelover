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
import { eq, and, or, desc, count, sql, inArray } from 'drizzle-orm';

import { questionTag, questionTagRel, question, questionBank, userQuestionState } from '@server/database/schema';
import type {
  QuestionTagItem,
  QuestionWithFavorite,
  QuestionOption,
  QuestionType,
  GlobalSearchQuestionItem,
  LabelType,
  SubQuestion,
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
export class QuestionTagService {
  private readonly logger = new Logger(QuestionTagService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listTags(appUserId: string): Promise<QuestionTagItem[]> {
    const rows = await this.db
      .select({
        id: questionTag.id,
        name: questionTag.name,
        color: questionTag.color,
        labelType: questionTag.labelType,
        questionCount: sql<number>`count(${questionTagRel.questionId})`,
        createdAt: questionTag.createdAt,
      })
      .from(questionTag)
      .leftJoin(questionTagRel, eq(questionTagRel.tagId, questionTag.id))
      .where(eq(questionTag.appUserId, appUserId))
      .groupBy(questionTag.id)
      .orderBy(desc(questionTag.createdAt));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      labelType: row.labelType as LabelType,
      questionCount: Number(row.questionCount),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createTag(
    appUserId: string,
    dto: { name: string; color?: string; labelType?: LabelType },
  ): Promise<QuestionTagItem> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('标签名称不能为空');
    }
    if (name.length > 50) {
      throw new BadRequestException('标签名称不能超过 50 个字符');
    }
    const color = dto.color?.trim() || 'blue';
    const labelType: LabelType = 'private';

    try {
      const [row] = await this.db
        .insert(questionTag)
        .values({
          name,
          color,
          labelType,
          appUserId,
        })
        .returning({
          id: questionTag.id,
          name: questionTag.name,
          color: questionTag.color,
          labelType: questionTag.labelType,
          createdAt: questionTag.createdAt,
        });
      return {
        id: row.id,
        name: row.name,
        color: row.color,
        labelType: row.labelType as LabelType,
        questionCount: 0,
        createdAt: row.createdAt.toISOString(),
      };
    } catch (error) {
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('同名标签已存在');
      }
      throw error;
    }
  }

  async updateTag(
    appUserId: string,
    tagId: string,
    dto: { name?: string; color?: string; labelType?: LabelType },
  ): Promise<{ success: boolean }> {
    const existing = await this.db
      .select({
        id: questionTag.id,
        appUserId: questionTag.appUserId,
      })
      .from(questionTag)
      .where(eq(questionTag.id, tagId));
    if (existing.length === 0) {
      throw new NotFoundException('标签不存在');
    }
    if (existing[0].appUserId !== appUserId) {
      throw new ForbiddenException('只有标签创建者可以修改');
    }

    const patch: Partial<typeof questionTag.$inferInsert> = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('标签名称不能为空');
      if (name.length > 50) throw new BadRequestException('标签名称不能超过 50 个字符');
      patch.name = name;
    }
    if (dto.color !== undefined) {
      patch.color = dto.color.trim() || 'blue';
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    try {
      const updated = await this.db
        .update(questionTag)
        .set(patch)
        .where(and(eq(questionTag.id, tagId), eq(questionTag.appUserId, appUserId)))
        .returning({ id: questionTag.id });
      if (updated.length === 0) throw new NotFoundException('标签不存在');
      return { success: true };
    } catch (error) {
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('同名标签已存在');
      }
      throw error;
    }
  }

  async deleteTag(appUserId: string, tagId: string): Promise<{ success: boolean }> {
    const existing = await this.db
      .select({
        id: questionTag.id,
        appUserId: questionTag.appUserId,
      })
      .from(questionTag)
      .where(eq(questionTag.id, tagId));
    if (existing.length === 0) {
      throw new NotFoundException('标签不存在');
    }
    if (existing[0].appUserId !== appUserId) {
      throw new ForbiddenException('只有标签创建者可以删除');
    }
    await this.db
      .delete(questionTag)
      .where(and(eq(questionTag.id, tagId), eq(questionTag.appUserId, appUserId)));
    return { success: true };
  }

  async getQuestionTags(questionId: string, appUserId?: string): Promise<QuestionTagItem[]> {
    const whereConditions: any[] = [eq(questionTagRel.questionId, questionId)];
    if (appUserId) {
      whereConditions.push(eq(questionTag.appUserId, appUserId));
    }

    const rows = await this.db
      .select({
        id: questionTag.id,
        name: questionTag.name,
        color: questionTag.color,
        labelType: questionTag.labelType,
        createdAt: questionTag.createdAt,
      })
      .from(questionTagRel)
      .innerJoin(questionTag, eq(questionTag.id, questionTagRel.tagId))
      .where(and(...whereConditions))
      .orderBy(questionTag.name);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      labelType: row.labelType as LabelType,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async setQuestionTags(
    appUserId: string,
    questionId: string,
    tagIds: string[],
  ): Promise<{ success: boolean; tags: QuestionTagItem[] }> {
    const q = await this.db
      .select({ id: question.id })
      .from(question)
      .innerJoin(questionBank, eq(question.bankId, questionBank.id))
      .where(and(
        eq(question.id, questionId),
        or(eq(questionBank.appUserId, appUserId), eq(questionBank.isPublic, true)),
      ));
    if (q.length === 0) throw new NotFoundException('题目不存在或无权限访问');

    const uniqueTagIds = Array.from(new Set(tagIds));

    await this.db.transaction(async (tx) => {
      await tx
        .delete(questionTagRel)
        .where(and(eq(questionTagRel.questionId, questionId), eq(questionTagRel.appUserId, appUserId)));

      if (uniqueTagIds.length > 0) {
        const validTags = await tx
          .select({ id: questionTag.id })
          .from(questionTag)
          .where(and(
            eq(questionTag.appUserId, appUserId),
            inArray(questionTag.id, uniqueTagIds),
          ));
        if (validTags.length !== uniqueTagIds.length) {
          throw new BadRequestException('部分标签不存在或无权限使用');
        }
        await tx.insert(questionTagRel).values(
          uniqueTagIds.map((tid) => ({
            questionId,
            tagId: tid,
            appUserId,
          })),
        );
      }
    });

    const tags = await this.getQuestionTags(questionId);
    return { success: true, tags };
  }

  async addTagToQuestion(
    appUserId: string,
    questionId: string,
    tagId: string,
  ): Promise<{ success: boolean }> {
    const q = await this.db
      .select({ id: question.id })
      .from(question)
      .innerJoin(questionBank, eq(question.bankId, questionBank.id))
      .where(and(
        eq(question.id, questionId),
        or(eq(questionBank.appUserId, appUserId), eq(questionBank.isPublic, true)),
      ));
    if (q.length === 0) throw new NotFoundException('题目不存在或无权限访问');

    const t = await this.db
      .select({ id: questionTag.id })
      .from(questionTag)
      .where(
        and(
          eq(questionTag.id, tagId),
          eq(questionTag.appUserId, appUserId),
        ),
      );
    if (t.length === 0) throw new BadRequestException('标签不存在或无权限使用');

    try {
      await this.db
        .insert(questionTagRel)
        .values({ questionId, tagId, appUserId })
        .onConflictDoNothing();
    } catch (error) {
      const code = extractPostgresErrorCode(error);
      if (code !== '23505') throw error;
    }
    return { success: true };
  }

  async removeTagFromQuestion(
    appUserId: string,
    questionId: string,
    tagId: string,
  ): Promise<{ success: boolean }> {
    const q = await this.db
      .select({ id: question.id })
      .from(question)
      .innerJoin(questionBank, eq(question.bankId, questionBank.id))
      .where(and(
        eq(question.id, questionId),
        or(eq(questionBank.appUserId, appUserId), eq(questionBank.isPublic, true)),
      ));
    if (q.length === 0) throw new NotFoundException('题目不存在或无权限访问');

    const t = await this.db
      .select({ id: questionTag.id })
      .from(questionTag)
      .where(
        and(
          eq(questionTag.id, tagId),
          eq(questionTag.appUserId, appUserId),
        ),
      );
    if (t.length === 0) throw new BadRequestException('标签不存在或无权限使用');

    await this.db
        .delete(questionTagRel)
      .where(and(
        eq(questionTagRel.questionId, questionId),
        eq(questionTagRel.tagId, tagId),
        eq(questionTagRel.appUserId, appUserId),
      ));
    return { success: true };
  }

  async getQuestionsByTag(
    appUserId: string,
    tagId: string,
  ): Promise<{ tag: QuestionTagItem; items: QuestionWithFavorite[] }> {
    const tagRows = await this.db
      .select({
        id: questionTag.id,
        name: questionTag.name,
        color: questionTag.color,
        labelType: questionTag.labelType,
        createdAt: questionTag.createdAt,
      })
      .from(questionTag)
      .where(
        and(
          eq(questionTag.id, tagId),
          eq(questionTag.appUserId, appUserId),
        ),
      );
    if (tagRows.length === 0) throw new NotFoundException('标签不存在或无权限查看');

    const questionRows = await this.db
      .select()
      .from(questionTagRel)
      .innerJoin(question, eq(question.id, questionTagRel.questionId))
      .leftJoin(
        userQuestionState,
        sql`${userQuestionState.questionId} = ${question.id} AND ${userQuestionState.appUserId} = ${appUserId}`,
      )
      .where(eq(questionTagRel.tagId, tagId))
      .orderBy(desc(question.createdAt));

    const items: QuestionWithFavorite[] = questionRows.map((row) => ({
      id: row.question.id,
      content: row.question.content,
      questionType: row.question.questionType as QuestionType,
      options: row.question.options as unknown as QuestionOption[],
      correctAnswers: row.question.correctAnswers as unknown as number[],
      analysis: row.question.analysis,
      subQuestions: (row.question.subQuestions as unknown as SubQuestion[]) ?? [],
      knowledgePoints: row.question.knowledgePoints,
      unitName: row.question.unitName,
      sortOrder: row.question.sortOrder,
      isFavorited: Boolean(row.user_question_state?.isFavorited),
      wrongCount: row.user_question_state?.wrongCount ?? 0,
      mastered: Boolean(row.user_question_state?.mastered),
    }));

    return {
      tag: {
        id: tagRows[0].id,
        name: tagRows[0].name,
        color: tagRows[0].color,
        labelType: tagRows[0].labelType as LabelType,
        questionCount: items.length,
        createdAt: tagRows[0].createdAt.toISOString(),
      },
      items,
    };
  }

  async generateBankByTags(
    appUserId: string,
    dto: { tagIds: string[]; questionCount: number; name?: string },
  ): Promise<{ bankId: string; name: string; questionCount: number; createdAt: string }> {
    const { tagIds, questionCount } = dto;
    if (!tagIds || tagIds.length === 0) {
      throw new BadRequestException('请至少选择一个标签');
    }
    if (!questionCount || questionCount <= 0) {
      throw new BadRequestException('抽题数量必须大于 0');
    }

    const uniqueTagIds = Array.from(new Set(tagIds));

    const tagCount = await this.db
      .select({ count: count() })
      .from(questionTag)
      .where(and(
        eq(questionTag.appUserId, appUserId),
        inArray(questionTag.id, uniqueTagIds),
      ));
    if (Number(tagCount[0]?.count ?? 0) !== uniqueTagIds.length) {
      throw new BadRequestException('部分标签不存在或无权限使用');
    }

    const questionIds = await this.db
      .selectDistinct({ id: questionTagRel.questionId })
      .from(questionTagRel)
      .where(inArray(questionTagRel.tagId, uniqueTagIds));

    if (questionIds.length === 0) {
      throw new BadRequestException('所选标签下没有题目');
    }

    const shuffled = [...questionIds].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, questionCount).map((q) => q.id);

    const bankName = dto.name?.trim() || `标签练习_${selected.length}题`;

    const [bank] = await this.db
      .insert(questionBank)
      .values({
        name: bankName,
        description: `从 ${tagIds.length} 个标签随机抽取 ${selected.length} 道题`,
        questionCount: selected.length,
        isTemporary: true,
        bankType: 'temporary',
        appUserId,
      })
      .returning({
        id: questionBank.id,
        name: questionBank.name,
        questionCount: questionBank.questionCount,
        createdAt: questionBank.createdAt,
      });

    const qRows = await this.db
      .select()
      .from(question)
      .where(inArray(question.id, selected));

    await this.db.insert(question).values(
      qRows.map((q, i) => ({
        bankId: bank.id,
        content: q.content,
        questionType: q.questionType,
        options: q.options,
        correctAnswers: q.correctAnswers,
        analysis: q.analysis,
        knowledgePoints: q.knowledgePoints,
        unitName: q.unitName,
        sortOrder: i,
        appUserId,
      })),
    );

    return {
      bankId: bank.id,
      name: bank.name,
      questionCount: bank.questionCount,
      createdAt: bank.createdAt.toISOString(),
    };
  }

  async globalSearch(
    appUserId: string,
    keyword: string,
    limit = 50,
  ): Promise<{ items: GlobalSearchQuestionItem[]; total: number }> {
    const kw = keyword?.trim();
    if (!kw) {
      return { items: [], total: 0 };
    }
    const likePattern = `%${kw}%`;

    const whereCondition = sql`(
        ${question.content} ILIKE ${likePattern}
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(${question.subQuestions}) AS sq
          WHERE sq->>'content' ILIKE ${likePattern}
        )
      ) AND ${question.appUserId} = ${appUserId}`;

    const totalResult = await this.db
      .select({ count: count() })
      .from(question)
      .leftJoin(questionBank, eq(question.bankId, questionBank.id))
      .where(whereCondition);
    const total = Number(totalResult[0]?.count ?? 0);

    const rows = await this.db
      .select({
        id: question.id,
        content: question.content,
        questionType: question.questionType,
        bankId: questionBank.id,
        bankName: questionBank.name,
        bankType: questionBank.bankType,
        isFavorited: userQuestionState.isFavorited,
        wrongCount: userQuestionState.wrongCount,
      })
      .from(question)
      .leftJoin(questionBank, eq(question.bankId, questionBank.id))
      .leftJoin(
        userQuestionState,
        sql`${userQuestionState.questionId} = ${question.id}
          AND ${userQuestionState.appUserId} = ${appUserId}`,
      )
      .where(whereCondition)
      .orderBy(desc(question.createdAt))
      .limit(limit);

    const questionIds = rows.map((r) => r.id);
    const tagMap = new Map<string, Array<{ id: string; name: string; color: string; labelType: LabelType }>>();

    if (questionIds.length > 0) {
      const tagRows = await this.db
        .select({
          questionId: questionTagRel.questionId,
          tagId: questionTag.id,
          tagName: questionTag.name,
          tagColor: questionTag.color,
          tagLabelType: questionTag.labelType,
        })
        .from(questionTagRel)
        .innerJoin(questionTag, eq(questionTag.id, questionTagRel.tagId))
        .where(and(
          inArray(questionTagRel.questionId, questionIds),
          eq(questionTag.appUserId, appUserId),
        ))
        .orderBy(questionTag.name);

      for (const tr of tagRows) {
        const arr = tagMap.get(tr.questionId) ?? [];
        arr.push({
          id: tr.tagId,
          name: tr.tagName,
          color: tr.tagColor,
          labelType: tr.tagLabelType as LabelType,
        });
        tagMap.set(tr.questionId, arr);
      }
    }

    const items: GlobalSearchQuestionItem[] = rows.map((row) => ({
      id: row.id,
      content: row.content,
      questionType: row.questionType as QuestionType,
      bankId: row.bankId ?? '',
      bankName: row.bankName ?? '未知题集',
      bankType: (row.bankType ?? 'normal') as GlobalSearchQuestionItem['bankType'],
      isFavorited: Boolean(row.isFavorited),
      wrongCount: row.wrongCount ?? 0,
      tags: tagMap.get(row.id) ?? [],
    }));

    return { items, total };
  }
}
