/**
 * 离线管理 Hook - 管理题库下载、删除、下载状态
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import {
  getDownloadMetaList,
  saveBank,
  saveQuestions,
  saveDownloadMeta,
  deleteDownloadedBank,
  getTotalCacheSize,
  getPendingSyncCount,
  type DownloadMeta,
} from '@client/src/utils/offline-db';
import {
  getQuestions,
} from '@client/src/api/questionBank';
import type { QuestionBankItem, QuestionItem } from '@shared/api.interface';

/**
 * 计算对象粗略字节大小
 */
function estimateSize(obj: unknown): number {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return 0;
  }
}

interface UseOfflineManagerResult {
  downloadedBanks: DownloadMeta[];
  isDownloading: boolean;
  downloadProgress: number;
  currentDownloadBankId: string | null;
  pendingCount: number;
  cacheSize: number;
  downloadBank: (bankId: string, bankInfo: QuestionBankItem) => Promise<void>;
  deleteDownload: (bankId: string) => Promise<void>;
  isDownloaded: (bankId: string) => boolean;
  refreshDownloaded: () => Promise<void>;
  refreshCacheSize: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

export function useOfflineManager(): UseOfflineManagerResult {
  const [downloadedBanks, setDownloadedBanks] = useState<DownloadMeta[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentDownloadBankId, setCurrentDownloadBankId] = useState<string | null>(
    null,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [cacheSize, setCacheSize] = useState(0);
  const loadingRef = useRef(false);

  const refreshDownloaded = useCallback(async () => {
    try {
      const list = await getDownloadMetaList();
      setDownloadedBanks(list.sort((a, b) =>
        b.downloadedAt.localeCompare(a.downloadedAt),
      ));
    } catch (err) {
      logger.error('加载已下载列表失败', err);
    }
  }, []);

  const refreshCacheSize = useCallback(async () => {
    try {
      const size = await getTotalCacheSize();
      setCacheSize(size);
    } catch (err) {
      logger.error('计算缓存大小失败', err);
    }
  }, []);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingSyncCount();
      setPendingCount(count);
    } catch (err) {
      logger.error('获取待同步数量失败', err);
    }
  }, []);

  // 初始化
  useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    refreshDownloaded();
    refreshCacheSize();
    refreshPendingCount();
  }, [refreshDownloaded, refreshCacheSize, refreshPendingCount]);

  const isDownloaded = useCallback(
    (bankId: string): boolean => {
      return downloadedBanks.some((b) => b.bankId === bankId);
    },
    [downloadedBanks],
  );

  const downloadBank = useCallback(
    async (bankId: string, bankInfo: QuestionBankItem) => {
      if (isDownloading) return;

      setIsDownloading(true);
      setDownloadProgress(0);
      setCurrentDownloadBankId(bankId);

       const toastId = toast.loading('正在下载题集...', {
        description: '准备中',
      });

      try {
        // 1. 获取所有题目
        const questionsResponse = await getQuestions(bankId);
        const questions: QuestionItem[] = questionsResponse.items;
        setDownloadProgress(30);

        // 2. 存入 IndexedDB
        await saveBank(bankInfo);
        setDownloadProgress(50);

        await saveQuestions(bankId, questions);
        setDownloadProgress(80);

        // 3. 保存下载元信息
        const sizeBytes =
          estimateSize(bankInfo) +
          questions.reduce((sum: number, q: QuestionItem) => sum + estimateSize(q), 0);

        const meta: DownloadMeta = {
          bankId,
          bankName: bankInfo.name,
          downloadedAt: new Date().toISOString(),
          questionCount: questions.length,
          sizeBytes,
          description: bankInfo.description,
        };

        await saveDownloadMeta(meta);
        setDownloadProgress(100);

        // 刷新列表
        await refreshDownloaded();
        await refreshCacheSize();

        toast.success('下载完成', {
          id: toastId,
          description: `"${bankInfo.name}" 已缓存到本地`,
        });
      } catch (err) {
        logger.error('下载题集失败', err);
        toast.error('下载失败', {
          id: toastId,
          description: err instanceof Error ? err.message : '请检查网络后重试',
        });
        throw err;
      } finally {
        setIsDownloading(false);
        setCurrentDownloadBankId(null);
        // 延迟重置进度，让用户看到 100%
        setTimeout(() => setDownloadProgress(0), 500);
      }
    },
    [isDownloading, refreshDownloaded, refreshCacheSize],
  );

  const deleteDownload = useCallback(
    async (bankId: string) => {
      const bank = downloadedBanks.find((b) => b.bankId === bankId);
      const toastId = toast.loading('正在删除...');

      try {
        await deleteDownloadedBank(bankId);
        await refreshDownloaded();
        await refreshCacheSize();

        toast.success('已删除', {
          id: toastId,
          description: bank ? `"${bank.bankName}" 离线缓存已清除` : '离线缓存已清除',
        });
      } catch (err) {
        logger.error('删除下载失败', err);
        toast.error('删除失败', {
          id: toastId,
          description: err instanceof Error ? err.message : '请稍后重试',
        });
        throw err;
      }
    },
    [downloadedBanks, refreshDownloaded, refreshCacheSize],
  );

  return {
    downloadedBanks,
    isDownloading,
    downloadProgress,
    currentDownloadBankId,
    pendingCount,
    cacheSize,
    downloadBank,
    deleteDownload,
    isDownloaded,
    refreshDownloaded,
    refreshCacheSize,
    refreshPendingCount,
  };
}
