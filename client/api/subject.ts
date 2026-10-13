import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  SubjectListResponse,
  SubjectItem,
  CreateSubjectRequest,
  UpdateSubjectRequest,
  BatchMoveBanksRequest,
} from '@shared/api.interface';
import { getCached, setCache, invalidateCache } from '@client/src/utils/request-cache';

const CACHE_PREFIX = 'subj:';

export async function listSubjects(): Promise<SubjectListResponse> {
  const key = `${CACHE_PREFIX}/api/subjects`;
  try {
    const cached = getCached<SubjectListResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get('/api/subjects');
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取科目列表失败', error);
    throw error;
  }
}

export async function createSubject(
  dto: CreateSubjectRequest,
): Promise<SubjectItem> {
  try {
    const res = await axiosForBackend.post('/api/subjects', dto);
    invalidateCache(`${CACHE_PREFIX}/api/subjects`);
    return res.data;
  } catch (error) {
    logger.error('创建科目失败', error);
    throw error;
  }
}

export async function updateSubject(
  id: string,
  dto: UpdateSubjectRequest,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.patch(`/api/subjects/${id}`, dto);
    invalidateCache(`${CACHE_PREFIX}/api/subjects`);
    return res.data;
  } catch (error) {
    logger.error('更新科目失败', error);
    throw error;
  }
}

export async function deleteSubject(
  id: string,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.delete(`/api/subjects/${id}`);
    invalidateCache(`${CACHE_PREFIX}/api/subjects`);
    return res.data;
  } catch (error) {
    logger.error('删除科目失败', error);
    throw error;
  }
}

export async function batchMoveBanks(
  dto: BatchMoveBanksRequest,
): Promise<{ success: boolean; movedCount: number }> {
  try {
    const res = await axiosForBackend.post(
      '/api/subjects/batch-move-banks',
      dto,
    );
    invalidateCache(`${CACHE_PREFIX}/api/subjects`);
    invalidateCache('qb:/api/question-banks');
    return res.data;
  } catch (error) {
     logger.error('批量移动题集失败', error);
    throw error;
  }
}
