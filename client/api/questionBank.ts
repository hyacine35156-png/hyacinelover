import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  QuestionBankListResponse,
  CreateQuestionBankRequest,
  CreateQuestionBankResponse,
  DeleteQuestionBankResponse,
  QuestionListResponse,
  CreateQuestionRequest,
  CreateQuestionResponse,
  ImportQuestionBankResponse,
  WordPreviewResponse,
  UpdateQuestionBankRequest,
  UpdateQuestionRequest,
  DeleteQuestionResponse,
  GenerateRandomBankRequest,
  GenerateRandomBankResponse,
  GenerateRandomBankByIdsRequest,
  UpdateFavoriteRequest,
  UpdateFavoriteResponse,
  QuestionWithFavoriteListResponse,
  CopyQuestionBankRequest,
  CopyQuestionBankResponse,
  QuestionWithFavorite,
  FavoriteExportRequest,
  QuestionCommentListResponse,
  CreateQuestionCommentRequest,
  CreateQuestionCommentResponse,
  BatchBankOperationRequest,
  BatchBankOperationResponse,
  BankShareInfo,
  BankSortBy,
  BatchDeleteQuestionsRequest,
  BatchDeleteQuestionsResponse,
  BatchReplaceRequest,
  BatchReplacePreviewResponse,
  BatchReplaceResponse,
} from '@shared/api.interface';
import { getCached, setCache, invalidateCache } from '@client/src/utils/request-cache';

export type BankVisibility = 'all' | 'private' | 'public' | 'zcmu';

const CACHE_PREFIX = 'qb:';

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

export async function getPublicBanks(params?: {
  subjectId?: string | null;
}): Promise<QuestionBankListResponse> {
  const query: Record<string, unknown> = {};
  if (params?.subjectId !== undefined && params.subjectId !== null) {
    query.subjectId = params.subjectId;
  }
  const key = cacheKey('/api/question-banks/public/list', query);
  try {
    const cached = getCached<QuestionBankListResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get('/api/question-banks/public/list', {
      params: Object.keys(query).length > 0 ? query : undefined,
    });
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取公开题集列表失败', error);
    throw error;
  }
}

export async function getPublicBankQuestions(
  bankId: string,
): Promise<QuestionListResponse> {
  const key = cacheKey(`/api/question-banks/public/${bankId}/questions`);
  try {
    const cached = getCached<QuestionListResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get(
      `/api/question-banks/public/${bankId}/questions`,
    );
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取公开题集题目失败', error);
    throw error;
  }
}

export async function getBanks(params?: {
  subjectId?: string | null;
  visibility?: BankVisibility;
  sortBy?: BankSortBy;
}): Promise<QuestionBankListResponse> {
  const query: Record<string, unknown> = {};
  if (params?.subjectId !== undefined && params.subjectId !== null) {
    query.subjectId = params.subjectId;
  }
  if (params?.visibility) {
    query.visibility = params.visibility;
  }
  if (params?.sortBy) {
    query.sortBy = params.sortBy;
  }
  const key = cacheKey('/api/question-banks', query);
  try {
    const cached = getCached<QuestionBankListResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get('/api/question-banks', {
      params: Object.keys(query).length > 0 ? query : undefined,
    });
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取题集列表失败', error);
    throw error;
  }
}

export async function createBank(dto: CreateQuestionBankRequest): Promise<CreateQuestionBankResponse> {
  try {
    const res = await axiosForBackend.post('/api/question-banks', dto);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks`);
    return res.data;
  } catch (error) {
    logger.error('创建题集失败', error);
    throw error;
  }
}

export async function deleteBank(id: string): Promise<DeleteQuestionBankResponse> {
  try {
    const res = await axiosForBackend.delete(`/api/question-banks/${id}`);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks`);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks/${id}`);
    return res.data;
  } catch (error) {
    logger.error('删除题集失败', error);
    throw error;
  }
}

export async function getQuestions(bankId: string): Promise<QuestionListResponse> {
  const key = cacheKey(`/api/question-banks/${bankId}/questions`);
  try {
    const cached = getCached<QuestionListResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get(`/api/question-banks/${bankId}/questions`);
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取题目列表失败', error);
    throw error;
  }
}

export async function addQuestion(
  bankId: string,
  dto: CreateQuestionRequest,
): Promise<CreateQuestionResponse> {
  try {
    const res = await axiosForBackend.post(`/api/question-banks/${bankId}/questions`, dto);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks/${bankId}/questions`);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks/${bankId}/questions/with-state`);
    return res.data;
  } catch (error) {
    logger.error('添加题目失败', error);
    throw error;
  }
}

export async function updateBank(
  bankId: string,
  dto: UpdateQuestionBankRequest,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.patch(`/api/question-banks/${bankId}`, dto);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks`);
    return res.data;
  } catch (error) {
    logger.error('更新题集失败', error);
    throw error;
  }
}

