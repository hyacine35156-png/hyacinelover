import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  SubmitEditRequestRequest,
  SubmitEditRequestResponse,
  EditRequestItem,
  ReviewEditRequestRequest,
  ReviewEditRequestResponse,
  CollaboratorListResponse,
  RemoveCollaboratorResponse,
  BankVersionListResponse,
  BankVersionDetailResponse,
  RollbackVersionRequest,
  RollbackVersionResponse,
} from '@shared/api.interface';

export async function submitEditRequest(
  dto: SubmitEditRequestRequest,
): Promise<SubmitEditRequestResponse> {
  try {
    const res = await axiosForBackend.post(
      '/api/bank-collaboration/edit-requests',
      dto,
    );
    return res.data;
  } catch (error) {
    logger.error('提交编辑申请失败', error);
    throw error;
  }
}

export async function getReceivedEditRequests(params: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<{ items: EditRequestItem[]; total: number }> {
  try {
    const res = await axiosForBackend.get(
      '/api/bank-collaboration/edit-requests/received',
      { params },
    );
    return res.data;
  } catch (error) {
    logger.error('获取收到的编辑申请失败', error);
    throw error;
  }
}

export async function reviewEditRequest(
  requestId: string,
  dto: ReviewEditRequestRequest,
): Promise<ReviewEditRequestResponse> {
  try {
    const res = await axiosForBackend.post(
      `/api/bank-collaboration/edit-requests/${requestId}/review`,
      dto,
    );
    return res.data;
  } catch (error) {
    logger.error('审核编辑申请失败', error);
    throw error;
  }
}

export async function getCollaborators(
  bankId: string,
): Promise<CollaboratorListResponse> {
  try {
    const res = await axiosForBackend.get(
      `/api/bank-collaboration/${bankId}/collaborators`,
    );
    return res.data;
  } catch (error) {
    logger.error('获取协作者列表失败', error);
    throw error;
  }
}

export async function removeCollaborator(
  bankId: string,
  collaboratorId: string,
): Promise<RemoveCollaboratorResponse> {
  try {
    const res = await axiosForBackend.post(
      `/api/bank-collaboration/${bankId}/collaborators/${collaboratorId}/remove`,
    );
    return res.data;
  } catch (error) {
    logger.error('移除协作者失败', error);
    throw error;
  }
}

export async function getBankVersions(
  bankId: string,
  params?: { page?: number; pageSize?: number },
): Promise<BankVersionListResponse> {
  try {
    const res = await axiosForBackend.get(
      `/api/bank-collaboration/${bankId}/versions`,
      { params },
    );
    return res.data;
  } catch (error) {
    logger.error('获取版本历史失败', error);
    throw error;
  }
}

export async function getBankVersionDetail(
  versionId: string,
): Promise<BankVersionDetailResponse> {
  try {
    const res = await axiosForBackend.get(
      `/api/bank-collaboration/versions/${versionId}`,
    );
    return res.data;
  } catch (error) {
    logger.error('获取版本详情失败', error);
    throw error;
  }
}

export async function rollbackVersion(
  versionId: string,
): Promise<RollbackVersionResponse> {
  try {
    const res = await axiosForBackend.post(
      `/api/bank-collaboration/versions/${versionId}/rollback`,
    );
    return res.data;
  } catch (error) {
    logger.error('回退版本失败', error);
    throw error;
  }
}
