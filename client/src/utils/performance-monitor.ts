import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { resolvePath } from './env';
import type {
  PerformanceMetricItem,
  WebVitalsReportRequest,
  ApiPerfRecord,
} from '@shared/api.interface';

// ==================== 配置 ====================

const SLOW_REQUEST_THRESHOLD_MS = 3000;
const MAX_METRIC_BUFFER = 50;
const WEB_VITALS_REPORT_URL = resolvePath('/api/client-perf');
const API_PERF_REPORT_URL = resolvePath('/api/client-perf/api');
const API_PERF_BATCH_SIZE = 10;
const API_PERF_BATCH_INTERVAL_MS = 30 * 1000; // 30 秒

// ==================== 数据缓冲（诊断用，不用于上报） ====================

const metricsBuffer: PerformanceMetricItem[] = [];

function pushMetric(item: PerformanceMetricItem): void {
  metricsBuffer.push(item);
  if (metricsBuffer.length > MAX_METRIC_BUFFER) {
    metricsBuffer.shift();
  }
}

export function getPerformanceBuffer(): PerformanceMetricItem[] {
  return [...metricsBuffer];
}

// ==================== 上报工具 ====================

function sendBeacon(url: string, data: unknown): boolean {
  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function'
    ) {
      const blob = new Blob([JSON.stringify(data)], {
        type: 'application/json',
      });
      return navigator.sendBeacon(url, blob);
    }
  } catch {
    // ignore
  }
  return false;
}

function sendFetchKeepalive(url: string, data: unknown): void {
  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {
      // 静默失败，性能上报不影响主功能
    });
  } catch {
    // 静默失败
  }
}

function report(url: string, data: unknown): void {
  const beaconOk = sendBeacon(url, data);
  if (!beaconOk) {
    sendFetchKeepalive(url, data);
  }
}

// ==================== userId ====================

let userIdCache: string | undefined;

export function setPerformanceUserId(userId: string | undefined): void {
  userIdCache = userId;
}

import { APP_VERSION } from './version';

function getAppVersion(): string {
  return APP_VERSION;
}

function getCurrentPath(): string {
  return typeof window !== 'undefined'
    ? window.location.pathname + window.location.search
    : '';
}

function nowIso(): string {
  return new Date().toISOString();
}

// ==================== Web Vitals 采集 + 批量上报 ====================

let webVitalsData: {
  lcp?: number;
  fid?: number;
  cls?: number;
  ttfb?: number;
  domContentLoaded?: number;
  loadComplete?: number;
} = {};

let webVitalsReported = false;

function recordVital(
  name: string,
  value: number,
  extra?: Record<string, string | number | boolean>,
): void {
  const item: PerformanceMetricItem = {
    name,
    value: Math.round(value * 100) / 100,
    path: getCurrentPath(),
    timestamp: nowIso(),
    metricType: 'web-vital',
    extra,
  };
  pushMetric(item);

  // 更新结构化数据
  if (name === 'LCP') webVitalsData.lcp = Math.round(value);
  else if (name === 'FID') webVitalsData.fid = Math.round(value);
  else if (name === 'CLS') webVitalsData.cls = Math.round(value * 1000) / 1000;
  else if (name === 'INP') webVitalsData.fid = Math.round(value); // 用 INP 替代 FID

  logger.debug(`[WebVital] ${name} = ${item.value}ms`, { path: item.path });
}

function reportWebVitals(): void {
  if (webVitalsReported) return;
  webVitalsReported = true;

  const payload: WebVitalsReportRequest = {
    url: typeof window !== 'undefined' ? window.location.href : '',
    lcp: webVitalsData.lcp,
    fid: webVitalsData.fid,
    cls: webVitalsData.cls,
    ttfb: webVitalsData.ttfb,
    domContentLoaded: webVitalsData.domContentLoaded,
    loadComplete: webVitalsData.loadComplete,
    userAgent:
      typeof navigator !== 'undefined'
        ? navigator.userAgent.substring(0, 300)
        : '',
    timestamp: nowIso(),
    userId: userIdCache,
    appVersion: getAppVersion(),
  };

  report(WEB_VITALS_REPORT_URL, payload);
  logger.info('[Perf] Web Vitals 已上报', {
    lcp: payload.lcp,
    cls: payload.cls,
    fid: payload.fid,
    url: payload.url,
  });
}