export async function updateQuestion(
  bankId: string,
  questionId: string,
  dto: UpdateQuestionRequest,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.patch(
      `/api/question-banks/${bankId}/questions/${questionId}`,
      dto,
    );
    invalidateCache(`${CACHE_PREFIX}/api/question-banks/${bankId}/questions`);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks/${bankId}/questions/with-state`);
    return res.data;
  } catch (error) {
    logger.error('更新题目失败', error);
    throw error;
  }
}

export async function deleteQuestion(
  bankId: string,
  questionId: string,
): Promise<DeleteQuestionResponse> {
  try {
    const res = await axiosForBackend.delete(
      `/api/question-banks/${bankId}/questions/${questionId}`,
    );
    invalidateCache(`${CACHE_PREFIX}/api/question-banks/${bankId}/questions`);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks/${bankId}/questions/with-state`);
    return res.data;
  } catch (error) {
    logger.error('删除题目失败', error);
    throw error;
  }
}

export async function importBank(
  name: string,
  file: File,
  onProgress?: (percent: number) => void,
  isPublic?: boolean,
): Promise<ImportQuestionBankResponse> {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('file', file);
  if (isPublic !== undefined) {
    formData.append('isPublic', String(isPublic));
  }

  try {
    const res = await axiosForBackend.post('/api/question-banks/import', formData, {
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          onProgress(percent);
        }
      },
    });
    invalidateCache(`${CACHE_PREFIX}/api/question-banks`);
    return res.data;
  } catch (error) {
    logger.error('导入题集失败', error);
    throw error;
  }
}

export async function previewWordImport(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<WordPreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await axiosForBackend.post('/api/question-banks/import/preview-word', formData, {
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          onProgress(percent);
        }
      },
    });
    return res.data;
  } catch (error) {
    logger.error('Word 预览解析失败', error);
    throw error;
  }
}

export async function generateRandomBank(
  dto: GenerateRandomBankRequest,
): Promise<GenerateRandomBankResponse> {
  try {
    const res = await axiosForBackend.post('/api/question-banks/random', dto);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks`);
    return res.data;
  } catch (error) {
    logger.error('生成随机题集失败', error);
    throw error;
  }
}

export async function generateRandomBankByIds(
  dto: GenerateRandomBankByIdsRequest,
): Promise<GenerateRandomBankResponse> {
  try {
    const res = await axiosForBackend.post('/api/question-banks/random-generate-by-ids', dto);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks`);
    return res.data;
  } catch (error) {
    logger.error('生成随机题集失败', error);
    throw error;
  }
}

export async function getQuestionsWithState(
  bankId: string,
): Promise<QuestionWithFavoriteListResponse> {
  const key = cacheKey(`/api/question-banks/${bankId}/questions/with-state`);
  try {
    const cached = getCached<QuestionWithFavoriteListResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get(`/api/question-banks/${bankId}/questions/with-state`);
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取带状态题目列表失败', error);
    throw error;
  }
}

export async function updateFavorite(
  dto: UpdateFavoriteRequest,
): Promise<UpdateFavoriteResponse> {
  try {
    const res = await axiosForBackend.post('/api/question-banks/favorite', dto);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks/favorite/list`);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks/wrongbook/list`);
    return res.data;
  } catch (error) {
    logger.error('更新收藏状态失败', error);
    throw error;
  }
}

export async function getFavoriteExportList(
  params?: { format?: string; answerMode?: string },
): Promise<{ items: QuestionWithFavorite[] }> {
  try {
    const res = await axiosForBackend.get('/api/question-banks/favorite/export', {
      params,
    });
    return res.data;
  } catch (error) {
    logger.error('获取收藏导出列表失败', error);
    throw error;
  }
}

export async function getFavoriteList(): Promise<QuestionWithFavoriteListResponse> {
  const key = cacheKey('/api/question-banks/favorite/list');
  try {
    const cached = getCached<QuestionWithFavoriteListResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get('/api/question-banks/favorite/list');
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取收藏列表失败', error);
    throw error;
  }
}

export async function getWrongBookList(): Promise<QuestionWithFavoriteListResponse> {
  const key = cacheKey('/api/question-banks/wrongbook/list');
  try {
    const cached = getCached<QuestionWithFavoriteListResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get('/api/question-banks/wrongbook/list');
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取错题本列表失败', error);
    throw error;
  }
}

