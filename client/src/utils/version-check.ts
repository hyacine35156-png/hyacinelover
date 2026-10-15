import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { safeGetItem, safeSetItem } from '@client/src/utils/env';
import { APP_VERSION } from './version';

const LAST_VERSION_CHECK_KEY = 'last_version_check';
const DISMISSED_VERSION_KEY = 'dismissed_version';
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30分钟

export interface VersionCheckResult {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
}

function parseVersion(v: string): number[] {
  const match = v.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function isVersionNewer(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  for (let i = 0; i < 3; i += 1) {
    if (l[i] > c[i]) return true;
    if (l[i] < c[i]) return false;
  }
  return false;
}

export async function checkAppVersion(force = false): Promise<VersionCheckResult> {
  const result: VersionCheckResult = {
    hasUpdate: false,
    latestVersion: APP_VERSION,
    currentVersion: APP_VERSION,
  };

  try {
    if (!force) {
      const lastCheck = safeGetItem(LAST_VERSION_CHECK_KEY) as string | null;
      if (lastCheck && Date.now() - Number(lastCheck) < CHECK_INTERVAL_MS) {
        return result;
      }
    }

    const res = await axiosForBackend.get('/api/health/version');
    const latestVersion = res.data?.version;
    if (!latestVersion) return result;

    result.latestVersion = latestVersion;
    safeSetItem(LAST_VERSION_CHECK_KEY, String(Date.now()));

    if (isVersionNewer(latestVersion, APP_VERSION)) {
      const dismissed = safeGetItem(DISMISSED_VERSION_KEY) as string | null;
      if (dismissed !== latestVersion) {
        result.hasUpdate = true;
      }
    }
  } catch (err) {
    logger.warn('[version] 版本检查失败', err);
  }

  return result;
}

export function dismissVersionUpdate(version: string): void {
  safeSetItem(DISMISSED_VERSION_KEY, version);
}

export function forceReloadForUpdate(): void {
  try {
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          caches.delete(key);
        });
      });
    }
  } catch (e) {
    logger.warn('[version] 清理缓存失败', e);
  }
  window.location.reload();
}
