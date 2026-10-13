import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Query,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedAppLogin } from '../auth/jwt.guard';
import { BankCollaborationService } from './bank-collaboration.service';

import type {
  SubmitEditRequestRequest,
  SubmitEditRequestResponse,
  ReviewEditRequestRequest,
  ReviewEditRequestResponse,
  CollaboratorListResponse,
  RemoveCollaboratorResponse,
  BankVersionListResponse,
  BankVersionDetailResponse,
  RollbackVersionResponse,
  EditRequestListResponse,
} from '@shared/api.interface';

@NeedAppLogin()
@Controller('api/bank-collaboration')
export class BankCollaborationController {
  constructor(
    private readonly bankCollaborationService: BankCollaborationService,
  ) {}

  // ========== 编辑申请 ==========

  @Post('edit-requests')
  async submitEditRequest(
    @Req() req: Request,
    @Body() dto: SubmitEditRequestRequest,
  ): Promise<SubmitEditRequestResponse> {
    const appUserId = req.appUser!.id;
    const userId = req.userContext.userId;
    const username = req.appUser!.username;
    return this.bankCollaborationService.submitEditRequest(
      appUserId,
      userId,
      username,
      dto.bankId,
      dto.reason,
    );
  }

  @Get('edit-requests/received')
  async getReceivedEditRequests(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ): Promise<EditRequestListResponse> {
    const appUserId = req.appUser!.id;
    const role = req.appUser!.role;
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    const validStatus = (status === 'pending' || status === 'approved' || status === 'rejected')
      ? (status as 'pending' | 'approved' | 'rejected')
      : 'all';
    return this.bankCollaborationService.getReceivedEditRequests(
      appUserId,
      role,
      pageNum,
      pageSizeNum,
      validStatus,
    );
  }

  @Post('edit-requests/:id/review')
  async reviewEditRequest(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ReviewEditRequestRequest,
  ): Promise<ReviewEditRequestResponse> {
    const reviewerUserId = req.userContext.userId;
    const reviewerAppUserId = req.appUser!.id;
    const role = req.appUser!.role;
    if (dto.action !== 'approve' && dto.action !== 'reject') {
      throw new BadRequestException('无效的操作类型');
    }
    return this.bankCollaborationService.reviewEditRequest(
      id,
      reviewerUserId,
      reviewerAppUserId,
      role,
      dto.action,
      dto.reviewNote,
    );
  }

  // ========== 协作者 ==========

  @Get(':bankId/collaborators')
  async getCollaborators(
    @Req() req: Request,
    @Param('bankId') bankId: string,
  ): Promise<CollaboratorListResponse> {
    const appUserId = req.appUser!.id;
    const role = req.appUser!.role;
    return this.bankCollaborationService.getCollaborators(bankId, appUserId, role);
  }

  @Post(':bankId/collaborators/:collaboratorId/remove')
  async removeCollaborator(
    @Req() req: Request,
    @Param('bankId') bankId: string,
    @Param('collaboratorId') collaboratorId: string,
  ): Promise<RemoveCollaboratorResponse> {
    const appUserId = req.appUser!.id;
    const role = req.appUser!.role;
    return this.bankCollaborationService.removeCollaborator(
      bankId,
      collaboratorId,
      appUserId,
      role,
    );
  }

  // ========== 版本历史 ==========

  @Get(':bankId/versions')
  async getVersionList(
    @Req() req: Request,
    @Param('bankId') bankId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<BankVersionListResponse> {
    const appUserId = req.appUser!.id;
    const role = req.appUser!.role;
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.bankCollaborationService.getVersionList(
      bankId,
      appUserId,
      role,
      pageNum,
      pageSizeNum,
    );
  }

  @Get('versions/:versionId')
  async getVersionDetail(
    @Req() req: Request,
    @Param('versionId') versionId: string,
  ): Promise<BankVersionDetailResponse> {
    const appUserId = req.appUser!.id;
    const role = req.appUser!.role;
    return this.bankCollaborationService.getVersionDetail(
      versionId,
      appUserId,
      role,
    );
  }

  @Post('versions/:versionId/rollback')
  async rollbackVersion(
    @Req() req: Request,
    @Param('versionId') versionId: string,
  ): Promise<RollbackVersionResponse> {
    const appUserId = req.appUser!.id;
    const userId = req.userContext.userId;
    const role = req.appUser!.role;
    return this.bankCollaborationService.rollbackVersion(
      versionId,
      appUserId,
      userId,
      role,
    );
  }
}