export async function getImportantWrongBookList(): Promise<QuestionWithFavoriteListResponse> {
  const key = cacheKey('/api/question-banks/wrongbook/important-list');
  try {
    const cached = getCached<QuestionWithFavoriteListResponse>(key);
    if (cached) return cached;
  } catch {
    // 缓存读取失败，继续网络请求
  }
  try {
    const res = await axiosForBackend.get('/api/question-banks/wrongbook/important-list');
    try { setCache(key, res.data); } catch { /* 忽略 */ }
    return res.data;
  } catch (error) {
    logger.error('获取重点错题本列表失败', error);
    throw error;
  }
}

export async function markQuestionMastered(
  questionId: string,
  mastered: boolean,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.post(
      `/api/question-banks/0/questions/${questionId}/mastered`,
      { mastered },
    );
    invalidateCache(`${CACHE_PREFIX}/api/question-banks/wrongbook/list`);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks/wrongbook/important-list`);
    return res.data;
  } catch (error) {
    logger.error('标记题目掌握状态失败', error);
    throw error;
  }
}

export async function removeFromWrongBook(
  questionId: string,
): Promise<{ success: boolean; removed: boolean }> {
  try {
    const res = await axiosForBackend.post('/api/question-banks/wrongbook/remove', {
      questionId,
    });
    invalidateCache(`${CACHE_PREFIX}/api/question-banks/wrongbook/list`);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks/wrongbook/important-list`);
    return res.data;
  } catch (error) {
    logger.error('移出错题本失败', error);
    throw error;
  }
}

export async function copyBank(
  bankId: string,
  dto: CopyQuestionBankRequest,
): Promise<CopyQuestionBankResponse> {
  try {
    const res = await axiosForBackend.post(
      `/api/question-banks/${bankId}/copy`,
      dto,
    );
    invalidateCache(`${CACHE_PREFIX}/api/question-banks`);
    return res.data;
  } catch (error) {
    logger.error('复制题集失败', error);
    throw error;
  }
}

export async function getQuestionComments(
  questionId: string,
  limit = 10,
  cursor?: string,
): Promise<QuestionCommentListResponse> {
  try {
    const res = await axiosForBackend.get(
      `/api/questions/${questionId}/comments`,
      {
        params: { limit, cursor },
      },
    );
    return res.data;
  } catch (error) {
    logger.error('获取题目评论失败', error);
    throw error;
  }
}

export async function createQuestionComment(
  questionId: string,
  content: string,
): Promise<CreateQuestionCommentResponse> {
  try {
    const dto: CreateQuestionCommentRequest = { content };
    const res = await axiosForBackend.post(
      `/api/questions/${questionId}/comments`,
      dto,
    );
    return res.data;
  } catch (error) {
    logger.error('发表评论失败', error);
    throw error;
  }
}

export async function deleteQuestionComment(
  questionId: string,
  commentId: string,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.delete(
      `/api/questions/${questionId}/comments/${commentId}`,
    );
    return res.data;
  } catch (error) {
    logger.error('删除评论失败', error);
    throw error;
  }
}

export async function batchOperation(
  dto: BatchBankOperationRequest,
): Promise<BatchBankOperationResponse> {
  try {
    const res = await axiosForBackend.post('/api/question-banks/batch', dto);
    invalidateCache(`${CACHE_PREFIX}/api/question-banks`);
    return res.data;
  } catch (error) {
    logger.error('批量操作题集失败', error);
    throw error;
  }
}

export async function getShareInfo(bankId: string): Promise<BankShareInfo> {
  try {
    const res = await axiosForBackend.get(`/api/question-banks/${bankId}/share`);
    return res.data;
  } catch (error) {
    logger.error('获取分享信息失败', error);
    throw error;
  }
}

export async function batchDeleteQuestions(
  bankId: string,
  dto: BatchDeleteQuestionsRequest,
): Promise<BatchDeleteQuestionsResponse> {
  try {
    const res = await axiosForBackend.post(
      `/api/question-banks/${bankId}/questions/batch-delete`,
      dto,
    );
    return res.data;
  } catch (error) {
    logger.error('批量删除题目失败', error);
    throw error;
  }
}

export async function batchReplacePreview(
  bankId: string,
  dto: BatchReplaceRequest,
): Promise<BatchReplacePreviewResponse> {
  try {
    const res = await axiosForBackend.post(
      `/api/question-banks/${bankId}/questions/batch-replace/preview`,
      dto,
    );
    return res.data;
  } catch (error) {
    logger.error('批量替换预览失败', error);
    throw error;
  }
}

export async function batchReplace(
  bankId: string,
  dto: BatchReplaceRequest,
): Promise<BatchReplaceResponse> {
  try {
    const res = await axiosForBackend.post(
      `/api/question-banks/${bankId}/questions/batch-replace`,
      dto,
    );
    return res.data;
  } catch (error) {
    logger.error('批量替换执行失败', error);
    throw error;
  }
}
