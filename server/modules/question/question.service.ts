import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, sql, desc, lt, count } from 'drizzle-orm';

import {
  userQuestionState,
  questionFeedback,
  practiceAnswer,
  questionComment,
  question,
  appUser,
  questionBank,
  questionBankCollaborator,
} from '@server/database/schema';
import type {
  QuestionNoteResponse,
  QuestionDifficultyResponse,
  SubmitFeedbackRequest,
  SubmitFeedbackResponse,
  RecordAnswerTimeRequest,
  RecordAnswerTimeResponse,
  DifficultyLevel,
  UpdateQuestionFullRequest,
  UpdateQuestionResponse,
  DeleteQuestionResponse,
  QuestionItem,
  QuestionOption,
  SubQuestion,
  QuestionType,
} from '@shared/api.interface';
import { AdminFeedbackService } from '../admin-feedback/admin-feedback.service';

@Injectable()
export class QuestionService {
  private readonly logger = new Logger(QuestionService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly feedbackService: AdminFeedbackService,
  ) {}

  async saveNote(
    appUserId: string,
    questionId: string,
    note: string,
  ): Promise<QuestionNoteResponse> {
    if (!questionId) {
      throw new BadRequestException('题目ID不能为空');
    }

    await this.db
      .insert(userQuestionState)
      .values({
        userId: sql`ROW(${appUserId})::user_profile`,
        appUserId,
        questionId,
        note,
        isFavorited: false,
        wrongCount: 0,
        mastered: false,
        attemptCount: 0,
      })
      .onConflictDoUpdate({
        target: [userQuestionState.userId, userQuestionState.questionId],
        set: { note },
      });

    return { questionId, note };
  }

