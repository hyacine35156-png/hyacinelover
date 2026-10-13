import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Button } from '@client/src/components/ui/button';
import { checkAppVersion, dismissVersionUpdate, forceReloadForUpdate } from '@client/src/utils/version-check';

const VersionUpdateBanner = () => {
  const [visible, setVisible] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const runCheck = async () => {
      try {
        const result = await checkAppVersion();
        if (result.hasUpdate) {
          setLatestVersion(result.latestVersion);
          setVisible(true);
        }
      } catch (err) {
        logger.warn('[version] 版本检查异常', err);
      }
    };

    const timer = window.setTimeout(runCheck, 3000);
    return () => window.clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    setUpdating(true);
    dismissVersionUpdate(latestVersion);
    forceReloadForUpdate();
  };

  const handleDismiss = () => {
    dismissVersionUpdate(latestVersion);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 bg-gradient-to-r from-primary/95 to-purple-500/95 px-4 py-2 text-white shadow-lg backdrop-blur">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">检测到新版本</span>
        <span className="text-xs opacity-80">（{latestVersion}）</span>
        <span className="hidden text-xs opacity-70 sm:inline">点击刷新以加载最新版本</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={handleRefresh}
          disabled={updating}
          className="h-7 gap-1 bg-white/20 text-white hover:bg-white/30"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${updating ? 'animate-spin' : ''}`} />
          <span className="text-xs">立即刷新</span>
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-full p-1 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="忽略本次更新"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default VersionUpdateBanner;
