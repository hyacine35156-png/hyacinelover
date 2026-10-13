import { Injectable, Inject, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, sql } from 'drizzle-orm';
import { userSettings, userDevice, userSyncState } from '@server/database/schema';

import type {
  UserSettingsResponse,
  UpdateSettingsRequest,
  UserDeviceItem,
  SyncStateResponse,
  UserWallpaperItem,
} from '@shared/api.interface';

const DEFAULT_WALLPAPERS: { id: string; url: string; name: string }[] = [
  { id: 'default-1', url: 'https://aka.doubaocdn.com/s/bqxmfV2Vlw', name: '遐蝶5' },
  { id: 'default-2', url: 'https://aka.doubaocdn.com/s/t1DCLh9gsY', name: '木偶' },
  { id: 'default-3', url: 'https://aka.doubaocdn.com/s/fuZEag387v', name: '遐蝶3' },
];

const DEFAULT_SETTINGS: Omit<UserSettingsResponse, 'updatedAt'> = {
  theme: 'light',
  fontSize: 'md',
  questionFontSize: 'md',
  voiceRate: 1.0,
  voiceScope: 'options',
  autoReadAnalysis: false,
  autoSync: true,
  syncInterval: 300,
  autoDownload: false,
  wallpaperType: 'none',
  wallpaperUrl: null,
  wallpaperOpacity: 40,
  wallpaperSize: 'cover',
  userWallpapers: [],
  wallpaperShowInPractice: false,
};

const THEME_VALUES = new Set(['light', 'dark', 'system']);
const FONT_SIZE_VALUES = new Set(['sm', 'md', 'lg', 'xl']);
const VOICE_SCOPE_VALUES = new Set(['question', 'options', 'analysis']);
const SYNC_FREQUENCY_VALUES = new Set(['realtime', 'interval', 'manual']);
const WALLPAPER_TYPE_VALUES = new Set(['none', 'default', 'custom']);
const WALLPAPER_SIZE_VALUES = new Set(['cover', 'contain', 'stretch']);

