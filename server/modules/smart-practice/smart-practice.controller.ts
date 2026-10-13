import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedAppLogin } from '../auth/jwt.guard';

import { SmartPracticeService } from './smart-practice.service';

import type {
  SmartRecommendResponse,
  SmartRecommendReason,
} from '@shared/api.interface';

interface WrongBookStreakSubmitRequest {
  questionId: string;
  isCorrect: boolean;
}

interface WrongBookStreakStateResponse {
  questionId: string;
  streak: number;
  target: number;
  wrongCount: number;
}

interface WrongBookStreakSubmitResponse {
  streak: number;
  mastered: boolean;
  wrongCount: number;
}

@NeedAppLogin()
@Controller('api/smart')
export class SmartPracticeController {
  constructor(private readonly smartPracticeService: SmartPracticeService) {}

  @Get('recommend')
  async getRecommend(
    @Req() req: Request,
    @Query('limit') limit?: string,
  ): Promise<SmartRecommendResponse> {
    const appUserId = req.appUser!.id;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.smartPracticeService.getRecommend(appUserId, limitNum);
  }

  @Get('wrongbook-streak/state')
  async getStreakState(
    @Req() req: Request,
    @Query('questionId') questionId: string,
  ): Promise<WrongBookStreakStateResponse> {
    const appUserId = req.appUser!.id;
    return this.smartPracticeService.getStreakState(appUserId, questionId);
  }

  @Post('wrongbook-streak/submit')
  async submitStreak(
    @Req() req: Request,
    @Body() dto: WrongBookStreakSubmitRequest,
  ): Promise<WrongBookStreakSubmitResponse> {
    const appUserId = req.appUser!.id;
    return this.smartPracticeService.submitStreak(
      appUserId,
      dto.questionId,
      dto.isCorrect,
    );
  }
}

export type { SmartRecommendReason };
