import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  AdminOperationLogListRequest,
  AdminOperationLogListResponse,
} from '@shared/api.interface';

export async function getOperationLogs(
  params: AdminOperationLogListRequest,
): Promise<AdminOperationLogListResponse> {
  try {
    const res = await axiosForBackend.get('/api/admin/operation-logs', {
      params,
    });
    return res.data;
  } catch (error) {
    logger.error('获取操作日志失败', error);
    throw error;
  }
}
