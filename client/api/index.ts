import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export * as questionBankApi from './questionBank';
export * as questionTagApi from './questionTag';
export * as practiceRecordApi from './practiceRecord';
export * as subjectApi from './subject';
export * as auth from './auth';
export * as checkinApi from './checkin';
export * as questionApi from './question';
export * as statsApi from './stats';
export * as wrongbookApi from './wrongbook';
export * as userSettingsApi from './userSettings';
export * as favoriteGroupApi from './favoriteGroup';
export * as smartPracticeApi from './smartPractice';
export * as adminFeedbackApi from './adminFeedback';
export * as bankCollaborationApi from './bankCollaboration';
export * as bankRatingApi from './bankRating';
export * as adminOperationLogApi from './adminOperationLog';
export * as systemLogApi from './systemLog';

// Add more API functions here, use axios instance (`axiosForBackend`) to make requests.
//
// 使用示例：
// export async function getUserData(userId: string) {
//   try {
//     const response = await axiosForBackend({
//       url: `/api/users/${userId}`,
//       method: 'GET'
//     });
//     return response.data;
//   } catch (error) {
//     logger.error('获取用户数据失败', error);
//     throw error;
//   }
// }
