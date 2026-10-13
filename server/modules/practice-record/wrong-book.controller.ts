import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedAppLogin } from '../auth/jwt.guard';

import { WrongBookService } from './wrong-book.service';

import type {
  SetWrongReasonRequest,
  SetWrongReasonResponse,
  WrongBookStatsResponse,
  WrongReason,
  DifficultyLevel,
} from '@shared/api.interface';

interface WrongBookExportItem {
  questionId: string;
  content: string;
  questionType: string;
  options: { label: string; text: string }[];
  correctAnswers: number[];
  analysis: string;
  userAnswers: number[];
  isCorrect: boolean;
  wrongReason: string;
  note: string;
  difficulty: string;
  bankName: string;
}

@NeedAppLogin()
@Controller('api/wrong-book')
export class WrongBookController {
  constructor(private readonly wrongBookService: WrongBookService) {}

  @Post(':questionId/reason')
  async setWrongReason(
    @Req() req: Request,
    @Param('questionId') questionId: string,
    @Body() dto: SetWrongReasonRequest,
  ): Promise<SetWrongReasonResponse> {
    const appUserId = req.appUser!.id;
    return this.wrongBookService.setWrongReason(appUserId, questionId, dto.reason);
  }

  @Get('stats')
  async getStats(
    @Req() req: Request,
    @Query('reason') reason?: WrongReason,
    @Query('difficulty') difficulty?: DifficultyLevel,
    @Query('tagId') tagId?: string,
    @Query('bankId') bankId?: string,
  ): Promise<WrongBookStatsResponse> {
    const appUserId = req.appUser!.id;
    return this.wrongBookService.getStats(appUserId, {
      reason,
      difficulty,
      tagId,
      bankId,
    });
  }

  @Get('export')
  async exportWrongBook(
    @Req() req: Request,
    @Query('format') format: string = 'pdf',
    @Query('scope') scope: string = 'all',
    @Query('reasonFilter') reasonFilter?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<{ items: WrongBookExportItem[] }> {
    const appUserId = req.appUser!.id;
    const reasons = reasonFilter ? reasonFilter.split(',').filter(Boolean) : undefined;
    return this.wrongBookService.exportWrongBook(appUserId, {
      format: format as 'pdf' | 'word',
      scope: scope as 'all' | 'filtered' | 'date_range',
      reasonFilter: reasons,
      startDate,
      endDate,
    });
  }
}
