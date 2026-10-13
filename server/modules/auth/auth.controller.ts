import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { JwtAuthGuard, NeedAppLogin, extractTokenHash } from './jwt.guard';
import { SystemLogService } from '../system-log/system-log.service';

import type {
  AuthResponse,
  AppUserItem,
  RegisterRequest,
  LoginRequest,
  ChangePasswordRequest,
  ChangePasswordResponse,
} from '@shared/api.interface';

@Controller('api/auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly systemLogService: SystemLogService,
  ) {}

  @Post('register')
  async register(@Req() req: Request, @Body() dto: RegisterRequest): Promise<AuthResponse> {
    if (!dto || typeof dto.username !== 'string' || typeof dto.password !== 'string') {
      throw new BadRequestException('请提供用户名和密码');
    }
    const userAgent = req.headers['user-agent'] ?? undefined;
    const ipAddress = (req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim() || req.ip;
    const deviceIdHeader = (req.headers['x-device-id'] as string | undefined)?.trim();
    const deviceId = dto.deviceId || deviceIdHeader || undefined;
    return this.authService.register(dto.username, dto.password, {
      userAgent,
      ipAddress,
      deviceName: dto.deviceName,
      deviceId,
    });
  }

  @Post('login')
  async login(
    @Req() req: Request,
    @Body() dto: LoginRequest,
  ): Promise<AuthResponse> {
    if (!dto || typeof dto.username !== 'string' || typeof dto.password !== 'string') {
      throw new BadRequestException('请提供用户名和密码');
    }
    const userAgent = req.headers['user-agent'] ?? undefined;
    const ipAddress = (req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim() || req.ip;
    const deviceIdHeader = (req.headers['x-device-id'] as string | undefined)?.trim();
    const deviceId = dto.deviceId || deviceIdHeader || undefined;

    try {
      const result = await this.authService.login(dto.username, dto.password, {
        userAgent,
        ipAddress,
        deviceName: dto.deviceName,
        deviceId,
      });
      this.systemLogService.logAsync({
        logType: 'login',
        action: '用户登录',
        userId: result.user.id,
        username: result.user.username,
        status: 'success',
        req,
      });
      return result;
    } catch (err) {
      this.systemLogService.logAsync({
        logType: 'login',
        action: '登录失败',
        username: dto.username,
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
        req,
      });
      throw err;
    }
  }

  @Get('me')
  @NeedAppLogin()
  async getMe(@Req() req: Request): Promise<AppUserItem> {
    const appUser = req.appUser;
    if (!appUser) {
      // Should not happen since guard ensures it
      throw new BadRequestException('未登录');
    }
    return this.authService.getCurrentUser(appUser.id);
  }

  @Post('logout')
  @NeedAppLogin()
  async logout(@Req() req: Request): Promise<{ success: boolean }> {
    const tokenHash = extractTokenHash(req);
    const appUser = req.appUser;
    const result = await this.authService.logout(tokenHash);
    if (appUser) {
      this.systemLogService.logAsync({
        logType: 'logout',
        action: '用户登出',
        userId: appUser.id,
        username: appUser.username,
        status: 'success',
        req,
      });
    }
    return result;
  }

  @Post('change-password')
  @NeedAppLogin()
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordRequest,
  ): Promise<ChangePasswordResponse> {
    const appUser = req.appUser;
    if (!appUser) {
      throw new BadRequestException('未登录');
    }
    if (!dto || typeof dto.oldPassword !== 'string' || typeof dto.newPassword !== 'string') {
      throw new BadRequestException('请提供旧密码和新密码');
    }
    const tokenHash = extractTokenHash(req);
    return this.authService.changePassword(
      appUser.id,
      dto.oldPassword,
      dto.newPassword,
      tokenHash,
    );
  }
}
