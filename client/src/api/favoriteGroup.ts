import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  FavoriteGroupListResponse,
  FavoriteGroupItem,
  CreateFavoriteGroupRequest,
  UpdateFavoriteGroupRequest,
  MoveFavoriteQuestionRequest,
  QuestionWithFavoriteListResponse,
} from '@shared/api.interface';

const BASE_PATH = '/api/favorite-groups';

export async function getGroups(): Promise<FavoriteGroupListResponse> {
  try {
    const res = await axiosForBackend.get(BASE_PATH);
    return res.data;
  } catch (error) {
    logger.error('获取收藏分组列表失败', error);
    throw error;
  }
}

export async function createGroup(
  dto: CreateFavoriteGroupRequest,
): Promise<FavoriteGroupItem> {
  try {
    const res = await axiosForBackend.post(BASE_PATH, dto);
    return res.data;
  } catch (error) {
    logger.error('创建收藏分组失败', error);
    throw error;
  }
}

export async function updateGroup(
  id: string,
  dto: UpdateFavoriteGroupRequest,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.patch(`${BASE_PATH}/${id}`, dto);
    return res.data;
  } catch (error) {
    logger.error('更新收藏分组失败', error);
    throw error;
  }
}

export async function deleteGroup(id: string): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.delete(`${BASE_PATH}/${id}`);
    return res.data;
  } catch (error) {
    logger.error('删除收藏分组失败', error);
    throw error;
  }
}

export async function addQuestionsToGroup(
  groupId: string,
  questionIds: string[],
): Promise<{ success: boolean; addedCount: number }> {
  try {
    const res = await axiosForBackend.post(`${BASE_PATH}/${groupId}/items`, {
      questionIds,
    });
    return res.data;
  } catch (error) {
    logger.error('添加题目到分组失败', error);
    throw error;
  }
}

export async function removeQuestionFromGroup(
  groupId: string,
  questionId: string,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.delete(
      `${BASE_PATH}/${groupId}/items/${questionId}`,
    );
    return res.data;
  } catch (error) {
    logger.error('从分组移除题目失败', error);
    throw error;
  }
}

export async function moveQuestions(
  dto: MoveFavoriteQuestionRequest,
): Promise<{ success: boolean; movedCount: number }> {
  try {
    const res = await axiosForBackend.post(`${BASE_PATH}/move`, dto);
    return res.data;
  } catch (error) {
    logger.error('移动题目失败', error);
    throw error;
  }
}

export async function getGroupQuestions(
  groupId: string,
): Promise<QuestionWithFavoriteListResponse> {
  try {
    const res = await axiosForBackend.get(`${BASE_PATH}/${groupId}/questions`);
    return res.data;
  } catch (error) {
    logger.error('获取分组题目列表失败', error);
    throw error;
  }
}

export async function favoriteWithGroup(
  questionId: string,
  isFavorited: boolean,
  groupId?: string,
): Promise<{ success: boolean; isFavorited: boolean }> {
  try {
    // 先切换收藏状态
    const favRes = await axiosForBackend.post('/api/question-banks/favorite', {
      questionId,
      isFavorited,
    });
    // 如果收藏且指定了分组，同时加入分组
    if (isFavorited && groupId) {
      await axiosForBackend.post(`${BASE_PATH}/${groupId}/items`, {
        questionIds: [questionId],
      });
    }
    return favRes.data;
  } catch (error) {
    logger.error('收藏并分组失败', error);
    throw error;
  }
}
