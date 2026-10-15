import { Controller, Get, Post, Put, Delete, Param, Body, Query, Req, Res, Logger, InternalServerErrorException } from '@nestjs/common';
import type { Request, Response } from 'express';
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

  @Get('export')
  async exportRecords(
    @Req() req: Request,
    @Res() res: Response,
    @Query('range') range?: string,
    @Query('format') format?: string,
    @Query('bankId') bankId?: string,
  ): Promise<void> {
    const logger = new Logger('PracticeRecordExport');
    try {
      const appUserId = req.appUser!.id;
      const validRange = (range === 'today' || range === 'week' || range === 'all')
        ? range
        : 'all';
      const validFormat = (format === 'json' || format === 'csv' || format === 'excel')
        ? format
        : 'json';
      logger.log(`导出请求: userId=${appUserId} range=${validRange} format=${validFormat} bankId=${bankId || 'all'}`);
      const result = await this.practiceRecordService.exportAnswers(
        appUserId,
        validRange,
        validFormat,
        bankId || undefined,
      );
      const exportResult = result as { filename: string; content: string; mimeType: string; isBase64?: boolean };
      res.setHeader('Content-Type', exportResult.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(exportResult.filename)}"`,
      );
      if (exportResult.isBase64) {
        const buf = Buffer.from(exportResult.content, 'base64');
        res.send(buf);
      } else {
        res.send(exportResult.content);
      }
      logger.log(`导出成功: ${exportResult.filename} format=${validFormat}`);
    } catch (error) {
      logger.error('导出失败', error instanceof Error ? error.stack : String(error));
      const err = new InternalServerErrorException(
        error instanceof Error ? error.message : '导出失败',
      );
      res.status(err.getStatus()).json({
        error: {
          code: (err as any).response?.error || 'INTERNAL_SERVER_ERROR',
          message: (err as any).response?.message || '导出失败',
        },
      });
    }
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
