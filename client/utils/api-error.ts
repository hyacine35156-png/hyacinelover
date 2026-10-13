import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { classifyError, getErrorMeta, getHttpStatus } from './error';
import { safeGetItem } from './env';

export const AUTH_401_EVENT = 'app:auth:401';

let lastAuth401At = 0;
const AUTH_401_DEBOUNCE_MS = 3000;

const AUTH_401_WHITELIST_PATHS: RegExp[] = [
  /^\/api\/auth\/(login|register|me|logout)(\?.*)?$/,
];

const GUEST_FLAG_KEY = 'app_guest_mode';

function isGuestMode(): boolean {
  try {
    return safeGetItem(GUEST_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function normalizeUrl(url: string | undefined): string {
  if (!url) return '';
  let normalized = url;
  // 去除 baseURL 前缀（如 /spark/p/app_xxx 等）
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      const u = new URL(normalized);
      normalized = u.pathname + u.search;
    } catch {
      // ignore
    }
  }
  return normalized;
}

function shouldDispatch401(url: string | undefined): boolean {
  const normalized = normalizeUrl(url);
  if (!normalized) return true;
  // 去除查询参数后再匹配白名单
  const pathOnly = normalized.split('?')[0];
  for (const pattern of AUTH_401_WHITELIST_PATHS) {
    if (pattern.test(pathOnly)) {
      logger.info('[API] 401 白名单匹配成功，不派发事件', {
        originalUrl: url,
        normalized,
        pathOnly,
        pattern: pattern.source,
      });
      return false;
    }
  }
  return true;
}

function dispatchAuth401(fromPath: string): void {
  const now = Date.now();
  if (now - lastAuth401At < AUTH_401_DEBOUNCE_MS) {
    logger.warn('[API] 401 事件已在防抖窗口内，跳过重复派发', {
      last: lastAuth401At,
      now,
    });
    return;
  }
  lastAuth401At = now;
  try {
    const event = new CustomEvent(AUTH_401_EVENT, { detail: { from: fromPath } });
    window.dispatchEvent(event);
    logger.info('[API] 已派发 401 事件', { from: fromPath });
  } catch {
    logger.warn('[API] 派发 401 事件失败，降级为跳转');
  }
}

export interface ApiRetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  retryOnStatus?: number[];
}

const DEFAULT_RETRY_CONFIG: Required<ApiRetryConfig> = {
  maxRetries: 0,
  retryDelay: 1000,
  retryOnStatus: [502, 503, 504],
};

function shouldRetry(status: number | undefined, config: Required<ApiRetryConfig>): boolean {
  if (!status) return false;
  return config.retryOnStatus.includes(status);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withApiRetry<T>(
  fn: () => Promise<T>,
  options: ApiRetryConfig = {},
): Promise<T> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;
      const status = getHttpStatus(error);
      if (attempt < config.maxRetries && shouldRetry(status, config)) {
        const delay = config.retryDelay * (attempt + 1);
        logger.warn('[API] 请求失败，准备重试', {
          attempt: attempt + 1,
          status,
          delay,
        });
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

export function setupApiInterceptors(): void {
  const instance = axiosForBackend;

  instance.interceptors.request.use(
    (config) => {
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  instance.interceptors.response.use(
    (response) => {
      logger.debug('[API] 请求成功', {
        url: response.config?.url,
        method: response.config?.method,
        status: response.status,
      });
      return response;
    },
    (error) => {
      const info = classifyError(error);
      const status = getHttpStatus(error);
      const url = error.config?.url;
      const method = error.config?.method;

      logger.warn('[API] 请求失败', {
        url,
        method,
        status,
        category: info.category,
        message: info.message,
        hasAuthHeader: !!error.config?.headers?.['Authorization'],
      });

      if (status === 401 && shouldDispatch401(url)) {
        if (isGuestMode()) {
          logger.info('[API] 游客模式下收到 401，不派发登出事件', { url });
        } else {
          const currentPath = window.location.pathname;
          const hadAuth = !!(error.config?.headers?.['Authorization'] || error.config?.headers?.['authorization']);
          if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
            logger.warn('[API] 检测到 401，准备派发登出事件', {
              url,
              normalizedUrl: normalizeUrl(url),
              method,
              currentPath,
              hadAuthHeader: hadAuth,
            });
            dispatchAuth401(currentPath);
          } else {
            logger.info('[API] 401 但当前在登录/注册页，不派发事件', { currentPath });
          }
        }
      } else if (status === 401) {
        logger.info('[API] 401 请求在白名单内，不派发登出事件', { url, normalizedUrl: normalizeUrl(url) });
      }

      return Promise.reject(error);
    },
  );

  logger.info('[API] 全局拦截器已配置');
}

export function getFriendlyApiErrorMessage(error: unknown): string {
  const info = classifyError(error);
  const meta = getErrorMeta(info.category);

  if (info.category === 'validation' && info.message) {
    return info.message;
  }

  return meta.description;
}
