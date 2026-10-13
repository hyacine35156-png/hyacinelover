import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedAppLogin } from '../auth/jwt.guard';

import { StatsService } from './stats.service';

import type {
  LearningDashboardResponse,
  KnowledgeMasteryResponse,
  LearningGoalsItem,
  UpdateLearningGoalsRequest,
  CheckinCalendarResponse,
} from '@shared/api.interface';

@NeedAppLogin()
@Controller('api/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  async getDashboard(@Req() req: Request): Promise<LearningDashboardResponse> {
    const appUserId = req.appUser!.id;
    return this.statsService.getDashboard(appUserId);
  }

  @Get('knowledge')
  async getKnowledgeMastery(
    @Req() req: Request,
  ): Promise<KnowledgeMasteryResponse> {
    const appUserId = req.appUser!.id;
    return this.statsService.getKnowledgeMastery(appUserId);
  }

  @Get('goals')
  async getLearningGoals(@Req() req: Request): Promise<LearningGoalsItem> {
    const appUserId = req.appUser!.id;
    return this.statsService.getLearningGoals(appUserId);
  }

  @Put('goals')
  async updateLearningGoals(
    @Req() req: Request,
    @Body() dto: UpdateLearningGoalsRequest,
  ): Promise<LearningGoalsItem> {
    const appUserId = req.appUser!.id;
    return this.statsService.updateLearningGoals(appUserId, dto);
  }

  @Get('checkin-calendar')
  async getCheckinCalendar(
    @Req() req: Request,
    @Query('days') days?: string,
  ): Promise<CheckinCalendarResponse> {
    const appUserId = req.appUser!.id;
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.statsService.getCheckinCalendar(appUserId, daysNum);
  }
}
