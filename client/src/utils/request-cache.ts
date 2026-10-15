const cache = new Map<string, { data: unknown; timestamp: number }>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5分钟

export function getCached<T>(key: string): T | null {
  try {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > DEFAULT_TTL) {
      cache.delete(key);
      return null;
    }
    return entry.data as T;
  } catch {
    return null;
  }
}

export function setCache(key: string, data: unknown, ttl = DEFAULT_TTL): void {
  try {
    cache.set(key, { data, timestamp: Date.now() });
    // 防止内存无限增长
    if (cache.size > 200) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
  } catch {
    // 缓存写入失败不影响主流程
  }
}

export function invalidateCache(prefix: string): void {
  try {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) cache.delete(key);
    }
  } catch {
    // 失效操作失败不影响主流程
  }
}

export function clearCache(): void {
  try {
    cache.clear();
  } catch {
    // 清空失败不影响主流程
  }
}
