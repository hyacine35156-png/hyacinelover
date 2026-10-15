import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  AdminFeedbackStatsResponse,
  AdminFeedbackListRequest,
  AdminFeedbackListResponse,
  AdminFeedbackItem,
  AdminFeedbackStatusUpdateRequest,
  AdminFeedbackStatusUpdateResponse,
  MyFeedbackListRequest,
  MyFeedbackListResponse,
} from '@shared/api.interface';

export async function getFeedbackStats(): Promise<AdminFeedbackStatsResponse> {
  try {
    const res = await axiosForBackend.get('/api/admin/feedback/stats');
    return res.data;
  } catch (error) {
    logger.error('获取反馈统计失败', error);
    throw error;
  }
}

export async function getFeedbackList(
  params: AdminFeedbackListRequest,
): Promise<AdminFeedbackListResponse> {
  try {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
    if (params.source) query.set('source', params.source);
    if (params.status) query.set('status', params.status);
    if (params.keyword) query.set('keyword', params.keyword);
    if (params.sort) query.set('sort', params.sort);
    const res = await axiosForBackend.get(
      `/api/admin/feedback?${query.toString()}`,
    );
    return res.data;
  } catch (error) {
    logger.error('获取反馈列表失败', error);
    throw error;
  }
}

export async function getFeedbackDetail(id: string): Promise<AdminFeedbackItem> {
  try {
    const res = await axiosForBackend.get(`/api/admin/feedback/${id}`);
    return res.data;
  } catch (error) {
    logger.error('获取反馈详情失败', error);
    throw error;
  }
}

export async function updateFeedbackStatus(
  id: string,
  dto: AdminFeedbackStatusUpdateRequest,
): Promise<AdminFeedbackStatusUpdateResponse> {
  try {
    const res = await axiosForBackend.put(
      `/api/admin/feedback/${id}/status`,
      dto,
    );
    return res.data;
  } catch (error) {
    logger.error('更新反馈状态失败', error);
    throw error;
  }
}

export async function getMyFeedbackList(
  params: MyFeedbackListRequest,
): Promise<MyFeedbackListResponse> {
  try {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
    const res = await axiosForBackend.get(
      `/api/admin/feedback/my/list?${query.toString()}`,
    );
    return res.data;
  } catch (error) {
    logger.error('获取我的反馈列表失败', error);
    throw error;
  }
}
