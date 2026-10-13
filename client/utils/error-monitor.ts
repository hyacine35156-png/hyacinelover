import { logger } from '@lark-apaas/client-toolkit/logger';
import { classifyError } from './error';
import { resolvePath } from './env';
import type {
  ErrorReportRequest,
  ErrorReportType,
} from '@shared/api.interface';

export type ErrorSource =
  | 'window.onerror'
  | 'unhandledrejection'
  | 'resource'
  | 'render'
  | 'api';

export interface ErrorRecord {
  source: ErrorSource;
  message: string;
  category: string;
  timestamp: number;
  details?: string;
}

const MAX_ERRORS = 50;
const errorBuffer: ErrorRecord[] = [];

export function getRecentErrors(): ErrorRecord[] {
  return [...errorBuffer];
}

export function getErrorBuffer(): ErrorRecord[] {
  return [...errorBuffer];
}

function pushRecord(record: ErrorRecord): void {
  errorBuffer.push(record);
  if (errorBuffer.length > MAX_ERRORS) {
    errorBuffer.shift();
  }
}

// ==================== 配置 ====================

import { APP_VERSION } from './version';

export const errorMonitorConfig = {
  sampleRate: 1.0,
  dedupeWindowMs: 60 * 1000, // 1 分钟去重窗口
  appVersion: APP_VERSION,
  maxStackLines: 10,
  maxQueueSize: 20, // 最多缓存 20 条批量上报
  batchIntervalMs: 2000, // 每 2 秒批量上报
  reportUrl: resolvePath('/api/client-errors'),
};

const DEDUPE_STORAGE_KEY = '__error_dedupe__';

// ==================== 环境信息 ====================

function getEnvironment(): string {
  const hostname =
    typeof window !== 'undefined' ? window.location.hostname : 'unknown';
  if (hostname.endsWith('feishuapp.com') || hostname.endsWith('feishu.cn')) {
    return 'production';
  }
  if (hostname.endsWith('aiforce.run')) {
    return 'preview';
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }
  return 'unknown';
}

function getAppVersion(): string {
  return errorMonitorConfig.appVersion;
}

// ==================== 错误指纹与去重 ====================

