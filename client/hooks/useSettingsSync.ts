import { useEffect, useRef, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { userSettingsApi } from '@client/src/api';
import { safeSetItem, safeGetItem } from '@client/src/utils/env';
import { useAuth } from '@client/src/contexts/AuthContext';

import type { UserSettingsResponse, UpdateUserSettingsRequest } from '@shared/api.interface';

// localStorage keys (与各 Context 保持一致)
const THEME_KEY = 'hyacine_theme';
const FONT_SIZE_KEY = 'hyacine_font_size';
const QUESTION_FONT_SIZE_KEY = 'hyacine_question_font_size';
const VOICE_RATE_KEY = 'hyacine_voice_rate';
const VOICE_SCOPE_KEY = 'hyacine_voice_scope';
const VOICE_AUTO_READ_KEY = 'hyacine_voice_auto_read';
const SYNC_AUTO_KEY = 'hyacine_sync_auto_sync';
const AUTO_DOWNLOAD_KEY = 'hyacine_auto_download_update';
const WALLPAPER_TYPE_KEY = 'hyacine_wallpaper_type';
const WALLPAPER_URL_KEY = 'hyacine_wallpaper_url';
const WALLPAPER_OPACITY_KEY = 'hyacine_wallpaper_opacity';
const WALLPAPER_SIZE_KEY = 'hyacine_wallpaper_size';
const USER_WALLPAPERS_KEY = 'hyacine_user_wallpapers';
const WALLPAPER_SHOW_IN_PRACTICE_KEY = 'hyacine_wallpaper_show_in_practice';

// 内部使用：本地记录的 updatedAt，用于冲突比较
const LOCAL_UPDATED_AT_KEY = 'hyacine_settings_local_updated_at';

const POLL_INTERVAL_MS = 30 * 1000; // 30 秒轮询
const PUSH_DEBOUNCE_MS = 500; // 本地设置变更后 500ms 防抖再推送

/**
 * 将后端设置应用到本地 localStorage 和 DOM。
 * 仅在后端更新时间比本地新时才覆盖。
 */
function applySettingsFromServer(remote: UserSettingsResponse): boolean {
  const localUpdatedAt = safeGetItem(LOCAL_UPDATED_AT_KEY);
  if (localUpdatedAt && new Date(remote.updatedAt) <= new Date(localUpdatedAt)) {
    logger.debug('[SettingsSync] 后端设置不比本地新，跳过覆盖', {
      remoteUpdatedAt: remote.updatedAt,
      localUpdatedAt,
    });
    return false;
  }

  // 主题
  safeSetItem(THEME_KEY, remote.theme);
  // 字号
  safeSetItem(FONT_SIZE_KEY, remote.fontSize);
  safeSetItem(QUESTION_FONT_SIZE_KEY, remote.questionFontSize);
  // 壁纸
  safeSetItem(WALLPAPER_TYPE_KEY, remote.wallpaperType);
  if (remote.wallpaperUrl) {
    safeSetItem(WALLPAPER_URL_KEY, remote.wallpaperUrl);
  }
  safeSetItem(WALLPAPER_OPACITY_KEY, String(remote.wallpaperOpacity));
  safeSetItem(WALLPAPER_SIZE_KEY, remote.wallpaperSize);
  safeSetItem(USER_WALLPAPERS_KEY, JSON.stringify(remote.userWallpapers ?? []));
  // 刷题页显示壁纸
  safeSetItem(WALLPAPER_SHOW_IN_PRACTICE_KEY, remote.wallpaperShowInPractice ? '1' : '0');
  // 语音
  safeSetItem(VOICE_RATE_KEY, String(remote.voiceRate));
  safeSetItem(VOICE_SCOPE_KEY, remote.voiceScope);
  safeSetItem(VOICE_AUTO_READ_KEY, remote.autoReadAnalysis ? '1' : '0');
  // 同步
  safeSetItem(SYNC_AUTO_KEY, remote.autoSync ? '1' : '0');
  // 离线下载
  safeSetItem(AUTO_DOWNLOAD_KEY, remote.autoDownload ? '1' : '0');
  // 本地更新时间
  safeSetItem(LOCAL_UPDATED_AT_KEY, remote.updatedAt);

  // 触发自定义事件，通知 ThemeContext / FontSizeContext 等重新读取
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('settings:synced', { detail: remote }));
    // 兼容：手动触发 storage 事件（跨标签页）
    window.dispatchEvent(new StorageEvent('storage', {
      key: THEME_KEY,
      newValue: remote.theme,
    }));
  }

  logger.info('[SettingsSync] 已应用后端设置', {
    updatedAt: remote.updatedAt,
    theme: remote.theme,
  });

  return true;
}

/**
 * 从本地收集当前所有设置，构造请求对象
 */