  async getNote(
    appUserId: string,
    questionId: string,
  ): Promise<QuestionNoteResponse> {
    if (!questionId) {
      throw new BadRequestException('题目ID不能为空');
    }

    const rows = await this.db
      .select({ note: userQuestionState.note })
      .from(userQuestionState)
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        eq(userQuestionState.questionId, questionId),
      ))
      .limit(1);

    return {
      questionId,
      note: rows[0]?.note ?? '',
    };
  }

  async setDifficulty(
    appUserId: string,
    questionId: string,
    difficulty: DifficultyLevel,
  ): Promise<QuestionDifficultyResponse> {
    if (!questionId) {
      throw new BadRequestException('题目ID不能为空');
    }
    if (!difficulty) {
      throw new BadRequestException('难度不能为空');
    }

    await this.db
      .insert(userQuestionState)
      .values({
        userId: sql`ROW(${appUserId})::user_profile`,
        appUserId,
        questionId,
        difficulty,
        isFavorited: false,
        wrongCount: 0,
        mastered: false,
        attemptCount: 0,
      })
      .onConflictDoUpdate({
        target: [userQuestionState.userId, userQuestionState.questionId],
        set: { difficulty },
      });

    return { questionId, difficulty };
  }

  async getDifficulty(
    appUserId: string,
    questionId: string,
  ): Promise<QuestionDifficultyResponse> {
    if (!questionId) {
      throw new BadRequestException('题目ID不能为空');
    }

    const rows = await this.db
      .select({ difficulty: userQuestionState.difficulty })
      .from(userQuestionState)
      .where(and(
        eq(userQuestionState.appUserId, appUserId),
        eq(userQuestionState.questionId, questionId),
      ))
      .limit(1);

    return {
      questionId,
      difficulty: (rows[0]?.difficulty as DifficultyLevel) ?? 'medium',
    };
  }

  async submitFeedback(
    appUserId: string,
    questionId: string,
    dto: SubmitFeedbackRequest,
  ): Promise<SubmitFeedbackResponse> {
    if (!questionId) {
      throw new BadRequestException('题目ID不能为空');
    }
    if (!dto.feedbackType) {
      throw new BadRequestException('反馈类型不能为空');
    }

    const [row] = await this.db
      .insert(questionFeedback)
      .values({
        questionId,
        userId: sql`ROW(${appUserId})::user_profile`,
        feedbackType: dto.feedbackType,
        description: dto.description ?? '',
        appUserId,
      })
      .returning({ id: questionFeedback.id });

    let submitterUsername = '未知用户';
    try {
      const userRows = await this.db
        .select({ username: appUser.username })
        .from(appUser)
        .where(eq(appUser.id, appUserId));
      if (userRows.length > 0) {
        submitterUsername = userRows[0].username;
      }
    } catch {
      // ignore
    }

    this.feedbackService.notifyAdminsOfNewFeedback(
      dto.feedbackType,
      dto.description ?? '',
      submitterUsername,
      'question',
    ).catch((notifyError) => {
      this.logger.error(`反馈通知发送失败: ${JSON.stringify(notifyError)}`);
    });

    return { success: true, id: row.id };
  }

  async recordAnswerTime(
    appUserId: string,
    dto: RecordAnswerTimeRequest,
  ): Promise<RecordAnswerTimeResponse> {
    if (!dto.recordId) {
      throw new BadRequestException('记录ID不能为空');
    }
    if (!dto.questionId) {
      throw new BadRequestException('题目ID不能为空');
    }
    if (dto.durationSeconds < 0) {
      throw new BadRequestException('作答时长不能为负');
    }

    const updated = await this.db
      .update(practiceAnswer)
      .set({ durationSeconds: dto.durationSeconds })
      .where(and(
        eq(practiceAnswer.recordId, dto.recordId),
        eq(practiceAnswer.questionId, dto.questionId),
        eq(practiceAnswer.appUserId, appUserId),
      ))
      .returning({ id: practiceAnswer.id });

    if (updated.length === 0) {
      throw new BadRequestException('作答记录不存在');
    }

    return { success: true };
  }

  async getComments(
    appUserId: string,
    questionId: string,
    limit: number,
    cursor?: string,
  ): Promise<{
    items: Array<{
      id: string;
      questionId: string;
      userId: string;
      username: string;
      content: string;
      createdAt: string;
    }>;
    total: number;
    hasMore: boolean;
    nextCursor?: string;
  }> {
    if (!questionId) {
      throw new BadRequestException('题目ID不能为空');
    }
    // 校验题目可见性：题目所属题库必须是公开的或属于当前用户
    const questionResult = await this.db
      .select({
        bankId: question.bankId,
        bankAppUserId: questionBank.appUserId,
        bankIsPublic: questionBank.isPublic,
      })
      .from(question)
      .leftJoin(questionBank, eq(question.bankId, questionBank.id))
      .where(eq(question.id, questionId));
    if (questionResult.length === 0) {
      throw new NotFoundException('题目不存在');
    }
    const q = questionResult[0];
    if (q.bankAppUserId !== appUserId && !q.bankIsPublic) {
      throw new NotFoundException('题目不存在');
    }
    const pageSize = Math.min(Math.max(limit, 1), 50);

    const questionHash = await this.getQuestionHash(questionId);

    // total与列表查询使用相同条件，不相加
    const totalResult = questionHash
      ? await this.db
          .select({ count: count() })
          .from(questionComment)
          .where(eq(questionComment.questionHash, questionHash))
      : await this.db
          .select({ count: count() })
          .from(questionComment)
          .where(and(
            eq(questionComment.questionId, questionId),
            sql`${questionComment.questionHash} IS NULL`,
          ));
    const total = Number(totalResult[0]?.count ?? 0);

    const baseConditions: ReturnType<typeof eq>[] = [];
    if (questionHash) {
      baseConditions.push(eq(questionComment.questionHash, questionHash) as ReturnType<typeof eq>);
    } else {
      baseConditions.push(eq(questionComment.questionId, questionId));
      baseConditions.push(sql`${questionComment.questionHash} IS NULL` as unknown as ReturnType<typeof eq>);
    }
    if (cursor) {
      baseConditions.push(lt(questionComment.createdAt, new Date(cursor)) as ReturnType<typeof eq>);
    }

    const rows = await this.db
      .select({
        id: questionComment.id,
        questionId: questionComment.questionId,
        userId: questionComment.appUserId,
        username: appUser.username,
        content: questionComment.content,
        createdAt: questionComment.createdAt,
      })
      .from(questionComment)
      .innerJoin(appUser, eq(questionComment.appUserId, appUser.id))
      .where(and(...baseConditions))
      .orderBy(desc(questionComment.createdAt))
      .limit(pageSize + 1);

    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore
      ? items[items.length - 1].createdAt.toISOString()
      : undefined;

    return {
      items: items.map((row) => ({
        id: row.id,
        questionId: row.questionId,
        userId: row.userId,
        username: row.username,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      hasMore,
      nextCursor,
    };
  }

  async createComment(
    appUserId: string,
    questionId: string,
    content: string,
  ): Promise<{ id: string }> {
    if (!questionId) {
      throw new BadRequestException('题目ID不能为空');
    }
    if (!content || !content.trim()) {
      throw new BadRequestException('评论内容不能为空');
    }
    if (content.trim().length > 1000) {
      throw new BadRequestException('评论内容不能超过1000字');
    }

    const questionHash = await this.getQuestionHash(questionId);

    const [row] = await this.db
      .insert(questionComment)
      .values({
        questionId,
        questionHash,
        appUserId,
        content: content.trim(),
      })
      .returning({ id: questionComment.id });

    return { id: row.id };
  }

  private async getQuestionHash(questionId: string): Promise<string | null> {
    const rows = await this.db
      .select({
        content: question.content,
        options: question.options,
      })
      .from(question)
      .where(eq(question.id, questionId))
      .limit(1);

    if (rows.length === 0) return null;

    const q = rows[0];
    const opts = (q.options as unknown as Array<{ label: string; text: string }>) || [];
    const sortedOpts = [...opts]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((opt) => `${opt.label}:${opt.text}`)
      .join('|');
    const raw = `${q.content}__${sortedOpts}`;

    const hashBuffer = await crypto.subtle.digest('SHA-256', Buffer.from(raw, 'utf8'));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);

    return hashHex;
  }

  async deleteComment(
    appUserId: string,
    commentId: string,
  ): Promise<void> {
    if (!commentId) {
      throw new BadRequestException('评论ID不能为空');
    }

    const rows = await this.db
      .select({
        id: questionComment.id,
        appUserId: questionComment.appUserId,
      })
      .from(questionComment)
      .where(eq(questionComment.id, commentId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('评论不存在');
    }

    if (rows[0].appUserId !== appUserId) {
      throw new ForbiddenException('无权删除他人评论');
    }

    await this.db
      .delete(questionComment)
      .where(eq(questionComment.id, commentId));
  }

  // ==================== 题目编辑相关 ====================

  /**
   * 检查用户是否有权限编辑某题库（所有者 / 协作者 / admin）
   * TODO: 后续协作模块会复用，先放这里
   */
  private async ensureBankEditPermission(
    appUserId: string,
    bankId: string,
  ): Promise<void> {
    // 先看用户角色
    const userRows = await this.db
      .select({ role: appUser.role })
      .from(appUser)
      .where(eq(appUser.id, appUserId))
      .limit(1);
    if (userRows.length > 0 && userRows[0].role === 'admin') {
      return;
    }

    // 再看是否是题库所有者
    const bankRows = await this.db
      .select({ id: questionBank.id, appUserId: questionBank.appUserId })
      .from(questionBank)
      .where(eq(questionBank.id, bankId))
      .limit(1);
    if (bankRows.length === 0) {
      throw new NotFoundException('题集不存在');
    }
    if (bankRows[0].appUserId === appUserId) {
      return;
    }

    // 最后看是否是协作者
    const collabRows = await this.db
      .select({ id: questionBankCollaborator.id })
      .from(questionBankCollaborator)
      .where(and(
        eq(questionBankCollaborator.bankId, bankId),
        eq(questionBankCollaborator.appUserId, appUserId),
      ))
      .limit(1);
    if (collabRows.length > 0) {
      return;
    }

    throw new ForbiddenException('无权编辑该题集');
  }

  /**
   * 根据题目 ID 找到所属 bankId 并校验编辑权限
   */
  private async getQuestionAndCheckPermission(
    appUserId: string,
    questionId: string,
  ): Promise<{ questionRow: typeof question.$inferSelect; bankId: string }> {
    const qRows = await this.db
      .select()
      .from(question)
      .where(eq(question.id, questionId))
      .limit(1);
    if (qRows.length === 0) {
      throw new NotFoundException('题目不存在');
    }
    const qRow = qRows[0];
    await this.ensureBankEditPermission(appUserId, qRow.bankId);
    return { questionRow: qRow, bankId: qRow.bankId };
  }

  /**
   * 检查题目是否已有答题记录
   */
  private async hasAnswerRecords(questionId: string): Promise<boolean> {
    const result = await this.db
      .select({ count: count() })
      .from(practiceAnswer)
      .where(eq(practiceAnswer.questionId, questionId));
    return Number(result[0]?.count ?? 0) > 0;
  }

  /**
   * 完整编辑题目
   * - 首次调用（无 confirm）：若存在答题记录，返回 hasAnswerRecords: true 不实际修改
   * - 带 confirm=true：真正执行修改
   */
  async updateQuestionFull(
    appUserId: string,
    userId: string,
    questionId: string,
    dto: UpdateQuestionFullRequest,
  ): Promise<UpdateQuestionResponse> {
    if (!questionId) {
      throw new BadRequestException('题目ID不能为空');
    }

    const { questionRow, bankId } = await this.getQuestionAndCheckPermission(
      appUserId,
      questionId,
    );

    // 有答题记录且未确认时，只返回标记
    const hasRecords = await this.hasAnswerRecords(questionId);
    if (hasRecords && !dto.confirm) {
      return { success: false, hasAnswerRecords: true };
    }

    // 构造 patch
    const patch: Partial<typeof question.$inferInsert> = {};
    if (dto.content !== undefined) {
      if (!dto.content.trim()) {
        throw new BadRequestException('题干不能为空');
      }
      patch.content = dto.content.trim();
    }
    if (dto.questionType !== undefined) {
      patch.questionType = dto.questionType;
    }
    if (dto.options !== undefined) {
      if (!Array.isArray(dto.options) || dto.options.length < 2) {
        throw new BadRequestException('至少需要2个选项');
      }
      patch.options = dto.options as unknown as Record<string, unknown>[];
    }
    if (dto.correctAnswers !== undefined) {
      if (dto.questionType === 'b1') {
        throw new BadRequestException('B1型题请通过 subQuestions 提交正确答案');
      }
      if (!Array.isArray(dto.correctAnswers) || dto.correctAnswers.length === 0) {
        throw new BadRequestException('请选择正确答案');
      }
      const opts = dto.options || (questionRow.options as unknown as QuestionOption[]);
      const questionType = dto.questionType || questionRow.questionType;
      if (questionType === 'single' && dto.correctAnswers.length !== 1) {
        throw new BadRequestException('单选题只能有一个正确答案');
      }
      if (opts.length > 0 && dto.correctAnswers.some((idx: number) => idx < 0 || idx >= opts.length)) {
        throw new BadRequestException('正确答案索引超出选项范围');
      }
      patch.correctAnswers = dto.correctAnswers as unknown as number[];
    }
    if (dto.analysis !== undefined) {
      patch.analysis = dto.analysis.trim();
    }
    if (dto.subQuestions !== undefined) {
      const opts = dto.options || (questionRow.options as unknown as QuestionOption[]);
      const labels = opts.map((o: QuestionOption) => o.label);
      const questionType = dto.questionType || questionRow.questionType;
      for (const sq of dto.subQuestions) {
        if (!sq.content?.trim()) {
          throw new BadRequestException('子问题题干不能为空');
        }
        if (questionType === 'b1' && !sq.correctAnswer) {
          throw new BadRequestException('子问题必须指定正确答案');
        }
        if (sq.correctAnswer && labels.length > 0 && !labels.includes(sq.correctAnswer)) {
          throw new BadRequestException(`子问题正确答案「${sq.correctAnswer}」不在备选答案中`);
        }
      }
      patch.subQuestions = dto.subQuestions as unknown as Record<string, unknown>[];
    }
    if (dto.knowledgePoints !== undefined) {
      patch.knowledgePoints = dto.knowledgePoints;
    }
    if (dto.unitName !== undefined) {
      patch.unitName = dto.unitName ?? null;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(question)
      .set(patch)
      .where(eq(question.id, questionId))
      .returning();
    if (updated.length === 0) {
      throw new NotFoundException('题目不存在');
    }

    const updatedRow = updated[0];
    const resultQuestion: QuestionItem = {
      id: updatedRow.id,
      content: updatedRow.content,
      questionType: updatedRow.questionType as QuestionType,
      options: updatedRow.options as unknown as QuestionOption[],
      correctAnswers: updatedRow.correctAnswers as unknown as number[],
      analysis: updatedRow.analysis,
      subQuestions: updatedRow.subQuestions as unknown as SubQuestion[],
      knowledgePoints: updatedRow.knowledgePoints,
      unitName: updatedRow.unitName,
      sortOrder: updatedRow.sortOrder,
    };

    // TODO: 版本快照（放到协作模块实现）
    // this.createVersionSnapshotIfNeeded(bankId, userId, 'edit_question');

    return { success: true, question: resultQuestion };
  }

  /**
   * 删除单题
   */
  async deleteQuestion(
    appUserId: string,
    questionId: string,
  ): Promise<DeleteQuestionResponse> {
    if (!questionId) {
      throw new BadRequestException('题目ID不能为空');
    }

    const { bankId } = await this.getQuestionAndCheckPermission(
      appUserId,
      questionId,
    );

    const deleted = await this.db
      .delete(question)
      .where(eq(question.id, questionId))
      .returning({ id: question.id });
    if (deleted.length === 0) {
      throw new NotFoundException('题目不存在');
    }

    // 更新题库题数
    await this.db
      .update(questionBank)
      .set({ questionCount: sql`${questionBank.questionCount} - 1` })
      .where(eq(questionBank.id, bankId));

    return { success: true };
  }
}
