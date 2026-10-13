import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Param,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedAppLogin, Public } from '../auth/jwt.guard';
import { BankRatingService } from './bank-rating.service';

import type {
  BankRatingListResponse,
  SubmitRatingRequest,
  SubmitRatingResponse,
  DeleteRatingResponse,
} from '@shared/api.interface';

@Controller('api/bank-ratings')
export class BankRatingController {
  constructor(
    private readonly ratingService: BankRatingService,
  ) {}

  @Get(':bankId')
  @Public()
  async listRatings(
    @Param('bankId') bankId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<BankRatingListResponse> {
    if (!bankId) throw new BadRequestException('缺少题集ID');
    return this.ratingService.listRatings(
      bankId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Post()
  @NeedAppLogin()
  async submitRating(
    @Body() dto: SubmitRatingRequest,
    @Req() req: Request,
  ): Promise<SubmitRatingResponse> {
    const appUser = req.appUser;
    if (!appUser) throw new BadRequestException('未登录');
    return this.ratingService.submitRating(
      appUser.id,
      appUser.username,
      dto,
    );
  }

  @Delete(':bankId')
  @NeedAppLogin()
  async deleteRating(
    @Param('bankId') bankId: string,
    @Req() req: Request,
  ): Promise<DeleteRatingResponse> {
    if (!bankId) throw new BadRequestException('缺少题集ID');
    const appUser = req.appUser;
    if (!appUser) throw new BadRequestException('未登录');
    return this.ratingService.deleteRating(
      appUser.id,
      appUser.username,
      bankId,
    );
  }
}
