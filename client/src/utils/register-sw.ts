import { logger } from '@lark-apaas/client-toolkit/logger';
import { resolvePath } from './env';

let registered = false;

/**
 * 注册 Service Worker
 * - 仅在支持 serviceWorker 的浏览器中注册
 * - 生产环境和开发环境都可注册（dev 下也能验证基础功能）
 */
export function registerServiceWorker(): void {
  if (registered) return;

  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) {
    logger.info('[PWA] 当前浏览器不支持 Service Worker');
    return;
  }

  // 避免在 file:// 等非 http 环境注册
  if (!window.isSecureContext && window.location.protocol !== 'http:') {
    logger.info('[PWA] 非安全上下文，跳过 SW 注册');
    return;
  }

  const swUrl = resolvePath('/sw.js');

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        registered = true;
        logger.info('[PWA] Service Worker 注册成功', {
          scope: registration.scope,
        });

        registration.addEventListener('updatefound', () => {
          logger.info('[PWA] 发现新的 Service Worker 版本');
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                logger.info('[PWA] 有新版本可用，刷新后生效');
              }
            });
          }
        });
      })
      .catch((error) => {
        logger.error('[PWA] Service Worker 注册失败', error);
      });
  });
}

/**
 * 动态注入 PWA manifest link 到 <head>
 * 使用 resolvePath 处理应用前缀问题
 */
export function installPwaManifest(): void {
  if (typeof document === 'undefined') return;

  // 避免重复注入
  if (document.querySelector('link[rel="manifest"]')) return;

  const manifestUrl = resolvePath('/manifest.json');

  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = manifestUrl;
  document.head.appendChild(link);

  // theme-color
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#8b5cf6';
    document.head.appendChild(meta);
  }

  // apple-touch-icon
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.href =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23a78bfa'/%3E%3Cstop offset='100%25' stop-color='%23f472b6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='192' height='192' rx='36' fill='url(%23g)'/%3E%3Cpath d='M60 54h72v12H60zm0 22h72v12H60zm0 22h54v12H60zm0 22h66v12H60z' fill='%23fff' opacity='0.95'/%3E%3C/svg%3E";
    document.head.appendChild(appleIcon);
  }

  logger.info('[PWA] Manifest 已注入', { manifestUrl });
}