@Injectable()
export class UserSettingsService {
  private readonly logger = new Logger(UserSettingsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getSettings(userId: string): Promise<UserSettingsResponse> {
    const rows = await this.db
      .select({
        theme: userSettings.theme,
        fontSize: userSettings.fontSize,
        questionFontSize: userSettings.questionFontSize,
        voiceRate: userSettings.voiceRate,
        voiceScope: userSettings.voiceScope,
        autoReadAnalysis: userSettings.autoReadAnalysis,
        autoSync: userSettings.autoSync,
        syncInterval: userSettings.syncInterval,
        autoDownload: userSettings.autoDownload,
        wallpaperType: userSettings.wallpaperType,
        wallpaperUrl: userSettings.wallpaperUrl,
        wallpaperOpacity: userSettings.wallpaperOpacity,
        wallpaperSize: userSettings.wallpaperSize,
        userWallpapers: userSettings.userWallpapers,
        wallpaperShowInPractice: userSettings.wallpaperShowInPractice,
        updatedAt: userSettings.updatedAt,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (rows.length === 0) {
      return {
        ...DEFAULT_SETTINGS,
        updatedAt: new Date().toISOString(),
      };
    }

    const row = rows[0];
    const voiceRateNum = typeof row.voiceRate === 'string'
      ? Number(row.voiceRate)
      : row.voiceRate;
    const syncIntervalNum = typeof row.syncInterval === 'string'
      ? Number(row.syncInterval)
      : row.syncInterval;

    return {
      theme: THEME_VALUES.has(row.theme || '')
        ? row.theme as UserSettingsResponse['theme']
        : DEFAULT_SETTINGS.theme,
      fontSize: FONT_SIZE_VALUES.has(row.fontSize || '')
        ? row.fontSize as UserSettingsResponse['fontSize']
        : DEFAULT_SETTINGS.fontSize,
      questionFontSize: FONT_SIZE_VALUES.has(row.questionFontSize || '')
        ? row.questionFontSize as UserSettingsResponse['questionFontSize']
        : DEFAULT_SETTINGS.questionFontSize,
      voiceRate: !Number.isNaN(voiceRateNum) ? voiceRateNum : DEFAULT_SETTINGS.voiceRate,
      voiceScope: VOICE_SCOPE_VALUES.has(row.voiceScope || '')
        ? row.voiceScope as UserSettingsResponse['voiceScope']
        : DEFAULT_SETTINGS.voiceScope,
      autoReadAnalysis: !!row.autoReadAnalysis,
      autoSync: row.autoSync !== false,
      syncInterval: !Number.isNaN(syncIntervalNum)
        ? syncIntervalNum
        : DEFAULT_SETTINGS.syncInterval,
      autoDownload: !!row.autoDownload,
      wallpaperType: WALLPAPER_TYPE_VALUES.has(row.wallpaperType || '')
        ? row.wallpaperType as UserSettingsResponse['wallpaperType']
        : DEFAULT_SETTINGS.wallpaperType,
      wallpaperUrl: row.wallpaperUrl ?? null,
      wallpaperOpacity: typeof row.wallpaperOpacity === 'string'
        ? Number(row.wallpaperOpacity)
        : (row.wallpaperOpacity ?? DEFAULT_SETTINGS.wallpaperOpacity),
      wallpaperSize: WALLPAPER_SIZE_VALUES.has(row.wallpaperSize || '')
        ? row.wallpaperSize as UserSettingsResponse['wallpaperSize']
        : DEFAULT_SETTINGS.wallpaperSize,
      userWallpapers: Array.isArray(row.userWallpapers)
        ? (row.userWallpapers as UserWallpaperItem[])
        : DEFAULT_SETTINGS.userWallpapers,
      wallpaperShowInPractice: !!row.wallpaperShowInPractice,
      updatedAt: row.updatedAt
        ? new Date(row.updatedAt).toISOString()
        : new Date().toISOString(),
    };
  }

  async updateSettings(
    userId: string,
    dto: UpdateSettingsRequest,
  ): Promise<UserSettingsResponse> {
    if (dto.theme !== undefined && !THEME_VALUES.has(dto.theme)) {
      throw new BadRequestException(`主题值无效: ${dto.theme}`);
    }
    if (dto.fontSize !== undefined && !FONT_SIZE_VALUES.has(dto.fontSize)) {
      throw new BadRequestException(`字号值无效: ${dto.fontSize}`);
    }
    if (dto.questionFontSize !== undefined && !FONT_SIZE_VALUES.has(dto.questionFontSize)) {
      throw new BadRequestException(`题文字号值无效: ${dto.questionFontSize}`);
    }
    if (dto.voiceScope !== undefined && !VOICE_SCOPE_VALUES.has(dto.voiceScope)) {
      throw new BadRequestException(`朗读范围无效: ${dto.voiceScope}`);
    }
    if (dto.voiceRate !== undefined && (dto.voiceRate < 0.5 || dto.voiceRate > 2)) {
      throw new BadRequestException('语速必须在 0.5 - 2.0 之间');
    }
    if (dto.syncFrequency !== undefined && !SYNC_FREQUENCY_VALUES.has(dto.syncFrequency)) {
      throw new BadRequestException(`同步频率无效: ${dto.syncFrequency}`);
    }
    if (dto.wallpaperType !== undefined && !WALLPAPER_TYPE_VALUES.has(dto.wallpaperType)) {
      throw new BadRequestException(`壁纸类型无效: ${dto.wallpaperType}`);
    }
    if (dto.wallpaperSize !== undefined && !WALLPAPER_SIZE_VALUES.has(dto.wallpaperSize)) {
      throw new BadRequestException(`壁纸尺寸模式无效: ${dto.wallpaperSize}`);
    }
    if (dto.wallpaperOpacity !== undefined
      && (dto.wallpaperOpacity < 0 || dto.wallpaperOpacity > 100)) {
      throw new BadRequestException('壁纸透明度必须在 0 - 100 之间');
    }
    if (dto.wallpaperShowInPractice !== undefined
      && typeof dto.wallpaperShowInPractice !== 'boolean') {
      throw new BadRequestException('练习页壁纸开关值无效');
    }

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('未提供可更新的设置字段');
    }

    const patch: Record<string, unknown> = {};
    if (dto.theme !== undefined) patch.theme = dto.theme;
    if (dto.fontSize !== undefined) patch.fontSize = dto.fontSize;
    if (dto.questionFontSize !== undefined) patch.questionFontSize = dto.questionFontSize;
    if (dto.voiceRate !== undefined) patch.voiceRate = String(dto.voiceRate);
    if (dto.voiceScope !== undefined) patch.voiceScope = dto.voiceScope;
    if (dto.autoReadAnalysis !== undefined) patch.autoReadAnalysis = dto.autoReadAnalysis;
    if (dto.autoSync !== undefined) patch.autoSync = dto.autoSync;
    if (dto.syncFrequency !== undefined) patch.syncFrequency = dto.syncFrequency;
    if (dto.autoDownload !== undefined) patch.autoDownload = dto.autoDownload;
    if (dto.wallpaperType !== undefined) patch.wallpaperType = dto.wallpaperType;
    if (dto.wallpaperUrl !== undefined) patch.wallpaperUrl = dto.wallpaperUrl;
    if (dto.wallpaperOpacity !== undefined) patch.wallpaperOpacity = dto.wallpaperOpacity;
    if (dto.wallpaperSize !== undefined) patch.wallpaperSize = dto.wallpaperSize;
    if (dto.userWallpapers !== undefined) patch.userWallpapers = dto.userWallpapers;
    if (dto.wallpaperShowInPractice !== undefined) {
      patch.wallpaperShowInPractice = dto.wallpaperShowInPractice;
    }

    await this.db
      .insert(userSettings)
      .values({ userId, ...patch })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: patch,
      });

    return this.getSettings(userId);
  }

