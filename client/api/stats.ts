import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  LearningDashboardResponse,
  KnowledgeMasteryResponse,
  LearningGoalsItem,
  UpdateLearningGoalsRequest,
  CheckinCalendarResponse,
} from '@shared/api.interface';
import { getCached, setCache, invalidateCache } from '@client/src/utils/request-cache';

const CACHE_PREFIX = 'stats:';

function cacheKey(path: string, params?: Record<string, unknown>): string {
  const paramStr = params
    ? Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${String(v)}`)
        .sort()
        .join('&')
    : '';
  return `${CACHE_PREFIX}${path}${paramStr ? '?' + paramStr : ''}`;
}

export async function getDashboard(): Promise<LearningDashboardResponse> {
  const key = cacheKey('/api/stats/dashboard');
  try {
    const cached = getCached<LearningDashboardResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get('/api/stats/dashboard');
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取学习仪表盘数据失败', error);
    throw error;
  }
}

export async function getKnowledgeMastery(): Promise<KnowledgeMasteryResponse> {
  const key = cacheKey('/api/stats/knowledge');
  try {
    const cached = getCached<KnowledgeMasteryResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get('/api/stats/knowledge');
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取知识点掌握度失败', error);
    throw error;
  }
}

export async function getLearningGoals(): Promise<LearningGoalsItem> {
  const key = cacheKey('/api/stats/goals');
  try {
    const cached = getCached<LearningGoalsItem>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get('/api/stats/goals');
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取学习目标失败', error);
    throw error;
  }
}

export async function updateLearningGoals(
  dto: UpdateLearningGoalsRequest,
): Promise<LearningGoalsItem> {
  try {
    const res = await axiosForBackend.put('/api/stats/goals', dto);
    invalidateCache(cacheKey('/api/stats/goals'));
    return res.data;
  } catch (error) {
    logger.error('更新学习目标失败', error);
    throw error;
  }
}

export async function getCheckinCalendar(days = 30): Promise<CheckinCalendarResponse> {
  const key = cacheKey('/api/stats/checkin-calendar', { days });
  try {
    const cached = getCached<CheckinCalendarResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get('/api/stats/checkin-calendar', {
      params: { days },
    });
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取打卡日历失败', error);
    throw error;
  }
}
