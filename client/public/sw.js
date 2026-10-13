/**
 * Hyacine 离线练习 Service Worker
 *
 * 策略：
 * - 静态资源：Cache-First
 * - HTML 文档：Network-First（保证版本更新即时生效）
 * - API 请求：完全不缓存（授权态接口禁止缓存，避免 401 缓存污染）
 */

const CACHE_NAME = 'hyacine-static-v2';
const STATIC_ASSETS = ['/'];

// 安装：预缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// 激活：清理旧缓存并立即接管
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// 请求拦截
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源 GET 请求
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API 请求：完全透传，不缓存（避免 401/授权态缓存污染）
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/api/')) {
    return;
  }

  // HTML 导航请求：Network-First，保证新版本立即生效
  if (
    request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html') ||
    !url.pathname.includes('.')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error())),
    );
    return;
  }

  // 静态资源：Cache-First，回退网络
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => cached || Response.error());
    }),
  );
});
