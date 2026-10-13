import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

import { subject, questionBank } from '@server/database/schema';
import type {
  SubjectItem,
  CreateSubjectRequest,
  UpdateSubjectRequest,
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
export class SubjectService {
  private readonly logger = new Logger(SubjectService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listSubjects(appUserId: string): Promise<SubjectItem[]> {
    const rows = await this.db
      .select({
        id: subject.id,
        name: subject.name,
        color: subject.color,
        icon: subject.icon,
        bankCount: sql<number>`count(${questionBank.id})`,
        createdAt: subject.createdAt,
      })
      .from(subject)
      .leftJoin(
        questionBank,
        sql`${questionBank.subjectId} = ${subject.id} AND ${questionBank.isTemporary} = false AND ${questionBank.appUserId} = ${appUserId}`,
      )
      .where(eq(subject.appUserId, appUserId))
      .groupBy(subject.id)
      .orderBy(desc(subject.createdAt));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      icon: row.icon ?? undefined,
      bankCount: Number(row.bankCount),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createSubject(
    appUserId: string,
    dto: CreateSubjectRequest,
  ): Promise<SubjectItem> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('科目名称不能为空');
    }
    if (name.length > 50) {
      throw new BadRequestException('科目名称不能超过 50 个字符');
    }
    const color = dto.color?.trim() || 'blue';
    const icon = dto.icon?.trim() || null;

    try {
      const [row] = await this.db
        .insert(subject)
        .values({
          name,
          color,
          icon,
          appUserId,
        })
        .returning({
          id: subject.id,
          name: subject.name,
          color: subject.color,
          icon: subject.icon,
          createdAt: subject.createdAt,
        });
      return {
        id: row.id,
        name: row.name,
        color: row.color,
        icon: row.icon ?? undefined,
        bankCount: 0,
        createdAt: row.createdAt.toISOString(),
      };
    } catch (error) {
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('同名科目已存在');
      }
      throw error;
    }
  }

  async updateSubject(
    appUserId: string,
    id: string,
    dto: UpdateSubjectRequest,
  ): Promise<{ success: boolean }> {
    const existing = await this.db
      .select({ id: subject.id })
      .from(subject)
      .where(and(eq(subject.id, id), eq(subject.appUserId, appUserId)));
    if (existing.length === 0) {
      throw new NotFoundException('科目不存在');
    }

    const patch: Partial<typeof subject.$inferInsert> = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('科目名称不能为空');
      if (name.length > 50) throw new BadRequestException('科目名称不能超过 50 个字符');
      patch.name = name;
    }
    if (dto.color !== undefined) {
      patch.color = dto.color.trim() || 'blue';
    }
    if (dto.icon !== undefined) {
      patch.icon = dto.icon.trim() || null;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    try {
      const updated = await this.db
        .update(subject)
        .set(patch)
        .where(and(eq(subject.id, id), eq(subject.appUserId, appUserId)))
        .returning({ id: subject.id });
      if (updated.length === 0) throw new NotFoundException('科目不存在');
      return { success: true };
    } catch (error) {
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('同名科目已存在');
      }
      throw error;
    }
  }

  async deleteSubject(appUserId: string, id: string): Promise<{ success: boolean }> {
    const existing = await this.db
      .select({ id: subject.id })
      .from(subject)
      .where(and(eq(subject.id, id), eq(subject.appUserId, appUserId)));
    if (existing.length === 0) {
      throw new NotFoundException('科目不存在');
    }
    await this.db
      .delete(subject)
      .where(and(eq(subject.id, id), eq(subject.appUserId, appUserId)));
    return { success: true };
  }

  async batchMoveBanks(
    appUserId: string,
    bankIds: string[],
    targetSubjectId: string | null,
  ): Promise<{ success: boolean; movedCount: number }> {
    if (!bankIds || bankIds.length === 0) {
      throw new BadRequestException('请选择要移动的题集');
    }

    // Validate all banks exist and belong to user
    const banks = await this.db
      .select({ id: questionBank.id })
      .from(questionBank)
      .where(and(inArray(questionBank.id, bankIds), eq(questionBank.appUserId, appUserId)));
    if (banks.length !== bankIds.length) {
      throw new BadRequestException('部分题集不存在');
    }

    // If target subject is not null, verify it exists and belongs to user
    if (targetSubjectId !== null) {
      const targetSubject = await this.db
        .select({ id: subject.id })
        .from(subject)
        .where(and(eq(subject.id, targetSubjectId), eq(subject.appUserId, appUserId)));
      if (targetSubject.length === 0) {
        throw new NotFoundException('目标科目不存在');
      }
    }

    const updated = await this.db
      .update(questionBank)
      .set({ subjectId: targetSubjectId })
      .where(and(inArray(questionBank.id, bankIds), eq(questionBank.appUserId, appUserId)))
      .returning({ id: questionBank.id });

    return { success: true, movedCount: updated.length };
  }
}
