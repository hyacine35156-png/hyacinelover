import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  BankRatingListResponse,
  SubmitRatingRequest,
  SubmitRatingResponse,
  DeleteRatingResponse,
} from '@shared/api.interface';

export async function getBankRatings(
  bankId: string,
  params?: { page?: number; pageSize?: number },
): Promise<BankRatingListResponse> {
  try {
    const res = await axiosForBackend.get(`/api/bank-ratings/${bankId}`, {
      params,
    });
    return res.data;
  } catch (error) {
     logger.error('获取题集评分失败', error);
    throw error;
  }
}

export async function submitRating(
  dto: SubmitRatingRequest,
): Promise<SubmitRatingResponse> {
  try {
    const res = await axiosForBackend.post('/api/bank-ratings', dto);
    return res.data;
  } catch (error) {
    logger.error('提交评分失败', error);
    throw error;
  }
}

export async function deleteRating(
  bankId: string,
): Promise<DeleteRatingResponse> {
  try {
    const res = await axiosForBackend.delete(`/api/bank-ratings/${bankId}`);
    return res.data;
  } catch (error) {
    logger.error('删除评分失败', error);
    throw error;
  }
}
