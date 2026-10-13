import { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CloudOff,
  Download,
  Trash2,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { SettingRow } from './SettingSection';
import { Switch } from '@client/src/components/ui/switch';
import { Button } from '@client/src/components/ui/button';
import { Progress } from '@client/src/components/ui/progress';
import { Badge } from '@client/src/components/ui/badge';
import { questionBankApi } from '@client/src/api';
import {
  openDB,
  getDownloadedBanks,
  deleteBank,
  getStorageSize,
  formatBytes,
  clearAllOfflineData,
  saveBank,
  saveQuestions,
  saveDownloadMeta,
} from '@client/src/utils/offline-db';
import { getSyncStatus, syncOfflineRecords } from '@client/src/utils/sync-manager';
import { safeGetItem, safeSetItem } from '@client/src/utils/env';
import type { QuestionBankItem } from '@shared/api.interface';

const AUTO_DOWNLOAD_KEY = 'hyacine_auto_download_update';

const OfflineSection = () => {
  const [banks, setBanks] = useState<QuestionBankItem[]>([]);
  const [downloadedBanks, setDownloadedBanks] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageSize, setStorageSize] = useState(0);
  const [syncInfo, setSyncInfo] = useState<{
    pending: number;
    lastSyncTime?: string;
  }>({ pending: 0 });
  const [autoDownload, setAutoDownload] = useState<boolean>(
    () => safeGetItem(AUTO_DOWNLOAD_KEY) === '1',
  );
  const [syncing, setSyncing] = useState(false);

  // 下载进度
  const [downloadingBankId, setDownloadingBankId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [bankListCollapsed, setBankListCollapsed] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await openDB();
      const [bankList, downloaded, size, status] = await Promise.all([
        questionBankApi
          .getBanks()
          .then((res) => res.items)
          .catch(() => [] as QuestionBankItem[]),
        getDownloadedBanks(),
        getStorageSize(),
        getSyncStatus(),
      ]);
      setBanks(bankList);
      setDownloadedBanks(downloaded);
      setStorageSize(size);
      setSyncInfo(status);
    } catch (err) {
      logger.error('[OfflineSection] 加载数据失败', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const downloadedIds = new Set(downloadedBanks.map((b) => b.id));

  const handleDownload = async (bank: QuestionBankItem): Promise<void> => {
    if (downloadingBankId) return;
    setDownloadingBankId(bank.id);
    setDownloadProgress(0);
    try {
      // 1. 获取题目
      const res = await questionBankApi.getQuestions(bank.id);
      const questions = res.items;
      setDownloadProgress(50);

      // 2. 保存到 IndexedDB
      await saveBank(bank);
      setDownloadProgress(70);

      await saveQuestions(bank.id, questions);
      setDownloadProgress(90);

      // 3. 保存下载元信息
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
      setDownloadProgress(100);

      toast.success(`「${bank.name}」下载完成`);
      void loadData();
    } catch (err) {
      logger.error('[OfflineSection] 下载失败', err);
      toast.error('下载失败，请稍后重试');
    } finally {
      setDownloadingBankId(null);
      // 延迟重置进度
      setTimeout(() => setDownloadProgress(0), 500);
    }
  };

  const handleDeleteBank = async (bank: QuestionBankItem): Promise<void> => {
    try {
      await deleteBank(bank.id);
      toast.success(`已删除「${bank.name}」`);
      void loadData();
    } catch (err) {
      logger.error('[OfflineSection] 删除失败', err);
      toast.error('删除失败');
    }
  };

  const handleClearAll = async (): Promise<void> => {
    try {
      await clearAllOfflineData();
      toast.success('已清理所有离线缓存');
      void loadData();
    } catch (err) {
      logger.error('[OfflineSection] 清理失败', err);
      toast.error('清理失败');
    }
  };

  const handleManualSync = async (): Promise<void> => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncOfflineRecords();
      if (result.failed > 0) {
        toast.warning(`同步完成：成功 ${result.success} 条，失败 ${result.failed} 条`);
      } else if (result.success > 0) {
        toast.success(`同步完成：成功 ${result.success} 条`);
      } else {
        toast.info('没有待同步的记录');
      }
      void loadData();
    } catch (err) {
      logger.error('[OfflineSection] 手动同步失败', err);
      toast.error('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const handleAutoDownloadChange = (checked: boolean): void => {
    setAutoDownload(checked);
    safeSetItem(AUTO_DOWNLOAD_KEY, checked ? '1' : '0');
  };

  // 仅展示已有题集（没下载+已下载的），如果题集列表为空就只展示已下载的
  const displayBanks: QuestionBankItem[] =
    banks.length > 0 ? banks : downloadedBanks;

  return (
    <div className="space-y-4">
      {/* 离线设置 */}
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CloudOff className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">离线设置</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              下载题集到本地，离线时也能继续练习
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-foreground">
              {formatBytes(storageSize)}
            </p>
            <p className="text-[10px] text-muted-foreground">已用空间</p>
          </div>
        </div>

        {/* 同步状态 */}
        <div className="mb-4 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 ring-1 ring-border/40">
          <div className="flex items-center gap-2">
            {syncInfo.pending > 0 ? (
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            )}
            <span className="text-xs text-muted-foreground">
              {syncInfo.pending > 0
                 ? `${syncInfo.pending} 条作答记录待同步`
                 : '作答记录已全部同步'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualSync}
            disabled={syncing}
            className="h-7 gap-1 px-2 text-xs"
          >
            <RefreshCw
              className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`}
            />
            {syncing ? '同步中' : '立即同步'}
          </Button>
        </div>

        <SettingRow
          label="自动下载更新"
          description="联网时自动检查已下载题集的更新"
          control={
            <Switch checked={autoDownload} onCheckedChange={handleAutoDownloadChange} />
          }
        />
      </div>

       {/* 题集下载列表 */}
       <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-all duration-200 hover:shadow-md">
         <button
           type="button"
           onClick={() => setBankListCollapsed(!bankListCollapsed)}
           className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-accent/30 sm:px-6"
         >
           <div className="flex items-center gap-3">
             <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
               <HardDrive className="h-4 w-4" />
             </div>
             <div>
               <h3 className="text-sm font-semibold text-foreground">题集下载</h3>
               <p className="mt-0.5 text-xs text-muted-foreground">
                 共 {banks.length} 个题集，已下载 {downloadedBanks.length} 个
               </p>
             </div>
           </div>
           {bankListCollapsed ? (
             <ChevronDown className="h-4 w-4 text-muted-foreground" />
           ) : (
             <ChevronUp className="h-4 w-4 text-muted-foreground" />
           )}
         </button>

        {!bankListCollapsed && (
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            加载中...
          </div>
        ) : displayBanks.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
              暂无可下载的题集
          </div>
        ) : (
          <div className="space-y-2">
            {displayBanks.map((bank) => {
              const isDownloaded = downloadedIds.has(bank.id);
              const isDownloading = downloadingBankId === bank.id;
              return (
                <div
                  key={bank.id}
                  className="rounded-lg border border-border/40 bg-muted/20 p-3 transition-all duration-200 hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {bank.name}
                        </p>
                        {isDownloaded && (
                          <Badge
                            variant="secondary"
                            className="h-4 shrink-0 px-1.5 text-[10px] font-normal"
                          >
                            已下载
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {bank.questionCount} 道题
                      </p>
                    </div>
                    {isDownloading ? (
                      <div className="w-20 shrink-0 text-right">
                        <div className="text-[10px] text-muted-foreground">
                          {downloadProgress}%
                        </div>
                        <Progress value={downloadProgress} className="mt-1 h-1" />
                      </div>
                    ) : isDownloaded ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBank(bank)}
                        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                        删除
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(bank)}
                        disabled={!!downloadingBankId}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Download className="h-3 w-3" />
                        下载
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
           </div>
         )}

          {/* 底部操作 */}
         <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
          <p className="text-[11px] text-muted-foreground">
            已下载 {downloadedBanks.length} 个题集
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            disabled={downloadedBanks.length === 0}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
            清理所有缓存
           </Button>
         </div>
         </div>
        )}
       </div>
     </div>
   );
};

export default OfflineSection;
