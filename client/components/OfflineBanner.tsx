import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';

/**
 * 离线状态提示条
 * - 监听 navigator.onLine 和 online/offline 事件
 * - 离线时在页面顶部显示固定提示条
 * - 橙红色渐变背景，白色文字
 * - 深浅色模式下均正常显示
 * - 点击刷新按钮重新加载页面
 */
const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = (): void => setIsOnline(true);
    const handleOffline = (): void => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRefresh = (): void => {
    window.location.reload();
  };

  if (isOnline) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between gap-3 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg animate-pulse"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <div className="flex flex-col">
          <span className="font-semibold">当前处于离线状态</span>
          <span className="text-xs opacity-90">网络连接已断开，请检查您的网络</span>
        </div>
      </div>
      <Button
        size="sm"
        variant="default"
        onClick={handleRefresh}
        className="h-8 gap-1 bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span className="text-xs">刷新</span>
      </Button>
    </div>
  );
};

export default OfflineBanner;
