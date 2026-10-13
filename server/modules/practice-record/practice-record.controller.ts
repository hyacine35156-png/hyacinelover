import { Controller, Get, Post, Put, Delete, Param, Body, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedAppLogin } from '../auth/jwt.guard';

import { PracticeRecordService } from './practice-record.service';

import type {
  PracticeRecordListResponse,
  CreatePracticeRecordRequest,
  CreatePracticeRecordResponse,
  PracticeStatisticsResponse,
  PracticeRecordDetailResponse,
  PracticeSessionProgressResponse,
  CreatePracticeSessionRequest,
  SaveAnswerProgressRequest,
  FinishPracticeSessionRequest,
  SaveBatchProgressRequest,
  ClearSubsequentAnswersRequest,
  ClearSubsequentAnswersResponse,
} from '@shared/api.interface';

@NeedAppLogin()
@Controller('api/practice-records')
export class PracticeRecordController {
  constructor(private readonly practiceRecordService: PracticeRecordService) {}

  @Get('statistics')
  async getStatistics(@Req() req: Request): Promise<PracticeStatisticsResponse> {
    const appUserId = req.appUser!.id;
    return this.practiceRecordService.getStatistics(appUserId);
  }

  @Get('active/:bankId')
  async getActiveSession(
    @Req() req: Request,
    @Param('bankId') bankId: string,
  ): Promise<PracticeSessionProgressResponse | null> {
    const appUserId = req.appUser!.id;
    return this.practiceRecordService.getActiveSession(appUserId, bankId);
  }

  @Get()
  async getRecords(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<PracticeRecordListResponse> {
    const appUserId = req.appUser!.id;
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 20;
    return this.practiceRecordService.getRecords(appUserId, p, ps);
  }

  @Get(':id')
  async getRecordDetail(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<PracticeRecordDetailResponse> {
    const appUserId = req.appUser!.id;
    return this.practiceRecordService.getRecordDetail(appUserId, id);
  }

  @Post('session')
  async createSession(
    @Req() req: Request,
    @Body() dto: CreatePracticeSessionRequest,
  ): Promise<PracticeSessionProgressResponse> {
    const appUserId = req.appUser!.id;
    return this.practiceRecordService.createSession(appUserId, dto);
  }

  @Put('answer')
  async saveAnswerProgress(
    @Req() req: Request,
    @Body() dto: SaveAnswerProgressRequest,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    return this.practiceRecordService.saveAnswerProgress(appUserId, dto);
  }

  @Put('batch')
  async saveBatchProgress(
    @Req() req: Request,
    @Body() dto: SaveBatchProgressRequest,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    return this.practiceRecordService.saveBatchProgress(appUserId, dto);
  }

  @Put('finish')
  async finishSession(
    @Req() req: Request,
    @Body() dto: FinishPracticeSessionRequest,
  ): Promise<CreatePracticeRecordResponse> {
    const appUserId = req.appUser!.id;
    return this.practiceRecordService.finishSession(appUserId, dto);
  }

  @Post()
  async submitRecord(
    @Req() req: Request,
    @Body() dto: CreatePracticeRecordRequest,
  ): Promise<CreatePracticeRecordResponse> {
    const appUserId = req.appUser!.id;
    return this.practiceRecordService.submitRecord(appUserId, dto);
  }

  @Delete(':id')
  async deleteRecord(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    return this.practiceRecordService.deleteRecord(appUserId, id);
  }

  @Delete('bank/:bankId')
  async clearBankRecords(
    @Req() req: Request,
    @Param('bankId') bankId: string,
  ): Promise<{ success: boolean; deletedCount: number }> {
    const appUserId = req.appUser!.id;
    return this.practiceRecordService.clearBankRecords(appUserId, bankId);
  }

  @Post(':recordId/clear-subsequent')
  async clearSubsequentAnswers(
    @Req() req: Request,
    @Param('recordId') recordId: string,
    @Body() body: Omit<ClearSubsequentAnswersRequest, 'recordId'>,
  ): Promise<ClearSubsequentAnswersResponse> {
    const appUserId = req.appUser!.id;
    return this.practiceRecordService.clearSubsequentAnswers(appUserId, {
      recordId,
      ...body,
    });
  }

  @Delete('batch')
  async batchDeleteRecords(
    @Req() req: Request,
    @Body() body: { ids: string[] },
  ): Promise<{ success: boolean; deletedCount: number }> {
    const appUserId = req.appUser!.id;
    return this.practiceRecordService.batchDeleteRecords(appUserId, body.ids);
  }
}
