import { useState, useEffect, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { questionBankApi } from '@client/src/api';
import type { QuestionBankItem } from '@shared/api.interface';
import {
  getDownloadedBanks,
  saveBank,
  saveQuestions,
  saveDownloadMeta,
  deleteBank as deleteDownloadedBank,
} from '@client/src/utils/offline-db';

interface UseBankDownloadResult {
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  isOffline: boolean;
  handleDownload: () => void;
  handleDeleteDownload: () => void;
}

/**
 * 单张题库卡片的下载逻辑 hook
 */
export function useBankDownload(bank: QuestionBankItem): UseBankDownloadResult {
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isOffline, setIsOffline] = useState(false);

  // 检查是否已下载 + 监听网络状态
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const list = await getDownloadedBanks();
        if (!cancelled) {
          setDownloaded(list.some((b) => b.id === bank.id));
        }
      } catch {
        // IndexedDB 不可用时忽略
      }
    };
    void check();

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    if (typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [bank.id]);

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    setProgress(0);

     const toastId = toast.loading('正在下载题集...', {
      description: bank.name,
    });

    try {
      const res = await questionBankApi.getQuestions(bank.id);
      const questions = res.items;
      setProgress(40);

      await saveBank(bank);
      setProgress(60);

      await saveQuestions(bank.id, questions);
      setProgress(85);

      const sizeBytes =
        new Blob([JSON.stringify(bank)]).size +
        questions.reduce(
          (sum, q) => sum + new Blob([JSON.stringify(q)]).size,
          0,
        );
      await saveDownloadMeta({
        bankId: bank.id,
        bankName: bank.name,
        downloadedAt: new Date().toISOString(),
        questionCount: questions.length,
        sizeBytes,
        description: bank.description,
      });
      setProgress(100);

      setDownloaded(true);
      toast.success('下载完成', {
        id: toastId,
        description: `"${bank.name}" 已缓存到本地`,
      });
    } catch (err) {
       logger.error('下载题集失败', err);
      toast.error('下载失败', {
        id: toastId,
        description: err instanceof Error ? err.message : '请检查网络后重试',
      });
    } finally {
      setDownloading(false);
      setTimeout(() => setProgress(0), 500);
    }
  }, [bank, downloading]);

  const handleDeleteDownload = useCallback(async () => {
    try {
      await deleteDownloadedBank(bank.id);
      setDownloaded(false);
      toast.success('已删除离线缓存', {
        description: bank.name,
      });
    } catch (err) {
      logger.error('删除离线缓存失败', err);
      toast.error('删除失败');
    }
  }, [bank.id, bank.name]);

  return {
    downloaded,
    downloading,
    progress,
    isOffline,
    handleDownload,
    handleDeleteDownload,
  };
}
