import {
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Injectable,
  SetMetadata,
  Inject,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';

import { verifyJwt } from './auth.service';

export const NEED_APP_LOGIN_KEY = 'needAppLogin';
export const NeedAppLogin = () => SetMetadata(NEED_APP_LOGIN_KEY, true);
export const Public = () => SetMetadata(NEED_APP_LOGIN_KEY, false);

export const NEED_ADMIN_KEY = 'needAdmin';
export const NeedAdmin = () => SetMetadata(NEED_ADMIN_KEY, true);

export interface AppUserPayload {
  id: string;
  username: string;
  role?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      appUser?: AppUserPayload;
      appTokenHash?: string;
    }
  }
}

/**
 * 从请求中提取 Bearer token 并计算 SHA-256 哈希（小写十六进制）。
 * 未携带 token 时返回空字符串。
 */
export function extractTokenHash(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return req.appTokenHash ?? '';
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return req.appTokenHash ?? '';
  }
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const needAppLogin = this.reflector.getAllAndOverride<boolean>(
      NEED_APP_LOGIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!needAppLogin) {
      return true;
    }

    const req: Request = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;
    const deviceId = (req.headers['x-device-id'] as string | undefined)?.trim();
    const method = req.method;
    const url = req.url;

    this.logger.debug(
      `[JwtAuthGuard] 校验请求 ${method} ${url} authHeader=${!!authHeader} deviceId=${!!deviceId}`,
    );

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn(
        `[JwtAuthGuard] 缺少 Authorization 请求头 ${method} ${url}`,
      );
      throw new UnauthorizedException('缺少认证 token');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      this.logger.warn(`[JwtAuthGuard] token 为空 ${method} ${url}`);
      throw new UnauthorizedException('缺少认证 token');
    }

    try {
      const payload = verifyJwt(token);
      const sub = payload.sub;
      const username = payload.username;
      const role = typeof payload.role === 'string' ? payload.role : 'user';
      if (typeof sub !== 'string' || typeof username !== 'string') {
        this.logger.warn(
          `[JwtAuthGuard] token 负载格式错误 ${method} ${url}`,
        );
        throw new UnauthorizedException('无效的 token 负载');
      }
      req.appUser = { id: sub, username, role };
      req.appTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      if (!req.userContext) {
        (req as any).userContext = {};
      }
      (req as any).userContext.userId = sub;

      // 设备检查：验证当前设备是否仍在用户设备列表中
      // 不存在说明已被下线（如改密码、远程下线）
      const deviceExists = await this.authService.verifyDeviceExists(
        sub,
        deviceId,
        req.appTokenHash,
      );
      if (!deviceExists) {
        this.logger.warn(
          `[JwtAuthGuard] 设备校验失败 userId=${sub} deviceId=${deviceId ?? 'none'} ${method} ${url}`,
        );
        throw new UnauthorizedException('该设备已被下线，请重新登录');
      }

      this.logger.debug(
        `[JwtAuthGuard] 校验通过 userId=${sub} deviceId=${deviceId ?? 'none'} ${method} ${url}`,
      );

      const needAdmin = this.reflector.getAllAndOverride<boolean>(
        NEED_ADMIN_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (needAdmin && role !== 'admin') {
        this.logger.warn(
          `[JwtAuthGuard] 管理员权限不足 userId=${sub} role=${role} ${method} ${url}`,
        );
        throw new ForbiddenException('需要管理员权限');
      }

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[JwtAuthGuard] token 验证失败 ${method} ${url} reason=${errMsg}`,
      );
      throw new UnauthorizedException('token 验证失败');
    }
  }
}
