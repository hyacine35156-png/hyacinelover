import { useState, useRef, useCallback, useEffect } from 'react';
import { Cloud, RefreshCw, Database, Download, Upload } from 'lucide-react';
import { SettingRow } from './SettingSection';
import { Switch } from '@client/src/components/ui/switch';
import { Button } from '@client/src/components/ui/button';
import { safeSetItem, safeGetItem } from '@client/src/utils/env';
import { toast } from 'sonner';
import { userSettingsApi } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import ExportDialog from '@client/src/components/export-import/ExportDialog';
import ImportDialog from '@client/src/components/export-import/ImportDialog';
import SyncStatusBadge, {
  computeSyncStatus,
  formatSyncTime,
} from '@client/src/components/ui/sync-status-badge';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { SyncStateResponse } from '@shared/api.interface';

const SYNC_FREQ_OPTIONS = [
  { value: 'realtime', label: '实时' },
  { value: '5min', label: '每5分钟' },
  { value: '30min', label: '每30分钟' },
  { value: 'manual', label: '手动' },
];

const STORAGE_PREFIX = 'hyacine_sync_';

type SyncFrequency = 'realtime' | '5min' | '30min' | 'manual';

function getStored(key: string, fallback: string): string {
  const stored = safeGetItem(STORAGE_PREFIX + key);
  return stored || fallback;
}

function setStored(key: string, value: string): void {
  safeSetItem(STORAGE_PREFIX + key, value);
}

const SyncSection = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isGuest } = useAuth();

  const [autoSync, setAutoSync] = useState<boolean>(
    () => getStored('auto_sync', '1') === '1',
  );
  const [syncFreq, setSyncFreq] = useState<SyncFrequency>(
    () => getStored('frequency', 'realtime') as SyncFrequency,
  );

  // 同步状态
  const [syncState, setSyncState] = useState<SyncStateResponse>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [loadingSyncState, setLoadingSyncState] = useState(false);

  const status = syncError ? 'error' : computeSyncStatus(syncState.lastSyncedAt, isSyncing);

  const handleAutoSyncChange = (checked: boolean): void => {
    setAutoSync(checked);
    setStored('auto_sync', checked ? '1' : '0');
  };

  const handleFreqChange = (value: SyncFrequency): void => {
    setSyncFreq(value);
    setStored('frequency', value);
  };

  const fetchSyncState = useCallback(async () => {
    if (isGuest) return;
    try {
      setLoadingSyncState(true);
      const state = await userSettingsApi.getSyncState();
      setSyncState(state);
      setSyncError(false);
    } catch (err) {
      logger.warn('[SyncSection] 获取同步状态失败', err);
      setSyncError(true);
    } finally {
      setLoadingSyncState(false);
    }
  }, [isGuest]);

  const handleManualSync = useCallback(async () => {
    if (isGuest) {
      toast.info('游客模式下数据仅保存在本地');
      return;
    }
    try {
      setIsSyncing(true);
      setSyncError(false);
      await userSettingsApi.pingSync();
      await fetchSyncState();
      toast.success('同步成功');
    } catch (err) {
      logger.error('[SyncSection] 同步失败', err);
      setSyncError(true);
      toast.error('同步失败，请稍后重试');
    } finally {
      setIsSyncing(false);
    }
  }, [isGuest, fetchSyncState]);

  // 加载同步状态
  useEffect(() => {
    fetchSyncState();
  }, [fetchSyncState]);

  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const handleImportFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const file = e.target.files?.[0];
      if (file) {
        setImportFile(file);
        setImportOpen(true);
      }
      e.target.value = '';
    },
    [],
  );

  const handleImportFileReset = useCallback((): void => {
    setImportFile(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* 同步状态卡片 */}
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cloud className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">同步状态</h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {isGuest ? '游客模式，数据仅保存在本地' : formatSyncTime(syncState.lastSyncedAt)}
            </p>
          </div>
          {loadingSyncState ? (
            <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <SyncStatusBadge status={status} />
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing || isGuest}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            立即同步
          </Button>
        </div>
      </div>

      {/* 同步设置卡片 */}
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RefreshCw className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">同步设置</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              自动同步与同步频率
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <SettingRow
            label="自动同步"
            description="有数据变更时自动同步到云端"
            control={
              <Switch
                checked={autoSync}
                onCheckedChange={handleAutoSyncChange}
              />
            }
          />
          <div className="border-t border-border/40" />
          <SettingRow
            label="同步频率"
            description="定期同步的时间间隔"
            control={
              <div className="inline-flex items-center rounded-lg bg-muted p-1 ring-1 ring-border/40">
                {SYNC_FREQ_OPTIONS.map((option) => {
                  const isActive = syncFreq === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleFreqChange(option.value as SyncFrequency)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-card text-primary shadow-sm ring-1 ring-border/60'
                          : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            }
          />
        </div>
      </div>

      {/* 数据管理卡片 */}
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">数据管理</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              导出或导入你的练习数据
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="h-3.5 w-3.5" />
            导出数据
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            导入数据
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFileChange}
          />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          支持导出题集、题目、练习记录、收藏、错题本、标签与设置，格式为 JSON
        </p>

        <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          file={importFile}
          onFileReset={handleImportFileReset}
        />
      </div>
    </div>
  );
};

export default SyncSection;
