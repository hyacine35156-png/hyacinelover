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
import { FavoriteGroupService } from './favorite-group.service';

import type {
  FavoriteGroupListResponse,
  FavoriteGroupItem,
  CreateFavoriteGroupRequest,
  UpdateFavoriteGroupRequest,
  MoveFavoriteQuestionRequest,
  QuestionWithFavoriteListResponse,
} from '@shared/api.interface';

@NeedAppLogin()
@Controller('api/favorite-groups')
export class FavoriteGroupController {
  constructor(private readonly favoriteGroupService: FavoriteGroupService) {}

  @Get()
  async listGroups(
    @Req() req: Request,
  ): Promise<FavoriteGroupListResponse> {
    const appUserId = req.appUser!.id;
    return this.favoriteGroupService.listGroups(appUserId);
  }

  @Post()
  async createGroup(
    @Req() req: Request,
    @Body() dto: CreateFavoriteGroupRequest,
  ): Promise<FavoriteGroupItem> {
    const appUserId = req.appUser!.id;
    return this.favoriteGroupService.createGroup(appUserId, dto);
  }

  @Patch(':id')
  async updateGroup(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateFavoriteGroupRequest,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    return this.favoriteGroupService.updateGroup(appUserId, id, dto);
  }

  @Delete(':id')
  async deleteGroup(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    return this.favoriteGroupService.deleteGroup(appUserId, id);
  }

  @Post(':id/items')
  async addQuestions(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { questionIds: string[] },
  ): Promise<{ success: boolean; addedCount: number }> {
    const appUserId = req.appUser!.id;
    return this.favoriteGroupService.addQuestions(
      appUserId,
      id,
      body.questionIds,
    );
  }

  @Delete(':id/items/:questionId')
  async removeQuestion(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ): Promise<{ success: boolean }> {
    const appUserId = req.appUser!.id;
    return this.favoriteGroupService.removeQuestion(appUserId, id, questionId);
  }

  @Post('move')
  async moveQuestions(
    @Req() req: Request,
    @Body() dto: MoveFavoriteQuestionRequest,
  ): Promise<{ success: boolean; movedCount: number }> {
    const appUserId = req.appUser!.id;
    return this.favoriteGroupService.moveQuestions(appUserId, dto);
  }

  @Get(':id/questions')
  async getGroupQuestions(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<QuestionWithFavoriteListResponse> {
    const appUserId = req.appUser!.id;
    const result = await this.favoriteGroupService.getGroupQuestions(appUserId, id);
    return { items: result.items };
  }
}
