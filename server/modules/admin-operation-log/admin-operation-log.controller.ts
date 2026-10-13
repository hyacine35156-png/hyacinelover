import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import { NeedAppLogin, NeedAdmin } from '../auth/jwt.guard';
import { AdminOperationLogService } from './admin-operation-log.service';

import type {
  AdminOperationLogListResponse,
} from '@shared/api.interface';

@Controller('api/admin/operation-logs')
export class AdminOperationLogController {
  constructor(
    private readonly logService: AdminOperationLogService,
  ) {}

  @Get()
  @NeedAppLogin()
  @NeedAdmin()
  async listLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('operationType') operationType?: string,
    @Query('adminId') adminId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<AdminOperationLogListResponse> {
    return this.logService.listLogs({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      operationType,
      adminId,
      startDate,
      endDate,
    });
  }
}
