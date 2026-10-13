import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  SystemLogListRequest,
  SystemLogListResponse,
  SystemLogStatsResponse,
  SystemLogExportRequest,
} from '@shared/api.interface';

export async function getSystemLogs(
  params: SystemLogListRequest,
): Promise<SystemLogListResponse> {
  try {
    const res = await axiosForBackend.get('/api/admin/system-logs', {
      params: {
        page: params.page,
        pageSize: params.pageSize,
        logType: params.logType,
        logTypes: params.logTypes?.join(','),
        username: params.username,
        status: params.status,
        startDate: params.startDate,
        endDate: params.endDate,
        keyword: params.keyword,
      },
    });
    return res.data;
  } catch (error) {
    logger.error('获取系统日志失败', error);
    throw error;
  }
}

export async function getSystemLogStats(): Promise<SystemLogStatsResponse> {
  try {
    const res = await axiosForBackend.get('/api/admin/system-logs/stats');
    return res.data;
  } catch (error) {
    logger.error('获取系统日志统计失败', error);
    throw error;
  }
}

export async function exportSystemLogs(
  params: SystemLogExportRequest,
): Promise<void> {
  try {
    const res = await axiosForBackend.post(
      '/api/admin/system-logs/export',
      params,
      { responseType: 'blob' },
    );
    const blob = new Blob([res.data]);
    const disposition = res.headers['content-disposition'] as string | undefined;
    let filename = `system-log-${Date.now()}`;
    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/i);
      if (match) filename = decodeURIComponent(match[1]);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    logger.error('导出系统日志失败', error);
    throw error;
  }
}
