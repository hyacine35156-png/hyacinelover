import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

import { UserSettingsService } from './user-settings.service';
import { NeedAppLogin, extractTokenHash } from '../auth/jwt.guard';

import type {
  UserSettingsResponse,
  UpdateSettingsRequest,
  UserDeviceItem,
  SyncStateResponse,
} from '@shared/api.interface';

@Controller('api/user-settings')
export class UserSettingsController {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  // ==================== 用户设置 ====================

  @Get('/')
  @NeedAppLogin()
  async getSettings(@Req() req: Request): Promise<UserSettingsResponse> {
    const appUser = req.appUser;
    if (!appUser) {
      throw new BadRequestException('未登录');
    }
    return this.userSettingsService.getSettings(appUser.id);
  }

  @Patch('/')
  @NeedAppLogin()
  async updateSettings(
    @Req() req: Request,
    @Body() dto: UpdateSettingsRequest,
  ): Promise<UserSettingsResponse> {
    const appUser = req.appUser;
    if (!appUser) {
      throw new BadRequestException('未登录');
    }
    return this.userSettingsService.updateSettings(appUser.id, dto);
  }

  // ==================== 同步状态 ====================

  @Get('/sync-state')
  @NeedAppLogin()
  async getSyncState(@Req() req: Request): Promise<SyncStateResponse> {
    const appUser = req.appUser;
    if (!appUser) {
      throw new BadRequestException('未登录');
    }
    return this.userSettingsService.getSyncState(appUser.id);
  }

  @Post('/sync-ping')
  @NeedAppLogin()
  async pingSync(@Req() req: Request): Promise<SyncStateResponse> {
    const appUser = req.appUser;
    if (!appUser) {
      throw new BadRequestException('未登录');
    }
    return this.userSettingsService.pingSync(appUser.id);
  }

  // ==================== 设备管理 ====================

  @Get('/devices')
  @NeedAppLogin()
  async listDevices(@Req() req: Request): Promise<{ items: UserDeviceItem[] }> {
    const appUser = req.appUser;
    if (!appUser) {
      throw new BadRequestException('未登录');
    }
    const tokenHash = extractTokenHash(req);
    const items = await this.userSettingsService.listDevices(appUser.id, tokenHash);
    return { items };
  }

  @Post('/devices/logout-others')
  @NeedAppLogin()
  async logoutOthers(
    @Req() req: Request,
  ): Promise<{ success: boolean; removedCount: number }> {
    const appUser = req.appUser;
    if (!appUser) {
      throw new BadRequestException('未登录');
    }
    const tokenHash = extractTokenHash(req);
    return this.userSettingsService.logoutOthers(appUser.id, tokenHash);
  }

  @Delete('/devices/:deviceId')
  @NeedAppLogin()
  async removeDevice(
    @Req() req: Request,
    @Param('deviceId') deviceId: string,
  ): Promise<{ success: boolean }> {
    const appUser = req.appUser;
    if (!appUser) {
      throw new BadRequestException('未登录');
    }
    const tokenHash = extractTokenHash(req);
    return this.userSettingsService.removeDevice(appUser.id, deviceId, tokenHash);
  }
}
