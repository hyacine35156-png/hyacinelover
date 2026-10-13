import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';

import type {
  UserSettingsResponse,
  UpdateUserSettingsRequest,
  UserDeviceItem,
  SyncStateResponse,
} from '@shared/api.interface';

export async function getSettings(): Promise<UserSettingsResponse> {
  try {
    const response = await axiosForBackend.get<UserSettingsResponse>('/api/user-settings/');
    return response.data;
  } catch (error) {
    logger.error('[userSettingsApi] 获取用户设置失败', error);
    throw error;
  }
}

export async function updateSettings(
  patch: UpdateUserSettingsRequest,
): Promise<UserSettingsResponse> {
  try {
    const response = await axiosForBackend.patch<UserSettingsResponse>(
      '/api/user-settings/',
      patch,
    );
    return response.data;
  } catch (error) {
    logger.error('[userSettingsApi] 更新用户设置失败', error);
    throw error;
  }
}

// ==================== 设备管理 ====================

export async function getDevices(): Promise<UserDeviceItem[]> {
  try {
    const response = await axiosForBackend.get<{ items: UserDeviceItem[] }>(
      '/api/user-settings/devices',
    );
    return response.data.items;
  } catch (error) {
    logger.error('[userSettingsApi] 获取设备列表失败', error);
    throw error;
  }
}

export async function removeDevice(deviceId: string): Promise<void> {
  try {
    await axiosForBackend.delete(`/api/user-settings/devices/${encodeURIComponent(deviceId)}`);
  } catch (error) {
    logger.error('[userSettingsApi] 下线设备失败', error);
    throw error;
  }
}

export async function logoutOtherDevices(): Promise<void> {
  try {
    await axiosForBackend.post('/api/user-settings/devices/logout-others');
  } catch (error) {
    logger.error('[userSettingsApi] 下线其他设备失败', error);
    throw error;
  }
}

// ==================== 同步状态 ====================

export async function getSyncState(): Promise<SyncStateResponse> {
  try {
    const response = await axiosForBackend.get<SyncStateResponse>(
      '/api/user-settings/sync-state',
    );
    return response.data;
  } catch (error) {
    logger.error('[userSettingsApi] 获取同步状态失败', error);
    throw error;
  }
}

export async function pingSync(): Promise<void> {
  try {
    await axiosForBackend.post('/api/user-settings/sync-ping');
  } catch (error) {
    logger.error('[userSettingsApi] 心跳同步失败', error);
    throw error;
  }
}