  // ==================== 同步状态 ====================

  async getSyncState(userId: string): Promise<SyncStateResponse> {
    const rows = await this.db
      .select({ lastSyncedAt: userSyncState.lastSyncedAt })
      .from(userSyncState)
      .where(eq(userSyncState.userId, userId))
      .limit(1);

    if (rows.length === 0 || !rows[0].lastSyncedAt) {
      return {};
    }

    return {
      lastSyncedAt: new Date(rows[0].lastSyncedAt).toISOString(),
    };
  }

  async pingSync(userId: string): Promise<SyncStateResponse> {
    const now = new Date();
    await this.db
      .insert(userSyncState)
      .values({
        userId,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: userSyncState.userId,
        set: { lastSyncedAt: now },
      });

    return { lastSyncedAt: now.toISOString() };
  }

  // ==================== 设备管理 ====================

  async listDevices(
    userId: string,
    currentTokenHash: string,
  ): Promise<UserDeviceItem[]> {
    const rows = await this.db
      .select({
        id: userDevice.id,
        userId: userDevice.userId,
        deviceId: userDevice.deviceId,
        deviceName: userDevice.deviceName,
        browser: userDevice.browser,
        os: userDevice.os,
        ipAddress: userDevice.ipAddress,
        lastActiveAt: userDevice.lastActiveAt,
        createdAt: userDevice.createdAt,
        tokenHash: userDevice.tokenHash,
      })
      .from(userDevice)
      .where(eq(userDevice.userId, userId))
      .orderBy(desc(userDevice.lastActiveAt));

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      deviceId: row.deviceId,
      deviceName: row.deviceName,
      browser: row.browser,
      os: row.os,
      ipAddress: row.ipAddress,
      lastActiveAt: new Date(row.lastActiveAt).toISOString(),
      createdAt: new Date(row.createdAt).toISOString(),
      isCurrent: row.tokenHash === currentTokenHash,
    }));
  }

  async removeDevice(
    userId: string,
    deviceId: string,
    currentTokenHash: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.db
      .select({ id: userDevice.id, tokenHash: userDevice.tokenHash })
      .from(userDevice)
      .where(and(
        eq(userDevice.userId, userId),
        eq(userDevice.id, deviceId),
      ))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('设备不存在');
    }
    if (existing[0].tokenHash === currentTokenHash) {
      throw new BadRequestException('不能下线当前设备');
    }

    await this.db
      .delete(userDevice)
      .where(and(
        eq(userDevice.userId, userId),
        eq(userDevice.id, deviceId),
      ));

    return { success: true };
  }

  async logoutOthers(
    userId: string,
    currentTokenHash: string,
  ): Promise<{ success: boolean; removedCount: number }> {
    const result = await this.db
      .delete(userDevice)
      .where(and(
        eq(userDevice.userId, userId),
        sql`${userDevice.tokenHash} != ${currentTokenHash}`,
      ))
      .returning({ id: userDevice.id });

    return { success: true, removedCount: result.length };
  }
}
