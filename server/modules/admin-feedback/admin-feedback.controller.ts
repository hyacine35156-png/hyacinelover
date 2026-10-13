import {
  Controller,
  Get,
  Put,
  Query,
  Body,
  Param,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedAppLogin, NeedAdmin } from '../auth/jwt.guard';
import { AdminFeedbackService } from './admin-feedback.service';

import type {
  AdminFeedbackStatsResponse,
  AdminFeedbackListResponse,
  AdminFeedbackItem,
  AdminFeedbackStatusUpdateRequest,
  AdminFeedbackStatusUpdateResponse,
  MyFeedbackListResponse,
} from '@shared/api.interface';

@Controller('api/admin/feedback')
export class AdminFeedbackController {
  constructor(
    private readonly feedbackService: AdminFeedbackService,
  ) {}

  @Get('stats')
  @NeedAppLogin()
  @NeedAdmin()
  async getStats(): Promise<AdminFeedbackStatsResponse> {
    return this.feedbackService.getStats();
  }

  @Get()
  @NeedAppLogin()
  @NeedAdmin()
  async listFeedbacks(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('sort') sort?: string,
  ): Promise<AdminFeedbackListResponse> {
    return this.feedbackService.listFeedbacks({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      source: source as 'question' | 'general' | undefined,
      status: status as 'unread' | 'read' | 'processing' | 'resolved' | 'closed' | undefined,
      keyword,
      sort: sort === 'oldest' ? 'oldest' : 'newest',
    });
  }

  @Get(':id')
  @NeedAppLogin()
  @NeedAdmin()
  async getDetail(@Param('id') id: string): Promise<AdminFeedbackItem> {
    if (!id) throw new BadRequestException('缺少反馈ID');
    return this.feedbackService.getFeedbackDetail(id);
  }

  @Put(':id/status')
  @NeedAppLogin()
  @NeedAdmin()
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: AdminFeedbackStatusUpdateRequest,
    @Req() req: Request,
  ): Promise<AdminFeedbackStatusUpdateResponse> {
    if (!id) throw new BadRequestException('缺少反馈ID');
    const appUser = req.appUser;
    if (!appUser) throw new BadRequestException('未登录');
    return this.feedbackService.updateStatus(
      id,
      dto.status,
      dto.adminReply,
      appUser.id,
      appUser.username,
    );
  }

  @Get('my/list')
  @NeedAppLogin()
  async listMyFeedbacks(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: Request,
  ): Promise<MyFeedbackListResponse> {
    const appUser = req?.appUser;
    if (!appUser) throw new BadRequestException('未登录');
    return this.feedbackService.listMyFeedbacks(
      appUser.id,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }
}
