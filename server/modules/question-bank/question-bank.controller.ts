/// <reference types="multer" />
import { Controller, Get, Post, Delete, Patch, Param, Body, UseInterceptors, UploadedFile, BadRequestException, Req, Query } from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { NeedAppLogin, Public } from '../auth/jwt.guard';
import { QuestionBankService } from './question-bank.service';
import { SystemLogService } from '../system-log/system-log.service';

import type {
  QuestionBankListResponse,
  CreateQuestionBankRequest,
  CreateQuestionBankResponse,
  DeleteQuestionBankResponse,
  QuestionListResponse,
  CreateQuestionRequest,
  CreateQuestionResponse,
  ImportQuestionBankResponse,
  WordPreviewResponse,
  UpdateQuestionBankRequest,
  UpdateQuestionRequest,
  DeleteQuestionResponse,
  GenerateRandomBankRequest,
  GenerateRandomBankResponse,
  GenerateRandomBankByIdsRequest,
  UpdateFavoriteRequest,
  UpdateFavoriteResponse,
  QuestionWithFavoriteListResponse,
  BatchBankOperationRequest,
  BatchBankOperationResponse,
  BankShareInfo,
  BankSortBy,
  BatchDeleteQuestionsRequest,
  BatchDeleteQuestionsResponse,
  BatchReplaceRequest,
  BatchReplacePreviewResponse,
  BatchReplaceResponse,
} from '@shared/api.interface';

@NeedAppLogin()
@Controller('api/question-banks')
export class QuestionBankController {
  constructor(
    private readonly questionBankService: QuestionBankService,
    private readonly systemLogService: SystemLogService,
  ) {}

  @Get('public/list')
  @Public()
  async getPublicBanks(
    @Query('subjectId') subjectId?: string,
  ): Promise<QuestionBankListResponse> {
    const items = await this.questionBankService.getPublicBanks(subjectId);
    return { items };
  }

  @Get('public/:id/questions')
  @Public()
  async getPublicBankQuestions(
    @Param('id') id: string,
  ): Promise<QuestionListResponse> {
    const items = await this.questionBankService.getPublicBankQuestions(id);
    return { items };
  }

  @Get()
  async getBanks(
    @Req() req: Request,
    @Query('subjectId') subjectId?: string,
    @Query('visibility') visibility?: string,
    @Query('sortBy') sortBy?: string,
  ): Promise<QuestionBankListResponse> {
    const appUserId = req.appUser!.id;
    const validVisibility = visibility === 'public' || visibility === 'private'
      ? visibility as 'public' | 'private'
      : 'all';
    const validSortBy: BankSortBy = this.validateSortBy(sortBy);
    const items = await this.questionBankService.getBanks(
      appUserId,
      subjectId,
      validVisibility,
      validSortBy,
    );
    return { items };
  }

  private validateSortBy(sortBy?: string): BankSortBy {
    const validValues: BankSortBy[] = [
      'created_at_desc', 'created_at_asc',
      'question_count_desc', 'question_count_asc',
      'name_asc', 'name_desc',
      'last_practiced_desc', 'last_practiced_asc',
      'accuracy_desc', 'accuracy_asc',
    ];
    if (sortBy && validValues.includes(sortBy as BankSortBy)) {
      return sortBy as BankSortBy;
    }
    return 'created_at_desc';
  }

  @Post()
  async createBank(
    @Req() req: Request,
    @Body() dto: CreateQuestionBankRequest,
  ): Promise<CreateQuestionBankResponse> {
    const appUserId = req.appUser!.id;
    const result = await this.questionBankService.createBank(appUserId, dto);
    this.systemLogService.logAsync({
      logType: 'data_change',
      action: '创建题集',
      userId: appUserId,
      username: req.appUser!.username,
      targetType: 'question_bank',
      targetId: result.id,
      targetName: result.name,
      detail: `创建题集：${result.name}`,
      status: 'success',
      req,
    });
    return result;
  }

  @Patch(':id')
  async updateBank(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionBankRequest,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    const result = await this.questionBankService.updateBank(appUserId, id, dto);
    this.systemLogService.logAsync({
      logType: 'data_change',
      action: '修改题集',
      userId: appUserId,
      username: req.appUser!.username,
      targetType: 'question_bank',
      targetId: id,
      targetName: dto.name,
      detail: `修改题集字段：${Object.keys(dto).join(', ')}`,
      status: 'success',
      req,
    });
    return result;
  }

