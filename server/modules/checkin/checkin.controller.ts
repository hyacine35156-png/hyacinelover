import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedAppLogin } from '../auth/jwt.guard';

import { CheckinService } from './checkin.service';

import type {
  CheckinSettingItem,
  CheckinStatusResponse,
  UpdateCheckinSettingRequest,
  CheckinHistoryResponse,
  RecordAnswerRequest,
} from '@shared/api.interface';

@NeedAppLogin()
@Controller('api/checkin')
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Get('status')
  async getStatus(@Req() req: Request): Promise<CheckinStatusResponse> {
    const appUserId = req.appUser!.id;
    return this.checkinService.getStatus(appUserId);
  }

  @Get('setting')
  async getSetting(@Req() req: Request): Promise<CheckinSettingItem> {
    const appUserId = req.appUser!.id;
    return this.checkinService.getSetting(appUserId);
  }

  @Patch('setting')
  async updateSetting(
    @Req() req: Request,
    @Body() dto: UpdateCheckinSettingRequest,
  ): Promise<CheckinSettingItem> {
    const appUserId = req.appUser!.id;
    return this.checkinService.updateSetting(appUserId, dto);
  }

  @Post('record-answer')
  async recordAnswer(
    @Req() req: Request,
    @Body() dto: RecordAnswerRequest,
  ): Promise<{ todayAnswered: number; todayCompleted: boolean }> {
    const appUserId = req.appUser!.id;
    return this.checkinService.recordAnswer(appUserId, dto.questionId);
  }

  @Get('history')
  async getHistory(
    @Req() req: Request,
    @Query('days') days?: string,
  ): Promise<CheckinHistoryResponse> {
    const appUserId = req.appUser!.id;
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.checkinService.getHistory(appUserId, daysNum);
  }
}
