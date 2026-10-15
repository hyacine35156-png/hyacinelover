import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
} from '@client/src/utils/env';
import type {
  AppUserItem,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  ChangePasswordRequest,
  ChangePasswordResponse,
  DeviceListResponse,
  LogoutDeviceResponse,
} from '@shared/api.interface';

const TOKEN_KEY = 'app_token';
const SAVED_ACCOUNTS_KEY = 'saved_accounts';
const DEVICE_ID_KEY = 'hyacine_device_id';

function generateUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as { randomUUID: () => string }).randomUUID();
    }
  } catch {
    // fallthrough
  }
  // fallback: random string
  return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getOrCreateDeviceId(): string {
  let deviceId = safeGetItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateUuid();
    try {
      safeSetItem(DEVICE_ID_KEY, deviceId);
    } catch {
      // ignore
    }
    logger.info('[Auth] 已生成新的设备 ID', {
      deviceIdPrefix: deviceId.substring(0, 8),
    });
  }
  return deviceId;
}

/**
 * 从 userAgent 解析浏览器和操作系统信息。
 */
function parseUserAgent(ua: string): { browser: string; os: string; deviceName: string } {
  let browser = 'Unknown';
  let os = 'Unknown';

  // Browser detection
  if (/Edg\//.test(ua)) {
    browser = 'Edge';
  } else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) {
    browser = 'Chrome';
  } else if (/Firefox\//.test(ua)) {
    browser = 'Firefox';
  } else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
    browser = 'Safari';
  }

  // OS detection
  if (/Windows NT 10/.test(ua)) {
    os = 'Windows';
  } else if (/Windows NT 6/.test(ua)) {
    os = 'Windows';
  } else if (/Mac OS X/.test(ua)) {
    os = 'macOS';
  } else if (/Android/.test(ua)) {
    os = 'Android';
  } else if (/iPhone|iPad|iOS/.test(ua)) {
    os = 'iOS';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  const deviceName = `${browser} - ${os}`;
  return { browser, os, deviceName };
}

export function getDeviceInfo(): { deviceId: string; browser: string; os: string; deviceName: string } {
  const deviceId = getOrCreateDeviceId();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const { browser, os, deviceName } = parseUserAgent(ua);
  return { deviceId, browser, os, deviceName };
}

const AUTH_401_SKIP_PATHS: RegExp[] = [
  /^\/api\/auth\/(login|register|me|logout)(\?.*)?$/,
  /^\/api\/client-perf($|\/)/,
  /^\/api\/client-errors$/,
  /^\/api\/error-report$/,
  /^\/api\/performance-report$/,
  /^\/api\/health(\?.*)?$/,
];

function shouldSkipAuthClear(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_401_SKIP_PATHS.some((re) => re.test(url));
}

