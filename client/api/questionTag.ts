import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { guestTagApi } from '@client/src/utils/guest-tag-store';
import type {
  QuestionTagListResponse,
  QuestionTagItem,
  CreateQuestionTagRequest,
  UpdateQuestionTagRequest,
  SetQuestionTagsRequest,
  QuestionTagWithQuestionsResponse,
  GenerateRandomBankByTagsRequest,
  GenerateRandomBankResponse,
  GlobalSearchResponse,
} from '@shared/api.interface';

function isAuthError(error: unknown): boolean {
  try {
    const status = (error as { response?: { status?: number } })?.response?.status;
    return status === 401 || status === 403;
  } catch {
    return false;
  }
}

export async function listTags(): Promise<QuestionTagListResponse> {
  try {
    const res = await axiosForBackend.get('/api/question-tags');
    return res.data;
  } catch (error) {
    if (isAuthError(error)) {
      const tags = guestTagApi.listTags();
      return { items: tags };
    }
    logger.error('获取标签列表失败', error);
    throw error;
  }
}

export async function createTag(
  dto: CreateQuestionTagRequest,
): Promise<QuestionTagItem> {
  try {
    const res = await axiosForBackend.post('/api/question-tags', dto);
    return res.data;
  } catch (error) {
    if (isAuthError(error)) {
      return guestTagApi.createTag(dto);
    }
    logger.error('创建标签失败', error);
    throw error;
  }
}

export async function updateTag(
  id: string,
  dto: UpdateQuestionTagRequest,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.patch(`/api/question-tags/${id}`, dto);
    return res.data;
  } catch (error) {
    if (isAuthError(error)) {
      return guestTagApi.updateTag(id, dto);
    }
    logger.error('更新标签失败', error);
    throw error;
  }
}

export async function deleteTag(id: string): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.delete(`/api/question-tags/${id}`);
    return res.data;
  } catch (error) {
    if (isAuthError(error)) {
      return guestTagApi.deleteTag(id);
    }
    logger.error('删除标签失败', error);
    throw error;
  }
}

export async function getQuestionTags(
  questionId: string,
): Promise<{ items: QuestionTagItem[] }> {
  try {
    const res = await axiosForBackend.get(
      `/api/question-tags/question/${questionId}`,
    );
    return res.data;
  } catch (error) {
    if (isAuthError(error)) {
      const tags = guestTagApi.getQuestionTags(questionId);
      return { items: tags };
    }
    logger.error('获取题目标签失败', error);
    throw error;
  }
}

export async function setQuestionTags(
  questionId: string,
  tagIds: string[],
): Promise<{ success: boolean; tags: QuestionTagItem[] }> {
  try {
    const dto: SetQuestionTagsRequest = { tagIds };
    const res = await axiosForBackend.post(
      `/api/question-tags/question/${questionId}/tags`,
      dto,
    );
    return res.data;
  } catch (error) {
    if (isAuthError(error)) {
      return guestTagApi.setQuestionTags(questionId, tagIds);
    }
    logger.error('设置题目标签失败', error);
    throw error;
  }
}

export async function addTagToQuestion(
  questionId: string,
  tagId: string,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.post(
      `/api/question-tags/question/${questionId}/tags/${tagId}`,
    );
    return res.data;
  } catch (error) {
    if (isAuthError(error)) {
      return guestTagApi.addTagToQuestion(questionId, tagId);
    }
    logger.error('添加标签失败', error);
    throw error;
  }
}

export async function removeTagFromQuestion(
  questionId: string,
  tagId: string,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.delete(
      `/api/question-tags/question/${questionId}/tags/${tagId}`,
    );
    return res.data;
  } catch (error) {
    if (isAuthError(error)) {
      return guestTagApi.removeTagFromQuestion(questionId, tagId);
    }
    logger.error('移除标签失败', error);
    throw error;
  }
}

export async function getQuestionsByTag(
  tagId: string,
): Promise<QuestionTagWithQuestionsResponse> {
  try {
    const res = await axiosForBackend.get(
      `/api/question-tags/${tagId}/questions`,
    );
    return res.data;
  } catch (error) {
    logger.error('获取标签题目失败', error);
    throw error;
  }
}

export async function generateBankByTags(
  dto: GenerateRandomBankByTagsRequest,
): Promise<GenerateRandomBankResponse> {
  try {
    const res = await axiosForBackend.post(
      '/api/question-tags/generate-bank',
      dto,
    );
    return res.data;
  } catch (error) {
     logger.error('按标签生成题集失败', error);
    throw error;
  }
}

export async function globalSearch(
  keyword: string,
  limit = 50,
): Promise<GlobalSearchResponse> {
  try {
    const res = await axiosForBackend.get('/api/question-tags/search/global', {
      params: { keyword, limit },
    });
    return res.data;
  } catch (error) {
    logger.error('全局搜索失败', error);
    throw error;
  }
}
