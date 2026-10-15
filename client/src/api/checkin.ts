import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  CheckinSettingItem,
  CheckinStatusResponse,
  UpdateCheckinSettingRequest,
  CheckinHistoryResponse,
  RecordAnswerRequest,
} from '@shared/api.interface';

interface RecordAnswerResponse {
  todayAnswered: number;
  todayCompleted: boolean;
}

export async function getStatus(): Promise<CheckinStatusResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/checkin/status',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取打卡状态失败', error);
    throw error;
  }
}

export async function getSetting(): Promise<CheckinSettingItem> {
  try {
    const response = await axiosForBackend({
      url: '/api/checkin/setting',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取打卡设置失败', error);
    throw error;
  }
}

export async function updateSetting(
  data: UpdateCheckinSettingRequest,
): Promise<CheckinSettingItem> {
  try {
    const response = await axiosForBackend({
      url: '/api/checkin/setting',
      method: 'PATCH',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新打卡设置失败', error);
    throw error;
  }
}

export async function recordAnswer(
  data: RecordAnswerRequest,
): Promise<RecordAnswerResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/checkin/record-answer',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('记录作答打卡失败', error);
    throw error;
  }
}

export async function getHistory(days = 30): Promise<CheckinHistoryResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/checkin/history',
      method: 'GET',
      params: { days },
    });
    return response.data;
  } catch (error) {
    logger.error('获取打卡历史失败', error);
    throw error;
  }
}
