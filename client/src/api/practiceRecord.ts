import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  PracticeRecordListResponse,
  CreatePracticeRecordRequest,
  CreatePracticeRecordResponse,
  PracticeStatisticsResponse,
  PracticeRecordDetailResponse,
  PracticeSessionProgressResponse,
  CreatePracticeSessionRequest,
  SaveAnswerProgressRequest,
  FinishPracticeSessionRequest,
  SaveBatchProgressRequest,
} from '@shared/api.interface';
import { getCached, setCache, invalidateCache } from '@client/src/utils/request-cache';

const CACHE_PREFIX = 'pr:';

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

export async function getRecords(page = 1, pageSize = 20): Promise<PracticeRecordListResponse> {
  const key = cacheKey('/api/practice-records', { page, pageSize });
  try {
    const cached = getCached<PracticeRecordListResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get('/api/practice-records', {
      params: { page, pageSize },
    });
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取练习记录失败', error);
    throw error;
  }
}

export async function submitRecord(
  dto: CreatePracticeRecordRequest,
): Promise<CreatePracticeRecordResponse> {
  try {
    const res = await axiosForBackend.post('/api/practice-records', dto);
    invalidateCache(`${CACHE_PREFIX}/api/practice-records`);
    invalidateCache(`${CACHE_PREFIX}/api/practice-records/statistics`);
    return res.data;
  } catch (error) {
    logger.error('提交练习记录失败', error);
    throw error;
  }
}

export async function getStatistics(): Promise<PracticeStatisticsResponse> {
  const key = cacheKey('/api/practice-records/statistics');
  try {
    const cached = getCached<PracticeStatisticsResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get('/api/practice-records/statistics');
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取统计数据失败', error);
    throw error;
  }
}

export async function getRecordDetail(id: string): Promise<PracticeRecordDetailResponse> {
  const key = cacheKey(`/api/practice-records/${id}`);
  try {
    const cached = getCached<PracticeRecordDetailResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get(`/api/practice-records/${id}`);
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取练习记录详情失败', error);
    throw error;
  }
}

export async function getActiveSession(
  bankId: string,
): Promise<PracticeSessionProgressResponse | null> {
  try {
    const res = await axiosForBackend.get(`/api/practice-records/active/${bankId}`);
    return res.data;
  } catch (error) {
    logger.error('获取进行中练习失败', error);
    throw error;
  }
}

export async function createSession(
  dto: CreatePracticeSessionRequest,
): Promise<PracticeSessionProgressResponse> {
  try {
    const res = await axiosForBackend.post('/api/practice-records/session', dto);
    return res.data;
  } catch (error) {
    logger.error('创建练习会话失败', error);
    throw error;
  }
}

export async function saveAnswerProgress(
  dto: SaveAnswerProgressRequest,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.put('/api/practice-records/answer', dto);
    return res.data;
  } catch (error) {
    logger.error('保存作答进度失败', error);
    throw error;
  }
}

export async function saveBatchProgress(
  dto: SaveBatchProgressRequest,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.put('/api/practice-records/batch', dto);
    return res.data;
  } catch (error) {
    logger.error('批量保存进度失败', error);
    throw error;
  }
}

export async function finishSession(
  dto: FinishPracticeSessionRequest,
): Promise<CreatePracticeRecordResponse> {
  try {
    const res = await axiosForBackend.put('/api/practice-records/finish', dto);
    invalidateCache(`${CACHE_PREFIX}/api/practice-records`);
    invalidateCache(`${CACHE_PREFIX}/api/practice-records/statistics`);
    return res.data;
  } catch (error) {
    logger.error('完成练习失败', error);
    throw error;
  }
}

export async function deleteRecord(id: string): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.delete(`/api/practice-records/${id}`);
    invalidateCache(`${CACHE_PREFIX}/api/practice-records`);
    invalidateCache(`${CACHE_PREFIX}/api/practice-records/statistics`);
    return res.data;
  } catch (error) {
    logger.error('删除练习记录失败', error);
    throw error;
  }
}

export async function clearBankRecords(bankId: string): Promise<{ success: boolean; deletedCount: number }> {
  try {
    const res = await axiosForBackend.delete(`/api/practice-records/bank/${bankId}`);
    invalidateCache(`${CACHE_PREFIX}/api/practice-records`);
    invalidateCache(`${CACHE_PREFIX}/api/practice-records/statistics`);
    return res.data;
  } catch (error) {
    logger.error('清除题集记录失败', error);
    throw error;
  }
}

export async function clearSubsequentAnswers(params: {
  recordId: string;
  questionIds: string[];
  currentIndex: number;
}): Promise<{ success: boolean; deletedCount: number }> {
  try {
    const res = await axiosForBackend.post(
      `/api/practice-records/${params.recordId}/clear-subsequent`,
      {
        questionIds: params.questionIds,
        currentIndex: params.currentIndex,
      },
    );
    invalidateCache(`${CACHE_PREFIX}/api/practice-records`);
    invalidateCache(`${CACHE_PREFIX}/api/practice-records/statistics`);
    return res.data;
  } catch (error) {
    logger.error('清除后续答题记录失败', error);
    throw error;
  }
}

export async function batchDeleteRecords(ids: string[]): Promise<{ success: boolean; deletedCount: number }> {
  try {
    const res = await axiosForBackend.delete('/api/practice-records/batch', { data: { ids } });
    invalidateCache(`${CACHE_PREFIX}/api/practice-records`);
    invalidateCache(`${CACHE_PREFIX}/api/practice-records/statistics`);
    return res.data;
  } catch (error) {
    logger.error('批量删除练习记录失败', error);
    throw error;
  }
}

export async function exportPracticeRecords(range: 'today' | 'week' | 'all', format: 'json' | 'csv' | 'excel', bankId?: string): Promise<void> {
  try {
    const res = await axiosForBackend.get('/api/practice-records/export', {
      params: { range, format, bankId },
      responseType: 'blob',
    });
    const disposition = res.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    let filename = `practice_records.${format}`;
    if (match) {
      try {
        filename = decodeURIComponent(match[1]);
      } catch {
        filename = match[1];
      }
    }
    const url = URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    let message = '导出失败';
    const err = error as { response?: { data?: Blob; status?: number } };
    if (err.response?.data instanceof Blob && err.response.data.type.includes('json')) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        if (json?.error?.message) {
          message = json.error.message;
        }
      } catch {
        // noop
      }
    }
    logger.error('导出刷题记录失败', error);
    const e = new Error(message) as Error & { originalError?: unknown };
    e.originalError = error;
    throw e;
  }
}