function observeLCP(): void {
  if (
    typeof PerformanceObserver === 'undefined' ||
    !PerformanceObserver.supportedEntryTypes?.includes(
      'largest-contentful-paint',
    )
  ) {
    return;
  }
  try {
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const last = entries[entries.length - 1];
      if (last) {
        recordVital('LCP', last.startTime, {
          size: (last as PerformanceEntry & { size: number }).size ?? 0,
        });
      }
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });

    // 用户交互后停止观察并上报
    const stopObserver = (): void => {
      try {
        observer.takeRecords();
        observer.disconnect();
      } catch {
        // ignore
      }
    };
    window.addEventListener('click', stopObserver, { once: true });
    window.addEventListener('keydown', stopObserver, { once: true });
  } catch (err) {
    logger.debug('[Perf] LCP 观察失败', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function observeFID(): void {
  if (
    typeof PerformanceObserver === 'undefined' ||
    !PerformanceObserver.supportedEntryTypes?.includes('first-input')
  ) {
    return;
  }
  try {
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      for (const entry of entries) {
        const fi = entry as PerformanceEventTiming;
        recordVital('FID', fi.processingStart - fi.startTime, {
          inputType: fi.name,
        });
      }
    });
    observer.observe({ type: 'first-input', buffered: true });
  } catch (err) {
    logger.debug('[Perf] FID 观察失败', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function observeINP(): void {
  if (
    typeof PerformanceObserver === 'undefined' ||
    !PerformanceObserver.supportedEntryTypes?.includes('event')
  ) {
    return;
  }
  let maxDuration = 0;
  try {
    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const eventEntry = entry as PerformanceEventTiming & {
          interactionId?: number;
        };
        if (eventEntry.interactionId && eventEntry.interactionId > 0) {
          if (eventEntry.duration > maxDuration) {
            maxDuration = eventEntry.duration;
            recordVital('INP', maxDuration, {
              inputType: eventEntry.name,
            });
          }
        }
      }
    });
    observer.observe({ type: 'event', buffered: true, ...({ durationThreshold: 40 } as Record<string, unknown>) });
  } catch (err) {
    logger.debug('[Perf] INP 观察失败', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function observeCLS(): void {
  if (
    typeof PerformanceObserver === 'undefined' ||
    !PerformanceObserver.supportedEntryTypes?.includes('layout-shift')
  ) {
    return;
  }
  try {
    let clsValue = 0;
    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (!shift.hadRecentInput) {
          clsValue += shift.value;
        }
      }
      recordVital('CLS', clsValue, { clsScore: clsValue });
    });
    observer.observe({ type: 'layout-shift', buffered: true });
  } catch (err) {
    logger.debug('[Perf] CLS 观察失败', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ==================== 页面加载时间 ====================

function recordPageLoadMetrics(): void {
  try {
    const navEntries =
      performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

    if (navEntries) {
      const metrics: Array<{ name: string; value: number }> = [
        { name: 'navigationStart', value: navEntries.startTime },
        { name: 'domContentLoaded', value: navEntries.domContentLoadedEventEnd },
        { name: 'load', value: navEntries.loadEventEnd },
        { name: 'firstPaint', value: 0 },
      ];

      // 获取 first-paint
      const paintEntries = performance.getEntriesByType('paint');
      const fp = paintEntries.find(
        (e) => e.name === 'first-paint',
      ) as PerformancePaintTiming | undefined;
      if (fp) {
        metrics[3] = { name: 'firstPaint', value: fp.startTime };
      }

      const items: PerformanceMetricItem[] = metrics.map((m) => ({
        name: m.name,
        value: Math.round(m.value * 100) / 100,
        path: getCurrentPath(),
        timestamp: nowIso(),
        metricType: 'page-load',
      }));
      for (const item of items) pushMetric(item);

      webVitalsData.domContentLoaded = Math.round(navEntries.domContentLoadedEventEnd);
      webVitalsData.loadComplete = Math.round(navEntries.loadEventEnd);
      // TTFB: responseStart - requestStart
      webVitalsData.ttfb = Math.round(
        navEntries.responseStart - navEntries.requestStart,
      );

      logger.info('[Perf] 页面加载时间采集完成', {
        ttfb: webVitalsData.ttfb,
        domContentLoaded: webVitalsData.domContentLoaded,
        loadComplete: webVitalsData.loadComplete,
        path: getCurrentPath(),
      });
    }
  } catch (err) {
    logger.debug('[Perf] 页面加载时间采集失败', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ==================== API 响应时间（批量上报） ====================

let apiInterceptorSetup = false;
const apiPerfQueue: ApiPerfRecord[] = [];
let apiPerfTimer: number | null = null;

function flushApiPerfQueue(): void {
  if (apiPerfQueue.length === 0) return;
  const items = apiPerfQueue.splice(0);
  report(API_PERF_REPORT_URL, items);
  logger.debug('[Perf] API 性能批量上报', { count: items.length });
}

function enqueueApiPerf(record: ApiPerfRecord): void {
  apiPerfQueue.push(record);

  if (apiPerfQueue.length >= API_PERF_BATCH_SIZE) {
    flushApiPerfQueue();
    return;
  }

  if (apiPerfTimer === null) {
    apiPerfTimer = window.setTimeout(() => {
      apiPerfTimer = null;
      flushApiPerfQueue();
    }, API_PERF_BATCH_INTERVAL_MS);
  }
}

function setupApiPerformanceInterceptor(): void {
  if (apiInterceptorSetup) return;
  apiInterceptorSetup = true;

  const startTimeMap = new Map<string, number>();

  axiosForBackend.interceptors.request.use(
    (config) => {
      const key = `${config.method?.toUpperCase() ?? ''} ${config.url ?? ''}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      startTimeMap.set(key, performance.now());
      (config as unknown as Record<string, unknown>).__perfKey = key;
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  axiosForBackend.interceptors.response.use(
    (response) => {
      const key = (response.config as unknown as Record<string, unknown>).__perfKey as
        | string
        | undefined;
      const start = key ? startTimeMap.get(key) : undefined;
      if (start !== undefined) {
        const duration = Math.round(performance.now() - start);
        const url = response.config?.url ?? '';
        const status = response.status;
        const method = (response.config?.method ?? 'get').toUpperCase();

        const item: PerformanceMetricItem = {
          name: url,
          value: duration,
          path: getCurrentPath(),
          timestamp: nowIso(),
          metricType: 'api-request',
          extra: { status, method },
        };
        pushMetric(item);

        const record: ApiPerfRecord = {
          url,
          method,
          duration,
          status,
          timestamp: nowIso(),
          userId: userIdCache,
        };
        enqueueApiPerf(record);

        if (duration > SLOW_REQUEST_THRESHOLD_MS) {
          logger.warn('[Perf] 慢请求', {
            url,
            duration,
            status,
            method,
          });
        }
      }
      if (key) startTimeMap.delete(key);
      return response;
    },
    (error) => {
      const key = (error.config as unknown as Record<string, unknown> | undefined)
        ?.__perfKey as string | undefined;
      const start = key ? startTimeMap.get(key) : undefined;
      if (start !== undefined) {
        const duration = Math.round(performance.now() - start);
        const url = error.config?.url ?? '';
        const status = error.response?.status ?? 0;
        const method = (error.config?.method ?? 'get').toUpperCase();

        const item: PerformanceMetricItem = {
          name: url,
          value: duration,
          path: getCurrentPath(),
          timestamp: nowIso(),
          metricType: 'api-request',
          extra: { status, method, error: true },
        };
        pushMetric(item);

        const record: ApiPerfRecord = {
          url,
          method,
          duration,
          status,
          timestamp: nowIso(),
          userId: userIdCache,
        };
        enqueueApiPerf(record);

        if (duration > SLOW_REQUEST_THRESHOLD_MS) {
          logger.warn('[Perf] 慢请求（错误）', {
            url,
            duration,
            status,
          });
        }
      }
      if (key) startTimeMap.delete(key);
      return Promise.reject(error);
    },
  );

  logger.info('[Perf] API 性能监控拦截器已配置');
}

// ==================== 页面卸载上报 ====================

let unloadSetup = false;

function setupUnloadReport(): void {
  if (unloadSetup) return;
  unloadSetup = true;

  const handleFlush = (): void => {
    // 页面隐藏时上报 Web Vitals
    if (!webVitalsReported) {
      reportWebVitals();
    }
    // 刷新 API 性能队列
    if (apiPerfTimer !== null) {
      clearTimeout(apiPerfTimer);
      apiPerfTimer = null;
    }
    flushApiPerfQueue();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      handleFlush();
    }
  });

  window.addEventListener('beforeunload', handleFlush);

  // 页面加载完成后 3 秒内收集 Web Vitals 并批量上报
  const scheduleWebVitalsReport = (): void => {
    setTimeout(() => {
      reportWebVitals();
    }, 3000);
  };

  if (document.readyState === 'complete') {
    recordPageLoadMetrics();
    scheduleWebVitalsReport();
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => recordPageLoadMetrics(), 0);
      scheduleWebVitalsReport();
    });
  }

  logger.info('[Perf] 性能监控卸载上报已配置');
}

// ==================== 旧的 reportPerformance 兼容接口 ====================

export function reportPerformance(
  items: PerformanceMetricItem[],
): void {
  if (!items.length) return;
  for (const item of items) pushMetric(item);

  if (process.env.NODE_ENV !== 'production') {
    logger.info('[Perf] 性能指标', {
      name: items[0].name,
      value: items[0].value,
      path: items[0].path,
      count: items.length,
    });
  }
}

// ==================== 初始化 ====================

let initialized = false;

export function setupPerformanceMonitor(): void {
  if (initialized) return;
  initialized = true;

  // 异步初始化，不阻塞主流程
  setTimeout(() => {
    // Web Vitals
    observeLCP();
    observeCLS();
    // 优先 INP，没有 INP 支持再用 FID
    if (
      typeof PerformanceObserver !== 'undefined' &&
      PerformanceObserver.supportedEntryTypes?.includes('event')
    ) {
      observeINP();
    } else {
      observeFID();
    }

    // API 响应时间
    setupApiPerformanceInterceptor();

    // 页面加载 + 卸载上报
    setupUnloadReport();

    logger.info('[Perf] 性能监控已启动');
  }, 0);
}

export default {
  setupPerformanceMonitor,
  getPerformanceBuffer,
  reportPerformance,
  setPerformanceUserId,
};
