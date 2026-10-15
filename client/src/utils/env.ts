import { logger } from '@lark-apaas/client-toolkit/logger';

export const CLIENT_BASE_PATH: string = (() => {
  const envPath = (import.meta as unknown as { env?: Record<string, string> }).env
    ?.CLIENT_BASE_PATH;
  if (envPath && envPath !== '/') {
    return envPath.replace(/\/$/, '');
  }

  try {
    const pathname = window.location.pathname;
    const match = pathname.match(/^\/app\/[^/]+/);
    if (match) {
      return match[0];
    }
  } catch {
    // ignore
  }

  return '';
})();

export function resolvePath(path: string): string {
  if (!path || path === '/') return CLIENT_BASE_PATH || '/';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (CLIENT_BASE_PATH && path.startsWith(CLIENT_BASE_PATH + '/')) return path;
  if (CLIENT_BASE_PATH && path === CLIENT_BASE_PATH) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${CLIENT_BASE_PATH}${normalized}`;
}

export function navigateTo(path: string): void {
  window.location.assign(resolvePath(path));
}

type StorageKind = 'localStorage' | 'sessionStorage' | 'cookie' | 'memory';

let storageKind: StorageKind | null = null;

function testStorageAccess(storage: Storage): boolean {
  try {
    const testKey = '__storage_test__';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function getCookieSameSiteAttr(): string {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  return isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
}

function testCookieAccess(): boolean {
  try {
    const sameSite = getCookieSameSiteAttr();
    document.cookie = `__cookie_test__=1; path=/; ${sameSite}`;
    const ok = document.cookie.includes('__cookie_test__=1');
    document.cookie = `__cookie_test__=; path=/; ${sameSite}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    return ok;
  } catch {
    return false;
  }
}

export function resolveStorageKind(): StorageKind {
  if (storageKind !== null) return storageKind;
  if (typeof window === 'undefined') {
    storageKind = 'memory';
    return storageKind;
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  logger.info('[Storage] 开始检测可用存储方式', { userAgent: ua.substring(0, 120) });
  if (testStorageAccess(window.localStorage)) {
    storageKind = 'localStorage';
    logger.info('[Storage] 使用 localStorage');
    return storageKind;
  }
  logger.warn('[Storage] localStorage 不可用，尝试 sessionStorage');
  if (testStorageAccess(window.sessionStorage)) {
    storageKind = 'sessionStorage';
    logger.info('[Storage] 降级为 sessionStorage');
    return storageKind;
  }
  logger.warn('[Storage] sessionStorage 不可用，尝试 cookie');
  if (testCookieAccess()) {
    storageKind = 'cookie';
    logger.info('[Storage] 降级为 cookie 存储');
    return storageKind;
  }
  storageKind = 'memory';
  logger.warn('[Storage] cookie 不可用，降级为内存存储（页面刷新会丢失）');
  return storageKind;
}

export function isLocalStorageAvailable(): boolean {
  return resolveStorageKind() === 'localStorage';
}

const memoryStorage = new Map<string, string>();
const COOKIE_PREFIX = 'app_s_';

function readCookie(key: string): string | null {
  try {
    const name = COOKIE_PREFIX + encodeURIComponent(key) + '=';
    const cookies = document.cookie.split(';');
    for (const raw of cookies) {
      const c = raw.trim();
      if (c.indexOf(name) === 0) {
        return decodeURIComponent(c.substring(name.length));
      }
    }
    return null;
  } catch {
    return null;
  }
}

function writeCookie(key: string, value: string): void {
  const name = COOKIE_PREFIX + encodeURIComponent(key);
  const encoded = encodeURIComponent(value);
  const maxAge = 60 * 60 * 24 * 7;
  const sameSite = getCookieSameSiteAttr();
  document.cookie = `${name}=${encoded}; path=/; ${sameSite}; max-age=${maxAge}`;
}

function removeCookie(key: string): void {
  const name = COOKIE_PREFIX + encodeURIComponent(key);
  const sameSite = getCookieSameSiteAttr();
  document.cookie = `${name}=; path=/; ${sameSite}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function clearCookies(): void {
  try {
    const sameSite = getCookieSameSiteAttr();
    const cookies = document.cookie.split(';');
    for (const raw of cookies) {
      const name = raw.trim().split('=')[0];
      if (name && name.startsWith(COOKIE_PREFIX)) {
        document.cookie = `${name}=; path=/; ${sameSite}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    }
  } catch {
    // ignore
  }
}

function getStorage(): Storage | null {
  const kind = resolveStorageKind();
  if (kind === 'localStorage') return window.localStorage;
  if (kind === 'sessionStorage') return window.sessionStorage;
  return null;
}

export function safeGetItem(key: string): string | null {
  const kind = resolveStorageKind();
  if (kind === 'memory') return memoryStorage.get(key) ?? null;
  if (kind === 'cookie') return readCookie(key);
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return memoryStorage.get(key) ?? null;
  }
}

export function safeSetItem(key: string, value: string): void {
  const kind = resolveStorageKind();
  if (kind === 'memory') {
    memoryStorage.set(key, value);
    return;
  }
  if (kind === 'cookie') {
    writeCookie(key, value);
    return;
  }
  try {
    getStorage()?.setItem(key, value);
  } catch {
    memoryStorage.set(key, value);
  }
}

export function safeRemoveItem(key: string): void {
  const kind = resolveStorageKind();
  if (kind === 'memory') {
    memoryStorage.delete(key);
    return;
  }
  if (kind === 'cookie') {
    removeCookie(key);
    return;
  }
  try {
    getStorage()?.removeItem(key);
  } catch {
    memoryStorage.delete(key);
  }
}

export function safeClearStorage(): void {
  const kind = resolveStorageKind();
  if (kind === 'memory') {
    memoryStorage.clear();
    return;
  }
  if (kind === 'cookie') {
    clearCookies();
    return;
  }
  try {
    getStorage()?.clear();
  } catch {
    memoryStorage.clear();
  }
}
