import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  WrongReason,
  SetWrongReasonResponse,
  WrongBookStatsResponse,
  WrongBookFilterOptions,
  WrongBookExportRequest,
  QuestionWithFavorite,
} from '@shared/api.interface';

export interface WrongBookExportItem extends QuestionWithFavorite {
  wrongReason?: WrongReason | null;
  note?: string;
  userAnswer?: number[];
}

export interface WrongBookExportListResponse {
  items: WrongBookExportItem[];
}

export async function setWrongReason(
  questionId: string,
  reason: WrongReason,
): Promise<SetWrongReasonResponse> {
  try {
    const res = await axiosForBackend.post(
      `/api/wrong-book/${questionId}/reason`,
      { reason },
    );
    return res.data;
  } catch (error) {
    logger.error('标记错误原因失败', error);
    throw error;
  }
}

export async function getWrongBookStats(
  filter?: WrongBookFilterOptions,
): Promise<WrongBookStatsResponse> {
  try {
    const res = await axiosForBackend.get('/api/wrong-book/stats', {
      params: filter,
    });
    return res.data;
  } catch (error) {
    logger.error('获取错题统计失败', error);
    throw error;
  }
}

export async function getWrongBookExportList(
  params: WrongBookExportRequest,
): Promise<WrongBookExportListResponse> {
  try {
    const res = await axiosForBackend.get('/api/wrong-book/export', {
      params,
    });
    return res.data;
  } catch (error) {
    logger.error('获取导出错题列表失败', error);
    throw error;
  }
}