function collectLocalSettings(): UpdateUserSettingsRequest {
  const patch: UpdateUserSettingsRequest = {};

  const theme = safeGetItem(THEME_KEY);
  if (theme) patch.theme = theme;

  const fontSize = safeGetItem(FONT_SIZE_KEY);
  if (fontSize) patch.fontSize = fontSize;

  const questionFontSize = safeGetItem(QUESTION_FONT_SIZE_KEY);
  if (questionFontSize) patch.questionFontSize = questionFontSize;

  const voiceRate = safeGetItem(VOICE_RATE_KEY);
  if (voiceRate) patch.voiceRate = Number(voiceRate);

  const voiceScope = safeGetItem(VOICE_SCOPE_KEY);
  if (voiceScope) patch.voiceScope = voiceScope;

  const autoRead = safeGetItem(VOICE_AUTO_READ_KEY);
  patch.autoReadAnalysis = autoRead === '1';

  const autoSync = safeGetItem(SYNC_AUTO_KEY);
  patch.autoSync = autoSync !== '0';

  const autoDownload = safeGetItem(AUTO_DOWNLOAD_KEY);
  patch.autoDownload = autoDownload === '1';

  const wallpaperType = safeGetItem(WALLPAPER_TYPE_KEY);
  if (wallpaperType) patch.wallpaperType = wallpaperType;

  const wallpaperUrl = safeGetItem(WALLPAPER_URL_KEY);
  if (wallpaperUrl) patch.wallpaperUrl = wallpaperUrl;

  const wallpaperOpacity = safeGetItem(WALLPAPER_OPACITY_KEY);
  if (wallpaperOpacity) patch.wallpaperOpacity = Number(wallpaperOpacity);

  const wallpaperSize = safeGetItem(WALLPAPER_SIZE_KEY);
  if (wallpaperSize) patch.wallpaperSize = wallpaperSize;

  const userWallpapersStr = safeGetItem(USER_WALLPAPERS_KEY);
  if (userWallpapersStr) {
    try {
      const parsed = JSON.parse(userWallpapersStr);
      if (Array.isArray(parsed)) patch.userWallpapers = parsed;
    } catch {
      // ignore
    }
  }

  const showInPractice = safeGetItem(WALLPAPER_SHOW_IN_PRACTICE_KEY);
  patch.wallpaperShowInPractice = showInPractice === '1';

  return patch;
}

interface UseSettingsSyncReturn {
  /** 立即推送本地设置到后端（失败不抛出） */
  pushSettings: () => Promise<void>;
  /** 立即从后端拉取设置（失败不抛出） */
  pullSettings: () => Promise<void>;
}

/**
 * useSettingsSync - 用户设置同步 hook
 *
 * 行为：
 * 1. 用户登录后，从后端拉取设置，如后端更新则覆盖本地
 * 2. 本地设置变更时，调用 pushSettings() 异步同步到后端
 * 3. 每 30 秒轮询后端设置，若 updatedAt 更新则覆盖本地
 * 4. 同步是渐进增强：网络失败不影响本地使用
 */
export function useSettingsSync(): UseSettingsSyncReturn {
  const { isAuthenticated, isGuest } = useAuth();
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPullTimeRef = useRef<number>(0);

  const pullSettings = useCallback(async () => {
    if (!isAuthenticated || isGuest) return;

    try {
      const remote = await userSettingsApi.getSettings();
      applySettingsFromServer(remote);
      lastPullTimeRef.current = Date.now();
    } catch (err) {
      logger.warn('[SettingsSync] 拉取设置失败，跳过', err instanceof Error ? err.message : String(err));
    }
  }, [isAuthenticated, isGuest]);

  const pushSettings = useCallback(async () => {
    if (!isAuthenticated || isGuest) return;

    const patch = collectLocalSettings();
    try {
      const remote = await userSettingsApi.updateSettings(patch);
      // 更新本地 updatedAt，避免轮询时把刚推上去的又"拉回来"
      safeSetItem(LOCAL_UPDATED_AT_KEY, remote.updatedAt);
      logger.info('[SettingsSync] 本地设置已推送成功', {
        updatedAt: remote.updatedAt,
      });
    } catch (err) {
      logger.warn('[SettingsSync] 推送设置失败，不影响本地', err instanceof Error ? err.message : String(err));
    }
  }, [isAuthenticated, isGuest]);

  // 登录后首次拉取
  useEffect(() => {
    if (!isAuthenticated || isGuest) return;

    let cancelled = false;

    const initPull = async (): Promise<void> => {
      try {
        const remote = await userSettingsApi.getSettings();
        if (!cancelled) {
          applySettingsFromServer(remote);
          lastPullTimeRef.current = Date.now();
        }
      } catch (err) {
        logger.warn('[SettingsSync] 初始拉取失败', err instanceof Error ? err.message : String(err));
      }
    };

    void initPull();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isGuest]);

  // 轮询：每 30 秒检查后端设置是否更新
  useEffect(() => {
    if (!isAuthenticated || isGuest) return;

    pollTimerRef.current = setInterval(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      void pullSettings();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isAuthenticated, isGuest, pullSettings]);

  // 监听本地设置变更事件，防抖后异步推送到后端
  useEffect(() => {
    if (!isAuthenticated || isGuest) return;

    let pushTimer: ReturnType<typeof setTimeout> | null = null;

    const handleChanged = (): void => {
      // 更新本地 updatedAt，避免轮询时把刚修改的又"拉回来"
      safeSetItem(LOCAL_UPDATED_AT_KEY, new Date().toISOString());

      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => {
        void pushSettings();
      }, PUSH_DEBOUNCE_MS);
    };

    window.addEventListener('settings:changed', handleChanged);
    return () => {
      window.removeEventListener('settings:changed', handleChanged);
      if (pushTimer) clearTimeout(pushTimer);
    };
  }, [isAuthenticated, isGuest, pushSettings]);

  return { pushSettings, pullSettings };
}

export default useSettingsSync;

/**
 * SettingsSyncManager - 挂载在 App 根部的设置同步管理器组件
 *
 * 负责：
 * 1. 用户登录后首次从后端拉取设置并覆盖本地
 * 2. 每 30 秒轮询后端，若 updatedAt 更新则同步到本地
 * 3. 设置修改通过各组件调用 pushSettings 主动推送
 */
export function SettingsSyncManager(): null {
  useSettingsSync();
  return null;
}