function syncAuthHeaderToDefaults(token: string | null): void {
  try {
    const inst = axiosForBackend as unknown as {
      defaults: {
        headers?: Record<string, unknown>;
        common?: Record<string, unknown>;
      };
    };
    const defaults = inst.defaults;
    if (!defaults.headers) defaults.headers = {};
    if (!defaults.headers.common) defaults.headers.common = {};
    const common = defaults.headers.common as Record<string, unknown>;
    if (token) {
      common['Authorization'] = `Bearer ${token}`;
      logger.info('[Auth] 已将 token 同步到 axios 默认 headers', {
        tokenPrefix: token.substring(0, 8),
        method: 'defaults.headers.common.Authorization',
      });
    } else {
      delete common['Authorization'];
      logger.info('[Auth] 已从 axios 默认 headers 移除 Authorization');
    }
  } catch (err) {
    logger.error('[Auth] 同步默认 headers 失败', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface SavedAccount {
  username: string;
  token: string;
}

function getToken(): string | null {
  const token = safeGetItem(TOKEN_KEY);
  logger.info('[Auth] 读取 token', {
    key: TOKEN_KEY,
    hasToken: !!token,
    length: token?.length ?? 0,
    tokenPrefix: token ? token.substring(0, Math.min(8, token.length)) : '',
    storage: typeof window !== 'undefined' ? (window.localStorage ? 'local' : 'cookie/memory') : 'server',
  });
  return token;
}

function setToken(token: string): void {
  logger.info('[Auth] 准备保存 token', {
    key: TOKEN_KEY,
    length: token.length,
    tokenPrefix: token.substring(0, 8),
  });
  try {
    safeSetItem(TOKEN_KEY, token);
  } catch (err) {
    logger.error('[Auth] token 保存抛出异常', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  const verify = safeGetItem(TOKEN_KEY);
  if (!verify) {
    logger.error('[Auth] token 保存后回读为空，存储可能不可用');
  } else if (verify !== token) {
    logger.error('[Auth] token 保存后回读不一致', {
      expectedLen: token.length,
      actualLen: verify.length,
    });
  } else {
    logger.info('[Auth] token 保存成功并回读验证通过', {
      length: verify.length,
      tokenPrefix: verify.substring(0, 8),
    });
  }
  syncAuthHeaderToDefaults(token);
}

function clearToken(): void {
  logger.info('[Auth] 清除 token');
  safeRemoveItem(TOKEN_KEY);
  syncAuthHeaderToDefaults(null);
}

function getSavedAccounts(): SavedAccount[] {
  const raw = safeGetItem(SAVED_ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is SavedAccount =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SavedAccount).username === 'string' &&
        typeof (item as SavedAccount).token === 'string',
    );
  } catch {
    return [];
  }
}

function saveAccount(account: SavedAccount): void {
  const accounts = getSavedAccounts();
  const idx = accounts.findIndex(
    (a: SavedAccount): boolean => a.username === account.username,
  );
  if (idx >= 0) {
    accounts[idx] = account;
  } else {
    accounts.push(account);
  }
  safeSetItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function removeSavedAccount(username: string): void {
  const accounts = getSavedAccounts().filter(
    (a: SavedAccount): boolean => a.username !== username,
  );
  safeSetItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function clearSavedAccounts(): void {
  safeRemoveItem(SAVED_ACCOUNTS_KEY);
}

function setHeaderOnConfig(
  config: Record<string, unknown>,
  key: string,
  value: string,
): boolean {
  const headers = config.headers as Record<string, unknown> | undefined;

  if (headers && typeof (headers as unknown as { set?: (k: string, v: string) => void }).set === 'function') {
    try {
      (headers as unknown as { set: (k: string, v: string) => void }).set(key, value);
      return true;
    } catch (err) {
      logger.warn('[Auth] AxiosHeaders.set 调用失败，尝试属性赋值', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!headers) {
    config.headers = { [key]: value } as never;
    return true;
  }

  try {
    (headers as Record<string, string>)[key] = value;
    return true;
  } catch (err) {
    logger.error('[Auth] 设置 header 失败', {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

function readHeaderFromConfig(config: Record<string, unknown>, key: string): string | undefined {
  const headers = config.headers as Record<string, unknown> | undefined;
  if (!headers) return undefined;
  if (typeof (headers as unknown as { get?: (k: string) => string | undefined }).get === 'function') {
    try {
      return (headers as unknown as { get: (k: string) => string | undefined }).get(key);
    } catch {
      // ignore
    }
  }
  return (headers as Record<string, string | undefined>)[key];
}

function authHeaderTransformRequest(
  data: unknown,
  headers: Record<string, string> | undefined,
): unknown {
  const token = safeGetItem(TOKEN_KEY);
  if (token && headers) {
    const authValue = `Bearer ${token}`;
    const existing = headers['Authorization'] || headers['authorization'];
    if (!existing) {
      headers['Authorization'] = authValue;
      logger.info('[Auth][transformRequest] 兜底设置 Authorization 成功', {
        tokenPrefix: token.substring(0, 8),
      });
    } else {
      logger.info('[Auth][transformRequest] Authorization 已存在，跳过', {
        headerPrefix: existing.substring(0, 15),
      });
    }
  } else {
    logger.warn('[Auth][transformRequest] token 为空或 headers 不存在', {
      hasToken: !!token,
      hasHeaders: !!headers,
    });
  }
  return typeof data === 'string' ? data : data;
}

let authSetupDone = false;

export function ensureAuthRequestInterceptor(): void {
  if (authSetupDone) return;
  authSetupDone = true;

  const instance = axiosForBackend as unknown as {
    interceptors: {
      request: { use: (fulfilled: unknown, rejected: unknown) => number };
      response: { use: (fulfilled: unknown, rejected: unknown) => number };
    };
    defaults: Record<string, unknown>;
  };

  // 第一层：请求拦截器
  const reqId = instance.interceptors.request.use(
    (config: Record<string, unknown>) => {
      logger.info('[Auth][interceptor] 请求拦截器被调用', {
        url: config.url,
        method: config.method,
      });
       const token = getToken();
       if (token) {
         const ok = setHeaderOnConfig(config, 'Authorization', `Bearer ${token}`);
         const after = readHeaderFromConfig(config, 'Authorization');
         logger.info('[Auth][interceptor] 请求附加 Authorization 结果', {
           url: config.url,
           method: config.method,
           success: ok,
           hasHeaderAfter: !!after,
           headerPrefix: after ? after.substring(0, 15) : '',
         });
       } else {
         logger.warn('[Auth][interceptor] token 为空，请求未携带 Authorization', {
           url: config.url,
           method: config.method,
         });
       }

       // 统一添加 X-Device-Id 头
       try {
         const deviceId = getOrCreateDeviceId();
         setHeaderOnConfig(config, 'X-Device-Id', deviceId);
       } catch (err) {
         logger.warn('[Auth][interceptor] 设置 X-Device-Id 失败', {
           error: err instanceof Error ? err.message : String(err),
         });
       }

       return config;
    },
    (error: unknown) => Promise.reject(error),
  );
  logger.info('[Auth] 请求拦截器已注册', { id: reqId });

  // 第二层：transformRequest 兜底（确保最后一刻还能加上）
  const defaults = instance.defaults;
  const existingTransform = defaults.transformRequest;
  const fallbackTransform = authHeaderTransformRequest;

  if (Array.isArray(existingTransform)) {
    defaults.transformRequest = [...existingTransform, fallbackTransform];
  } else if (typeof existingTransform === 'function') {
    defaults.transformRequest = [existingTransform, fallbackTransform];
  } else {
    defaults.transformRequest = [fallbackTransform];
  }
  logger.info('[Auth] transformRequest 兜底已注册');

  // 响应拦截器：401 时清除 token（与 api-error.ts 的事件派发互不冲突）
  instance.interceptors.response.use(
    (response: unknown) => response,
    (error: Record<string, unknown>) => {
      const response = error.response as Record<string, unknown> | undefined;
      const status = response?.status as number | undefined;
      const errorConfig = error.config as Record<string, unknown> | undefined;
      if (status === 401 && !shouldSkipAuthClear(errorConfig?.url as string | undefined)) {
        const currentToken = safeGetItem(TOKEN_KEY);
        const reqHeaders = errorConfig?.headers as Record<string, unknown> | undefined;
        let hadAuthHeader = false;
        if (reqHeaders) {
          if (typeof (reqHeaders as unknown as { get?: (k: string) => boolean }).get === 'function') {
            try {
              hadAuthHeader = !!(reqHeaders as unknown as { get: (k: string) => string | undefined }).get('Authorization');
            } catch {
              // ignore
            }
          } else {
            hadAuthHeader = !!(reqHeaders as Record<string, string | undefined>)['Authorization'] ||
              !!(reqHeaders as Record<string, string | undefined>)['authorization'];
          }
        }
        logger.warn('[Auth] 收到 401 响应，清除本地 token', {
          url: errorConfig?.url,
          hadToken: !!currentToken,
          hadAuthHeader,
        });
        clearToken();
      }
      return Promise.reject(error);
    },
  );
  logger.info('[Auth] 响应拦截器已注册');
}

ensureAuthRequestInterceptor();

// 启动时立即把已有 token 同步到 axios 默认 headers（双保险，不依赖拦截器）
{
  const existingToken = safeGetItem(TOKEN_KEY);
  if (existingToken) {
    logger.info('[Auth] 启动时发现已有 token，同步到默认 headers', {
      tokenPrefix: existingToken.substring(0, 8),
    });
    syncAuthHeaderToDefaults(existingToken);
  } else {
    logger.info('[Auth] 启动时无已有 token，默认 headers 不设置 Authorization');
  }
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  try {
    const response = await axiosForBackend.post<AuthResponse>(
      '/api/auth/register',
      data,
    );
    return response.data;
  } catch (error) {
    logger.error('注册失败', error);
    throw error;
  }
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  try {
    const { deviceId, deviceName, browser, os } = getDeviceInfo();
    const payload: LoginRequest = {
      ...data,
      deviceId,
      deviceName,
      browser,
      os,
    };
    const response = await axiosForBackend.post<AuthResponse>(
      '/api/auth/login',
      payload,
    );
    return response.data;
  } catch (error) {
    logger.error('登录失败', error);
    throw error;
  }
}

export async function getMe(): Promise<AppUserItem> {
  try {
    const response = await axiosForBackend.get<AppUserItem>('/api/auth/me');
    return response.data;
  } catch (error) {
    logger.error('获取用户信息失败', error);
    throw error;
  }
}

export async function logout(): Promise<{ success: boolean }> {
  try {
    const response = await axiosForBackend.post<{ success: boolean }>(
      '/api/auth/logout',
    );
    return response.data;
  } catch (error) {
    logger.error('退出登录失败', error);
    throw error;
  }
}

export async function changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResponse> {
  try {
    const response = await axiosForBackend.post<ChangePasswordResponse>(
      '/api/auth/change-password',
      data,
    );
    return response.data;
  } catch (error) {
    logger.error('修改密码失败', error);
    throw error;
  }
}

export async function getDevices(): Promise<DeviceListResponse> {
  try {
    const response = await axiosForBackend.get<DeviceListResponse>('/api/auth/devices');
    return response.data;
  } catch (error) {
    logger.error('获取设备列表失败', error);
    throw error;
  }
}

export async function deleteDevice(deviceId: string): Promise<LogoutDeviceResponse> {
  try {
    const response = await axiosForBackend.delete<LogoutDeviceResponse>(
      `/api/auth/devices/${encodeURIComponent(deviceId)}`,
    );
    return response.data;
  } catch (error) {
    logger.error('下线设备失败', error);
    throw error;
  }
}

export async function logoutOtherDevices(): Promise<LogoutDeviceResponse> {
  try {
    const response = await axiosForBackend.post<LogoutDeviceResponse>(
      '/api/auth/devices/logout-others',
    );
    return response.data;
  } catch (error) {
    logger.error('下线其他设备失败', error);
    throw error;
  }
}

export const tokenStorage = {
  getToken,
  setToken,
  clearToken,
};

export const savedAccountsStorage = {
  getSavedAccounts,
  saveAccount,
  removeSavedAccount,
  clearSavedAccounts,
};
