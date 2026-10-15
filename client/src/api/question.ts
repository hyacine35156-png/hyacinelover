import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  QuestionNoteResponse,
  SaveQuestionNoteRequest,
  QuestionDifficultyResponse,
  SetQuestionDifficultyRequest,
  SubmitFeedbackRequest,
  SubmitFeedbackResponse,
  RecordAnswerTimeRequest,
  RecordAnswerTimeResponse,
  UpdateQuestionFullRequest,
  UpdateQuestionResponse,
} from '@shared/api.interface';

export async function getNote(questionId: string): Promise<QuestionNoteResponse> {
  try {
    const res = await axiosForBackend.get(`/api/questions/${questionId}/note`);
    return res.data;
  } catch (error) {
    logger.error('获取题目笔记失败', error);
    throw error;
  }
}

export async function saveNote(
  questionId: string,
  dto: SaveQuestionNoteRequest,
): Promise<QuestionNoteResponse> {
  try {
    const res = await axiosForBackend.post(
      `/api/questions/${questionId}/note`,
      dto,
    );
    return res.data;
  } catch (error) {
    logger.error('保存题目笔记失败', error);
    throw error;
  }
}

export async function getDifficulty(
  questionId: string,
): Promise<QuestionDifficultyResponse> {
  try {
    const res = await axiosForBackend.get(
      `/api/questions/${questionId}/difficulty`,
    );
    return res.data;
  } catch (error) {
    logger.error('获取题目难度失败', error);
    throw error;
  }
}

export async function setDifficulty(
  questionId: string,
  dto: SetQuestionDifficultyRequest,
): Promise<QuestionDifficultyResponse> {
  try {
    const res = await axiosForBackend.post(
      `/api/questions/${questionId}/difficulty`,
      dto,
    );
    return res.data;
  } catch (error) {
    logger.error('设置题目难度失败', error);
    throw error;
  }
}

export async function submitFeedback(
  questionId: string,
  dto: SubmitFeedbackRequest,
): Promise<SubmitFeedbackResponse> {
  try {
    const res = await axiosForBackend.post(
      `/api/questions/${questionId}/feedback`,
      dto,
    );
    return res.data;
  } catch (error) {
    logger.error('提交题目反馈失败', error);
    throw error;
  }
}

export async function recordAnswerTime(
  questionId: string,
  dto: RecordAnswerTimeRequest,
): Promise<RecordAnswerTimeResponse> {
  try {
    const res = await axiosForBackend.post(
      `/api/questions/${questionId}/answer-time`,
      dto,
    );
    return res.data;
  } catch (error) {
    logger.error('记录作答时间失败', error);
    throw error;
  }
}

export async function updateQuestion(
  questionId: string,
  dto: UpdateQuestionFullRequest & { confirm?: boolean },
): Promise<UpdateQuestionResponse> {
  try {
    const res = await axiosForBackend.patch(
      `/api/questions/${questionId}`,
      dto,
    );
    return res.data;
  } catch (error) {
    logger.error('更新题目失败', error);
    throw error;
  }
}

export async function deleteQuestion(
  questionId: string,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.post(
      `/api/questions/${questionId}/delete`,
    );
    return res.data;
  } catch (error) {
    logger.error('删除题目失败', error);
    throw error;
  }
}
