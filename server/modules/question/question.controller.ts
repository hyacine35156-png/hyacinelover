import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Req,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedAppLogin, Public } from '../auth/jwt.guard';

import { QuestionService } from './question.service';
import { SystemLogService } from '../system-log/system-log.service';

import type {
  QuestionNoteResponse,
  SaveQuestionNoteRequest,
  QuestionDifficultyResponse,
  SetQuestionDifficultyRequest,
  SubmitFeedbackRequest,
  SubmitFeedbackResponse,
  RecordAnswerTimeRequest,
  RecordAnswerTimeResponse,
  QuestionCommentListResponse,
  CreateQuestionCommentRequest,
  CreateQuestionCommentResponse,
  UpdateQuestionFullRequest,
  UpdateQuestionResponse,
  DeleteQuestionResponse,
} from '@shared/api.interface';

@NeedAppLogin()
@Controller('api/questions')
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly systemLogService: SystemLogService,
  ) {}

  @Post(':id/note')
  async saveNote(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SaveQuestionNoteRequest,
  ): Promise<QuestionNoteResponse> {
    const appUserId = req.appUser!.id;
    return this.questionService.saveNote(appUserId, id, dto.note);
  }

  @Get(':id/note')
  async getNote(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<QuestionNoteResponse> {
    const appUserId = req.appUser!.id;
    return this.questionService.getNote(appUserId, id);
  }

  @Post(':id/difficulty')
  async setDifficulty(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SetQuestionDifficultyRequest,
  ): Promise<QuestionDifficultyResponse> {
    const appUserId = req.appUser!.id;
    return this.questionService.setDifficulty(appUserId, id, dto.difficulty);
  }

  @Get(':id/difficulty')
  async getDifficulty(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<QuestionDifficultyResponse> {
    const appUserId = req.appUser!.id;
    return this.questionService.getDifficulty(appUserId, id);
  }

  @Post(':id/feedback')
  async submitFeedback(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SubmitFeedbackRequest,
  ): Promise<SubmitFeedbackResponse> {
    const appUserId = req.appUser!.id;
    return this.questionService.submitFeedback(appUserId, id, dto);
  }

  @Post(':id/answer-time')
  async recordAnswerTime(
    @Req() req: Request,
    @Body() dto: RecordAnswerTimeRequest,
  ): Promise<RecordAnswerTimeResponse> {
    const appUserId = req.appUser!.id;
    return this.questionService.recordAnswerTime(appUserId, dto);
  }

  @Get(':id/comments')
  async getComments(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<QuestionCommentListResponse> {
    const appUserId = req.appUser!.id;
    const pageSize = limit ? parseInt(limit, 10) : 10;
    return this.questionService.getComments(appUserId, id, pageSize, cursor);
  }

  @Post(':id/comments')
  async createComment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreateQuestionCommentRequest,
  ): Promise<CreateQuestionCommentResponse> {
    const appUserId = req.appUser!.id;
    return this.questionService.createComment(appUserId, id, dto.content);
  }

  @Delete(':id/comments/:commentId')
  async deleteComment(
    @Req() req: Request,
    @Param('commentId') commentId: string,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    await this.questionService.deleteComment(appUserId, commentId);
    return { success: true };
  }

  @Patch(':id')
  async updateQuestionFull(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionFullRequest,
  ): Promise<UpdateQuestionResponse> {
    const appUserId = req.appUser!.id;
    const userId = req.userContext.userId;
    const result = await this.questionService.updateQuestionFull(appUserId, userId, id, dto);
    this.systemLogService.logAsync({
      logType: 'data_change',
      action: '修改题目',
      userId: appUserId,
      username: req.appUser!.username,
      targetType: 'question',
      targetId: id,
      detail: `独立更新题目，修改字段：${Object.keys(dto).join(', ')}`,
      status: 'success',
      req,
    });
    return result;
  }

  @Post(':id/delete')
  async deleteQuestion(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<DeleteQuestionResponse> {
    const appUserId = req.appUser!.id;
    const result = await this.questionService.deleteQuestion(appUserId, id);
    this.systemLogService.logAsync({
      logType: 'data_change',
      action: '删除题目',
      userId: appUserId,
      username: req.appUser!.username,
      targetType: 'question',
      targetId: id,
      detail: '独立删除题目',
      status: 'success',
      req,
    });
    return result;
  }
}
