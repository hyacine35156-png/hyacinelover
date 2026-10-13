import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedAppLogin } from '../auth/jwt.guard';
import { SubjectService } from './subject.service';

import type {
  SubjectListResponse,
  CreateSubjectRequest,
  UpdateSubjectRequest,
  BatchMoveBanksRequest,
} from '@shared/api.interface';

@NeedAppLogin()
@Controller('api/subjects')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Get()
  async listSubjects(@Req() req: Request): Promise<SubjectListResponse> {
    const appUserId = req.appUser!.id;
    const items = await this.subjectService.listSubjects(appUserId);
    return { items };
  }

  @Post()
  async createSubject(
    @Req() req: Request,
    @Body() dto: CreateSubjectRequest,
  ) {
    const appUserId = req.appUser!.id;
    return this.subjectService.createSubject(appUserId, dto);
  }

  @Patch(':id')
  async updateSubject(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateSubjectRequest,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    return this.subjectService.updateSubject(appUserId, id, dto);
  }

  @Delete(':id')
  async deleteSubject(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    return this.subjectService.deleteSubject(appUserId, id);
  }

  @Post('batch-move-banks')
  async batchMoveBanks(
    @Req() req: Request,
    @Body() dto: BatchMoveBanksRequest,
  ): Promise<{ success: boolean; movedCount: number }> {
    const appUserId = req.appUser!.id;
    return this.subjectService.batchMoveBanks(
      appUserId,
      dto.bankIds,
      dto.targetSubjectId,
    );
  }
}