  @Delete(':id')
  async deleteBank(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<DeleteQuestionBankResponse> {
    const appUserId = req.appUser!.id;
    const result = await this.questionBankService.deleteBank(appUserId, id);
    this.systemLogService.logAsync({
      logType: 'data_change',
      action: '删除题集',
      userId: appUserId,
      username: req.appUser!.username,
      targetType: 'question_bank',
      targetId: id,
      detail: `删除题集ID: ${id}`,
      status: 'success',
      req,
    });
    return result;
  }

  @Post(':id/copy')
  async copyBank(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { targetName: string; targetSubjectId?: string },
  ): Promise<CreateQuestionBankResponse> {
    const appUserId = req.appUser!.id;
    return this.questionBankService.copyBank(appUserId, id, body.targetName, body.targetSubjectId);
  }

  @Get(':id/questions')
  async getQuestions(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<QuestionListResponse> {
    const appUserId = req.appUser!.id;
    const items = await this.questionBankService.getQuestions(appUserId, id);
    return { items };
  }

  @Get(':id/questions/with-state')
  async getQuestionsWithState(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<QuestionWithFavoriteListResponse> {
    const appUserId = req.appUser!.id;
    return this.questionBankService.getQuestionsWithUserState(appUserId, id);
  }

  @Post(':id/questions')
  async addQuestion(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreateQuestionRequest,
  ): Promise<CreateQuestionResponse> {
    const appUserId = req.appUser!.id;
    const result = await this.questionBankService.addQuestion(appUserId, id, dto);
    this.systemLogService.logAsync({
      logType: 'data_change',
      action: '新增题目',
      userId: appUserId,
      username: req.appUser!.username,
      targetType: 'question',
      targetId: result.id,
      targetName: dto.content?.slice(0, 50),
      detail: `题库ID: ${id}`,
      status: 'success',
      req,
    });
    return result;
  }

  @Patch(':id/questions/:questionId')
  async updateQuestion(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionRequest,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    const result = await this.questionBankService.updateQuestion(appUserId, id, questionId, dto);
    this.systemLogService.logAsync({
      logType: 'data_change',
      action: '修改题目',
      userId: appUserId,
      username: req.appUser!.username,
      targetType: 'question',
      targetId: questionId,
      detail: `题库ID: ${id}，修改字段：${Object.keys(dto).join(', ')}`,
      status: 'success',
      req,
    });
    return result;
  }

  @Delete(':id/questions/:questionId')
  async deleteQuestion(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ): Promise<DeleteQuestionResponse> {
    const appUserId = req.appUser!.id;
    const result = await this.questionBankService.deleteQuestion(appUserId, id, questionId);
    this.systemLogService.logAsync({
      logType: 'data_change',
      action: '删除题目',
      userId: appUserId,
      username: req.appUser!.username,
      targetType: 'question',
      targetId: questionId,
      detail: `从题库 ${id} 删除`,
      status: 'success',
      req,
    });
    return result;
  }

  @Post('import/preview-word')
  @UseInterceptors(FileInterceptor('file'))
  async previewWordImport(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<WordPreviewResponse> {
    if (!file) {
      throw new BadRequestException('请上传文件');
    }
    return this.questionBankService.previewWordImport(file.buffer);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importBank(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { name?: string; isPublic?: string },
  ): Promise<ImportQuestionBankResponse> {
    if (!file) {
      throw new BadRequestException('请上传文件');
    }
    const appUserId = req.appUser!.id;
    const name = body.name || file.originalname.replace(/\.(xlsx|xls|csv|json|docx|doc)$/i, '');
    const isPublic = body.isPublic === 'true';
    try {
      const result = await this.questionBankService.importBank(appUserId, name, file.buffer, file.originalname, isPublic);
      this.systemLogService.logAsync({
        logType: 'import',
        action: '导入题集',
        userId: appUserId,
        username: req.appUser!.username,
        targetType: 'question_bank',
        targetId: result.bankId,
        targetName: name,
        detail: `文件：${file.originalname}，导入题目数：${result.successCount}，失败：${result.failCount}`,
        status: 'success',
        req,
      });
      return result;
    } catch (err) {
      this.systemLogService.logAsync({
        logType: 'import',
        action: '导入题集',
        userId: appUserId,
        username: req.appUser!.username,
        targetType: 'question_bank',
        targetName: name,
        detail: `文件：${file.originalname}`,
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
        req,
      });
      throw err;
    }
  }

  @Post('random')
  async generateRandomBank(
    @Req() req: Request,
    @Body() dto: GenerateRandomBankRequest,
  ): Promise<GenerateRandomBankResponse> {
    const appUserId = req.appUser!.id;
    return this.questionBankService.generateRandomBank(appUserId, dto);
  }

  @Post('favorite')
  async updateFavorite(
    @Req() req: Request,
    @Body() dto: UpdateFavoriteRequest,
  ): Promise<UpdateFavoriteResponse> {
    const appUserId = req.appUser!.id;
    const result = await this.questionBankService.updateFavorite(
      appUserId,
      dto.questionId,
      dto.isFavorited,
    );
    return result;
  }

  @Get('favorite/list')
  async getFavoriteList(
    @Req() req: Request,
  ): Promise<QuestionWithFavoriteListResponse> {
    const appUserId = req.appUser!.id;
    return this.questionBankService.getFavoriteQuestions(appUserId);
  }

  @Get('favorite/export')
  async getFavoriteExport(
    @Req() req: Request,
    @Query('format') format: string = 'pdf',
  ): Promise<QuestionWithFavoriteListResponse> {
    const appUserId = req.appUser!.id;
    return this.questionBankService.exportFavoriteQuestions(appUserId, { format });
  }

  @Get('wrongbook/list')
  async getWrongBookList(
    @Req() req: Request,
  ): Promise<QuestionWithFavoriteListResponse> {
    const appUserId = req.appUser!.id;
    return this.questionBankService.getWrongBookQuestions(appUserId);
  }

  @Get('wrongbook/important-list')
  async getImportantWrongBookList(
    @Req() req: Request,
  ): Promise<QuestionWithFavoriteListResponse> {
    const appUserId = req.appUser!.id;
    return this.questionBankService.getImportantWrongBookQuestions(appUserId);
  }

  @Post('wrongbook/remove')
  async removeFromWrongBook(
    @Req() req: Request,
    @Body() body: { questionId: string },
  ): Promise<{ success: boolean; removed: boolean }> {
    const appUserId = req.appUser!.id;
    return this.questionBankService.removeFromWrongBook(appUserId, body.questionId);
  }

  @Post(':id/questions/:questionId/mastered')
  async markMastered(
    @Req() req: Request,
    @Param('questionId') questionId: string,
    @Body() body: { mastered: boolean },
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    return this.questionBankService.markQuestionMastered(appUserId, questionId, body.mastered);
  }

  @Post('random-generate-by-ids')
  async generateRandomBankByIds(
    @Req() req: Request,
    @Body() dto: GenerateRandomBankByIdsRequest,
  ) {
    const appUserId = req.appUser!.id;
    return this.questionBankService.generateRandomBankByIds(
      appUserId,
      dto.questionIds,
      dto.name,
    );
  }

  @Post('batch')
  async batchOperation(
    @Req() req: Request,
    @Body() dto: BatchBankOperationRequest,
  ): Promise<BatchBankOperationResponse> {
    const appUserId = req.appUser!.id;
    return this.questionBankService.batchOperation(appUserId, dto);
  }

  @Get(':id/share')
  async getShareInfo(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<BankShareInfo> {
    const appUserId = req.appUser!.id;
    const baseUrl = `${req.protocol}://${req.get('host') || ''}`;
    return this.questionBankService.getShareInfo(appUserId, id, baseUrl);
  }

  @Post(':bankId/questions/batch-delete')
  async batchDeleteQuestions(
    @Req() req: Request,
    @Param('bankId') bankId: string,
    @Body() dto: BatchDeleteQuestionsRequest,
  ): Promise<BatchDeleteQuestionsResponse> {
    const appUserId = req.appUser!.id;
    const result = await this.questionBankService.batchDeleteQuestions(appUserId, bankId, dto);
    const deletedCount = result.successCount ?? 0;
    const isBatchAbnormal = deletedCount > 10;
    this.systemLogService.logAsync({
      logType: isBatchAbnormal ? 'anomaly' : 'data_change',
      action: isBatchAbnormal ? '批量删除题目' : '批量删除题目',
      userId: appUserId,
      username: req.appUser!.username,
      targetType: 'question',
      targetId: bankId,
      detail: `批量删除 ${deletedCount} 道题目，题库ID: ${bankId}`,
      status: 'success',
      req,
    });
    return result;
  }

  @Post(':bankId/questions/batch-replace/preview')
  async batchReplacePreview(
    @Req() req: Request,
    @Param('bankId') bankId: string,
    @Body() dto: BatchReplaceRequest,
  ): Promise<BatchReplacePreviewResponse> {
    const appUserId = req.appUser!.id;
    return this.questionBankService.batchReplacePreview(appUserId, bankId, dto);
  }

  @Post(':bankId/questions/batch-replace')
  async batchReplace(
    @Req() req: Request,
    @Param('bankId') bankId: string,
    @Body() dto: BatchReplaceRequest,
  ): Promise<BatchReplaceResponse> {
    const appUserId = req.appUser!.id;
    return this.questionBankService.batchReplace(appUserId, bankId, dto);
  }
}
