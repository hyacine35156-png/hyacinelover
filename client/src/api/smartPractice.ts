import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  SmartRecommendResponse,
  WrongBookStreakStateResponse,
  WrongBookStreakSubmitResponse,
} from '@shared/api.interface';

export async function getRecommend(
  limit = 20,
): Promise<SmartRecommendResponse> {
  try {
    const res = await axiosForBackend.get('/api/smart/recommend', {
      params: { limit },
    });
    return res.data;
  } catch (error) {
    logger.error('获取智能推荐失败', error);
    throw error;
  }
}

export async function getStreakState(
  questionId: string,
): Promise<WrongBookStreakStateResponse> {
  try {
    const res = await axiosForBackend.get(
      '/api/smart/wrongbook-streak/state',
      { params: { questionId } },
    );
    return res.data;
  } catch (error) {
    logger.error('获取 streak 状态失败', error);
    throw error;
  }
}

export async function submitStreak(
  questionId: string,
  isCorrect: boolean,
): Promise<WrongBookStreakSubmitResponse> {
  try {
    const res = await axiosForBackend.post(
      '/api/smart/wrongbook-streak/submit',
      { questionId, isCorrect },
    );
    return res.data;
  } catch (error) {
    logger.error('提交 streak 结果失败', error);
    throw error;
  }
}