function getErrorFingerprint(
  message: string,
  filename?: string,
  lineno?: number,
): string {
  const base = `${message.substring(0, 200)}::${filename ?? ''}::${lineno ?? 0}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    const chr = base.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return `err_${hash.toString(36)}`;
}

function loadDedupeMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DEDUPE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function saveDedupeMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(DEDUPE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function isDuplicate(fingerprint: string): boolean {
  const now = Date.now();
  const map = loadDedupeMap();
  const lastReported = map[fingerprint];
  if (lastReported && now - lastReported < errorMonitorConfig.dedupeWindowMs) {
    return true;
  }
  map[fingerprint] = now;
  // 清理过期条目
  for (const key of Object.keys(map)) {
    if (now - map[key] > errorMonitorConfig.dedupeWindowMs * 2) {
      delete map[key];
    }
  }
  saveDedupeMap(map);
  return false;
}

// ==================== 采样 ====================

function shouldSample(): boolean {
  if (errorMonitorConfig.sampleRate >= 1) return true;
  if (errorMonitorConfig.sampleRate <= 0) return false;
  return Math.random() < errorMonitorConfig.sampleRate;
}

// ==================== 上报（批量队列 + sendBeacon） ====================

let userIdCache: string | undefined;

export function setErrorMonitorUserId(userId: string | undefined): void {
  userIdCache = userId;
}

// 批量上报队列
const reportQueue: ErrorReportRequest[] = [];
let batchTimer: number | null = null;

function flushReportQueue(): void {
  if (reportQueue.length === 0) return;
  const items = reportQueue.splice(0, errorMonitorConfig.maxQueueSize);
  sendBatchReport(items);
}

function sendBatchReport(items: ErrorReportRequest[]): void {
  if (items.length === 0) return;
  const url = errorMonitorConfig.reportUrl;
  const payload = JSON.stringify(items);

  // 优先使用 sendBeacon
  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function'
    ) {
      const blob = new Blob([payload], {
        type: 'application/json',
      });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) {
        logger.debug('[ErrorMonitor] 批量上报成功 (sendBeacon)', {
          count: items.length,
        });
        return;
      }
    }
  } catch {
    // ignore
  }

  // 回退到 fetch + keepalive
  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      credentials: 'include',
    }).catch(() => {
      // 上报失败静默处理，不影响用户体验
    });
  } catch {
    // ignore
  }
}

function enqueueReport(payload: ErrorReportRequest): void {
  reportQueue.push(payload);

  // 达到队列上限立即上报
  if (reportQueue.length >= errorMonitorConfig.maxQueueSize) {
    flushReportQueue();
    return;
  }

  // 启动定时器批量上报
  if (batchTimer === null) {
    batchTimer = window.setTimeout(() => {
      batchTimer = null;
      flushReportQueue();
    }, errorMonitorConfig.batchIntervalMs);
  }
}

export function reportError(
  params: {
    message: string;
    stack?: string;
    type: ErrorReportType;
    userFeedback?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
  },
  options: { force?: boolean } = {},
): boolean {
  if (!options.force && !shouldSample()) {
    logger.debug('[ErrorMonitor] 采样跳过', { message: params.message });
    return false;
  }

  const fingerprint = getErrorFingerprint(
    params.message,
    params.filename,
    params.lineno,
  );
  if (!options.force && !params.userFeedback && isDuplicate(fingerprint)) {
    logger.debug('[ErrorMonitor] 去重跳过', {
      fingerprint,
      message: params.message.substring(0, 100),
    });
    return false;
  }

  const payload: ErrorReportRequest = {
    message: params.message.substring(0, 500),
    stack: params.stack?.substring(0, 2000),
    type: params.type,
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent:
      typeof navigator !== 'undefined'
        ? navigator.userAgent.substring(0, 300)
        : '',
    timestamp: new Date().toISOString(),
    userId: userIdCache,
    appVersion: getAppVersion(),
    environment: getEnvironment(),
    userFeedback: params.userFeedback?.substring(0, 1000),
    filename: params.filename,
    lineno: params.lineno,
    colno: params.colno,
    resourceUrl:
      params.type === 'resource' ? params.stack?.split('\n')[1]?.replace('Src: ', '') : undefined,
    resourceType:
      params.type === 'resource' ? params.stack?.split('\n')[0]?.replace('Tag: ', '') : undefined,
  };

  enqueueReport(payload);
  return true;
}

// 页面隐藏/卸载时立即刷新队列
function setupFlushOnUnload(): void {
  const flush = (): void => {
    if (batchTimer !== null) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }
    flushReportQueue();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush();
    }
  });

  window.addEventListener('beforeunload', flush);
}

// ==================== 错误处理函数 ====================

function handleWindowError(event: ErrorEvent): void {
  const info = classifyError(event.error ?? event.message);
  const stack =
    event.error instanceof Error ? event.error.stack : undefined;
  const record: ErrorRecord = {
    source: 'window.onerror',
    message: info.message,
    category: info.category,
    timestamp: Date.now(),
    details: stack,
  };
  pushRecord(record);
  logger.error('[GlobalError] JS运行时错误', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack,
  });
  reportError({
    message: info.message,
    stack,
    type: 'js',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const reason = event.reason;
  const info = classifyError(reason);
  const stack =
    reason instanceof Error
      ? reason.stack
      : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason);
  const record: ErrorRecord = {
    source: 'unhandledrejection',
    message: info.message,
    category: info.category,
    timestamp: Date.now(),
    details: stack,
  };
  pushRecord(record);
  logger.error('[GlobalError] 未处理的Promise错误', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  reportError({
    message: info.message,
    stack,
    type: 'promise',
  });
}

function handleResourceError(event: Event): void {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const tagName = target.tagName?.toLowerCase() ?? 'unknown';
  const src =
    (target as HTMLImageElement).src ??
    (target as HTMLLinkElement).href ??
    'unknown';

  const record: ErrorRecord = {
    source: 'resource',
    message: `资源加载失败: ${tagName} - ${src}`,
    category: 'network',
    timestamp: Date.now(),
    details: src,
  };
  pushRecord(record);
  logger.warn('[GlobalError] 资源加载失败', { tag: tagName, src });
  reportError({
    message: `资源加载失败: ${tagName}`,
    stack: `Tag: ${tagName}\nSrc: ${src}\nURL: ${window.location.href}`,
    type: 'resource',
  });
}

// ==================== React 错误边界上报 ====================

export function reportReactError(
  error: Error,
  errorInfo?: { componentStack?: string },
): void {
  const record: ErrorRecord = {
    source: 'render',
    message: error.message,
    category: 'runtime',
    timestamp: Date.now(),
    details: errorInfo?.componentStack ?? error.stack,
  };
  pushRecord(record);

  let combinedStack = error.stack ?? '';
  if (errorInfo?.componentStack) {
    combinedStack = `${combinedStack}\n--- Component Stack ---\n${errorInfo.componentStack}`;
  }

  reportError({
    message: error.message,
    stack: combinedStack,
    type: 'react',
  });
}

// ==================== 初始化 ====================

let initialized = false;

export function setupGlobalErrorListeners(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener(
    'error',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        typeof target.tagName === 'string' &&
        (target.tagName === 'IMG' ||
          target.tagName === 'LINK' ||
          target.tagName === 'SCRIPT' ||
          target.tagName === 'VIDEO' ||
          target.tagName === 'AUDIO')
      ) {
        handleResourceError(e);
        return;
      }
      handleWindowError(e as ErrorEvent);
    },
    true, // 捕获阶段，抓资源加载错误
  );

  window.addEventListener('unhandledrejection', (e) => {
    handleUnhandledRejection(e);
  });

  // 页面隐藏/卸载时刷新上报队列
  setupFlushOnUnload();

  logger.info('[GlobalError] 全局错误监听已启动', {
    sampleRate: errorMonitorConfig.sampleRate,
    dedupeWindowMs: errorMonitorConfig.dedupeWindowMs,
    reportUrl: errorMonitorConfig.reportUrl,
  });
}
