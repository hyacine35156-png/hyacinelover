import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, or, sql } from 'drizzle-orm';
import * as crypto from 'crypto';

function generateDeviceId(userAgent: string, ip: string | undefined): string {
  const base = `${userAgent.slice(0, 200)}|${ip || 'unknown'}`;
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 32);
}

import { appUser, userDevice } from '@server/database/schema';
import type { AppUserItem, AuthResponse } from '@shared/api.interface';

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('[auth] FATAL: 生产环境必须配置 JWT_SECRET 环境变量，拒绝启动以防止使用默认密钥');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-in-production';
const JWT_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
export const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 推荐
export const PBKDF2_KEY_LEN = 64;
const PBKDF2_DIGEST = 'sha256';
export const SALT_LEN = 16;

if (!process.env.JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('[auth] WARNING: JWT_SECRET 未设置，正在使用开发默认密钥（仅开发环境允许，生产环境会拒绝启动）');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LEN).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LEN,
    PBKDF2_DIGEST,
  ).toString('hex');
  return `${PBKDF2_ITERATIONS}:${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  // 兼容旧格式（无迭代次数前缀，默认10000）
  const iterations = parts.length === 3 ? parseInt(parts[0], 10) : 10000;
  const salt = parts.length === 3 ? parts[1] : parts[0];
  const derivedKey = parts.length === 3 ? parts[2] : parts[1];
  if (!salt || !derivedKey) return false;
  const inputKey = crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    PBKDF2_KEY_LEN,
    PBKDF2_DIGEST,
  ).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(inputKey), Buffer.from(derivedKey));
}

function base64UrlEncode(data: Buffer): string {
  return data
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

function signJwt(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + Math.floor(JWT_EXPIRES_IN_MS / 1000),
  };
  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(fullPayload)));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signatureInput)
    .digest();
  const encodedSignature = base64UrlEncode(signature);
  return `${signatureInput}.${encodedSignature}`;
}

export function verifyJwt(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new UnauthorizedException('无效的 token 格式');
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signatureInput)
    .digest();
  const actualSignature = base64UrlDecode(encodedSignature);
  if (!crypto.timingSafeEqual(expectedSignature, actualSignature)) {
    throw new UnauthorizedException('token 签名验证失败');
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  } catch {
    throw new UnauthorizedException('无效的 token 负载');
  }
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new UnauthorizedException('token 已过期');
  }
  return payload;
}

/**
 * 从 User-Agent 字符串中简单解析浏览器名称。
 */
function parseBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua)) return 'Safari';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/MSIE|Trident/i.test(ua)) return 'IE';
  return 'Unknown';
}

/**
 * 从 User-Agent 字符串中简单解析操作系统名称。
 */
function parseOS(ua: string): string {
  if (/Windows NT 10/i.test(ua)) return 'Windows 10/11';
  if (/Windows NT/i.test(ua)) return 'Windows';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async register(username: string, password: string, deviceInfo?: {
    userAgent?: string;
    ipAddress?: string;
    deviceName?: string;
    deviceId?: string;
  }): Promise<AuthResponse> {
    if (!username?.trim()) {
      throw new BadRequestException('用户名不能为空');
    }
    const trimmedUsername = username.trim();
    if (trimmedUsername.length > 50) {
      throw new BadRequestException('用户名不能超过 50 个字符');
    }
    if (!password || password.length < 6) {
      throw new BadRequestException('密码长度不能少于 6 位');
    }

    const existing = await this.db
      .select({ id: appUser.id })
      .from(appUser)
      .where(eq(appUser.username, trimmedUsername));
    if (existing.length > 0) {
      throw new ConflictException('用户名已被占用');
    }

    const nextUid = await this.getNextUid();
    const passwordHash = hashPassword(password);
    const [inserted] = await this.db
      .insert(appUser)
      .values({
        username: trimmedUsername,
        passwordHash,
        uid: nextUid,
      })
      .returning({
        id: appUser.id,
        username: appUser.username,
        uid: appUser.uid,
        role: appUser.role,
        createdAt: appUser.createdAt,
      });

    const user: AppUserItem = {
      id: inserted.id,
      username: inserted.username,
      uid: inserted.uid ?? null,
      role: inserted.role ?? 'user',
      createdAt: inserted.createdAt.toISOString(),
    };
    // 提前计算 deviceId 用于 JWT payload
    const regDeviceId = deviceInfo?.deviceId || generateDeviceId(deviceInfo?.userAgent ?? '', deviceInfo?.ipAddress);
    const token = this.generateToken(user.id, user.username, user.role, regDeviceId);

    // 注册成功后创建设备记录，与登录行为保持一致
    // 避免新用户注册后立即访问需鉴权接口时因无设备记录被 401
    if (deviceInfo) {
      try {
        const tokenHash = hashToken(token);
        const userAgent = deviceInfo.userAgent ?? '';
        const browser = parseBrowser(userAgent);
        const os = parseOS(userAgent);
        const deviceName = deviceInfo.deviceName || `${browser} · ${os}`;
        const deviceId = regDeviceId;
        await this.db.insert(userDevice).values({
          userId: user.id,
          deviceId,
          deviceName,
          browser,
          os,
          ipAddress: deviceInfo.ipAddress,
          userAgent: userAgent.slice(0, 500),
          tokenHash,
        }).onConflictDoUpdate({
          target: [userDevice.userId, userDevice.deviceId],
          set: {
            deviceName,
            browser,
            os,
            ipAddress: deviceInfo.ipAddress,
            userAgent: userAgent.slice(0, 500),
            tokenHash,
            lastActiveAt: new Date(),
          },
        });
      } catch (error) {
        // 设备记录失败不应影响注册结果
        this.logger.error(`注册时记录设备失败: ${JSON.stringify(error)}`);
      }
    }

    this.logger.log(`用户注册成功: ${user.username}, uid=${nextUid}`);
    return { user, token };
  }

  private async getNextUid(): Promise<string> {
    const rows = await this.db
      .select({ uid: appUser.uid })
      .from(appUser)
      .where(sql`${appUser.uid} ~ '^[0-9]+$'`)
      .orderBy(sql`${appUser.uid}::integer DESC`)
      .limit(1);
    if (rows.length === 0 || !rows[0].uid) {
      return '10000';
    }
    return (parseInt(rows[0].uid, 10) + 1).toString();
  }

  /**
   * 登录并记录设备信息。
   */
  async login(
    identifier: string,
    password: string,
    deviceInfo: {
      userAgent?: string;
      ipAddress?: string;
      deviceName?: string;
      deviceId?: string;
    },
  ): Promise<AuthResponse> {
    if (!identifier?.trim() || !password) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const trimmedIdentifier = identifier.trim();

    const rows = await this.db
      .select({
        id: appUser.id,
        username: appUser.username,
        uid: appUser.uid,
        passwordHash: appUser.passwordHash,
        role: appUser.role,
        createdAt: appUser.createdAt,
      })
      .from(appUser)
      .where(or(
        eq(appUser.username, trimmedIdentifier),
        eq(appUser.uid, trimmedIdentifier),
      ));

    if (rows.length === 0) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const row = rows[0];
    if (!verifyPassword(password, row.passwordHash)) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const user: AppUserItem = {
      id: row.id,
      username: row.username,
      uid: row.uid ?? null,
      role: row.role ?? 'user',
      createdAt: row.createdAt.toISOString(),
    };
    // 提前计算 deviceId 用于 JWT payload
    const loginDeviceId = deviceInfo.deviceId || generateDeviceId(deviceInfo.userAgent ?? '', deviceInfo.ipAddress);
    const token = this.generateToken(user.id, user.username, user.role, loginDeviceId);

    // 记录设备
    const tokenHash = hashToken(token);
    const userAgent = deviceInfo.userAgent ?? '';
    const browser = parseBrowser(userAgent);
    const os = parseOS(userAgent);
    const deviceName = deviceInfo.deviceName || `${browser} · ${os}`;

    try {
      const deviceId = loginDeviceId;
      await this.db.insert(userDevice).values({
        userId: user.id,
        deviceId,
        deviceName,
        browser,
        os,
        ipAddress: deviceInfo.ipAddress,
        userAgent: userAgent.slice(0, 500),
        tokenHash,
      }).onConflictDoUpdate({
        target: [userDevice.userId, userDevice.deviceId],
        set: {
          deviceName,
          browser,
          os,
          ipAddress: deviceInfo.ipAddress,
          userAgent: userAgent.slice(0, 500),
          tokenHash,
          lastActiveAt: new Date(),
        },
      });
    } catch (error) {
      // 设备记录失败不应影响登录
      this.logger.error(`记录登录设备失败: ${JSON.stringify(error)}`);
    }

    return { user, token };
  }

  async getCurrentUser(userId: string): Promise<AppUserItem> {
    const rows = await this.db
      .select({
        id: appUser.id,
        username: appUser.username,
        uid: appUser.uid,
        role: appUser.role,
        createdAt: appUser.createdAt,
      })
      .from(appUser)
      .where(eq(appUser.id, userId));

    if (rows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const row = rows[0];
    return {
      id: row.id,
      username: row.username,
      uid: row.uid ?? null,
      role: row.role ?? 'user',
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * 登出：删除当前 token 对应的设备记录。
   */
  async logout(tokenHash: string): Promise<{ success: boolean }> {
    if (tokenHash) {
      await this.db
        .delete(userDevice)
        .where(eq(userDevice.tokenHash, tokenHash));
    }
    return { success: true };
  }

  /**
   * 验证指定 token_hash 的设备记录是否仍存在（用于 guard 检查）。
   */
  async verifyDeviceByTokenHash(userId: string, tokenHash: string): Promise<boolean> {
    if (!tokenHash) {
      // 没有 token 哈希时不阻止，交给后面的逻辑
      return true;
    }
    const rows = await this.db
      .select({ id: userDevice.id })
      .from(userDevice)
      .where(and(
        eq(userDevice.userId, userId),
        eq(userDevice.tokenHash, tokenHash),
      ))
      .limit(1);
    return rows.length > 0;
  }

  async verifyDeviceExists(
    userId: string,
    deviceId: string | undefined,
    tokenHash: string,
  ): Promise<boolean> {
    if (!tokenHash) return true;
    // 优先以 tokenHash 校验设备是否有效（token 本身是强认证凭证）
    // deviceId 仅用于设备管理展示，不参与强校验，避免 iframe / 存储降级场景下 deviceId 漂移导致 401
    const rows = await this.db
      .select({
        id: userDevice.id,
        deviceId: userDevice.deviceId,
      })
      .from(userDevice)
      .where(and(
        eq(userDevice.userId, userId),
        eq(userDevice.tokenHash, tokenHash),
      ))
      .limit(1);
    if (rows.length === 0) return false;
    const row = rows[0];
    // deviceId 漂移时静默修正到最新值（同步 lastActiveAt）
    if (deviceId && row.deviceId !== deviceId) {
      this.logger.verbose(
        `deviceId 漂移，同步更新 userId=${userId} old=${row.deviceId} new=${deviceId}`,
      );
      try {
        await this.db
          .update(userDevice)
          .set({
            deviceId,
            lastActiveAt: new Date(),
          })
          .where(eq(userDevice.id, row.id));
      } catch (err) {
        this.logger.warn(
          `同步 deviceId 失败: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      // 正常请求只更新最后活跃时间
      try {
        await this.db
          .update(userDevice)
          .set({ lastActiveAt: new Date() })
          .where(eq(userDevice.id, row.id));
      } catch {
        // ignore
      }
    }
    return true;
  }

  /**
   * 修改密码：验证旧密码，更新密码哈希，下线所有其他设备。
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    currentTokenHash: string,
  ): Promise<{ success: boolean }> {
    if (!oldPassword || !newPassword) {
      throw new BadRequestException('旧密码和新密码不能为空');
    }
    if (newPassword.length < 6) {
      throw new BadRequestException('新密码长度不能少于 6 位');
    }
    if (oldPassword === newPassword) {
      throw new BadRequestException('新密码不能与旧密码相同');
    }

    const rows = await this.db
      .select({ passwordHash: appUser.passwordHash })
      .from(appUser)
      .where(eq(appUser.id, userId));

    if (rows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    if (!verifyPassword(oldPassword, rows[0].passwordHash)) {
      throw new BadRequestException('旧密码不正确');
    }

    const newHash = hashPassword(newPassword);
    await this.db
      .update(appUser)
      .set({ passwordHash: newHash })
      .where(eq(appUser.id, userId));

    // 下线所有其他设备（保留当前设备）
    const { ne } = await import('drizzle-orm');
    await this.db
      .delete(userDevice)
      .where(and(
        eq(userDevice.userId, userId),
        ne(userDevice.tokenHash, currentTokenHash),
      ));

    this.logger.log(`用户修改密码成功: userId=${userId}`);
    return { success: true };
  }

  private generateToken(userId: string, username: string, role?: string, deviceId?: string): string {
    return signJwt({ sub: userId, username, role: role ?? 'user', ...(deviceId ? { deviceId } : {}) });
  }
}
