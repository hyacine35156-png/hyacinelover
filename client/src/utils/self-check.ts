import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export interface SelfCheckItem {
  name: string;
  label: string;
  passed: boolean;
  message?: string;
  duration?: number;
}

export interface SelfCheckResult {
  allPassed: boolean;
  items: SelfCheckItem[];
  totalDuration: number;
}

const CHECKS: Array<{
  name: string;
  label: string;
  run: () => Promise<{ passed: boolean; message?: string }>;
}> = [
  {
    name: 'localStorage',
    label: '本地存储',
    run: async () => {
      try {
        const key = '__selfcheck_ls__';
        localStorage.setItem(key, '1');
        const val = localStorage.getItem(key);
        localStorage.removeItem(key);
        return { passed: val === '1', message: '本地存储正常' };
      } catch (e) {
        return { passed: false, message: '本地存储不可用，请检查浏览器隐私设置' };
      }
    },
  },
  {
    name: 'react',
    label: '核心依赖',
    run: async () => {
      try {
        const React = await import('react');
        return { passed: !!React, message: 'React 正常加载' };
      } catch (e) {
        return { passed: false, message: '核心依赖加载失败，请刷新页面' };
      }
    },
  },
  {
    name: 'api_health',
    label: 'API 连通性',
    run: async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const resp = await axiosForBackend.get('/api/health', {
          signal: controller.signal,
        }).catch(() => null);
        clearTimeout(timer);
        if (resp && resp.status >= 200 && resp.status < 500) {
          return { passed: true, message: '服务器连接正常' };
        }
        return { passed: false, message: '服务器响应异常' };
      } catch (e) {
        return { passed: false, message: '无法连接到服务器，请检查网络' };
      }
    },
  },
];

export async function runSelfCheck(): Promise<SelfCheckResult> {
  const start = Date.now();
  const items: SelfCheckItem[] = [];

  for (const check of CHECKS) {
    const itemStart = Date.now();
    try {
      const result = await check.run();
      items.push({
        name: check.name,
        label: check.label,
        passed: result.passed,
        message: result.message,
        duration: Date.now() - itemStart,
      });
    } catch (e) {
      items.push({
        name: check.name,
        label: check.label,
        passed: false,
        message: e instanceof Error ? e.message : '检查失败',
        duration: Date.now() - itemStart,
      });
    }
  }

  const totalDuration = Date.now() - start;
  const allPassed = items.every((it) => it.passed);

  logger.info('[SelfCheck] 启动自检完成', {
    allPassed,
    totalDuration,
    failedItems: items.filter((i) => !i.passed).map((i) => i.name),
  });

  return { allPassed, items, totalDuration };
}

export function isSafeMode(): boolean {
  try {
    return localStorage.getItem('__safe_mode__') === '1';
  } catch {
    return false;
  }
}

export function exitSafeMode(): void {
  try {
    localStorage.removeItem('__safe_mode__');
  } catch {
    // ignore
  }
}
