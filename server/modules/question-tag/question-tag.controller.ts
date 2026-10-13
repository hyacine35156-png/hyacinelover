import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedAppLogin } from '../auth/jwt.guard';
import { QuestionTagService } from './question-tag.service';

 import type {
   QuestionTagListResponse,
   CreateQuestionTagRequest,
   UpdateQuestionTagRequest,
   SetQuestionTagsRequest,
   QuestionTagWithQuestionsResponse,
   GenerateRandomBankByTagsRequest,
   GenerateRandomBankResponse,
   GlobalSearchResponse,
   QuestionTagItem,
 } from '@shared/api.interface';

@NeedAppLogin()
@Controller('api/question-tags')
export class QuestionTagController {
  constructor(private readonly questionTagService: QuestionTagService) {}

  @Get()
  async listTags(@Req() req: Request): Promise<QuestionTagListResponse> {
    const appUserId = req.appUser!.id;
    const items = await this.questionTagService.listTags(appUserId);
    return { items };
  }

  @Post()
  async createTag(
    @Req() req: Request,
    @Body() dto: CreateQuestionTagRequest,
  ) {
    const appUserId = req.appUser!.id;
    return this.questionTagService.createTag(appUserId, dto);
  }

  @Patch(':id')
  async updateTag(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionTagRequest,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    return this.questionTagService.updateTag(appUserId, id, dto);
  }

  @Delete(':id')
  async deleteTag(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    return this.questionTagService.deleteTag(appUserId, id);
  }

  @Get('question/:questionId')
  async getQuestionTags(
    @Req() req: Request,
    @Param('questionId') questionId: string,
  ): Promise<{ items: QuestionTagItem[] }> {
    const appUserId = req.appUser!.id;
    const items = await this.questionTagService.getQuestionTags(questionId, appUserId);
    return { items };
  }

  @Post('question/:questionId/tags')
  async setQuestionTags(
    @Req() req: Request,
    @Param('questionId') questionId: string,
    @Body() dto: SetQuestionTagsRequest,
  ) {
    const appUserId = req.appUser!.id;
    return this.questionTagService.setQuestionTags(
      appUserId,
      questionId,
      dto.tagIds,
    );
  }

  @Post('question/:questionId/tags/:tagId')
  async addTagToQuestion(
    @Req() req: Request,
    @Param('questionId') questionId: string,
    @Param('tagId') tagId: string,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    return this.questionTagService.addTagToQuestion(
      appUserId,
      questionId,
      tagId,
    );
  }

  @Delete('question/:questionId/tags/:tagId')
  async removeTagFromQuestion(
    @Req() req: Request,
    @Param('questionId') questionId: string,
    @Param('tagId') tagId: string,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    return this.questionTagService.removeTagFromQuestion(
      appUserId,
      questionId,
      tagId,
    );
  }

  @Get(':tagId/questions')
  async getQuestionsByTag(
    @Req() req: Request,
    @Param('tagId') tagId: string,
  ): Promise<QuestionTagWithQuestionsResponse> {
    const appUserId = req.appUser!.id;
    return this.questionTagService.getQuestionsByTag(appUserId, tagId);
  }

  @Post('generate-bank')
  async generateBankByTags(
    @Req() req: Request,
    @Body() dto: GenerateRandomBankByTagsRequest,
  ): Promise<GenerateRandomBankResponse> {
    const appUserId = req.appUser!.id;
    return this.questionTagService.generateBankByTags(appUserId, dto);
  }

  @Get('search/global')
  async globalSearch(
    @Req() req: Request,
    @Query('keyword') keyword: string,
    @Query('limit') limit?: string,
  ): Promise<GlobalSearchResponse> {
    const appUserId = req.appUser!.id;
    const limitNum = limit ? Math.min(parseInt(limit, 10), 200) : 50;
    return this.questionTagService.globalSearch(
      appUserId,
      keyword,
      limitNum,
    );
  }
}
