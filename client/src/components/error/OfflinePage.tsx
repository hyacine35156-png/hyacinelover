import { WifiOff, RefreshCw, Home } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface OfflinePageProps {
  onRetry?: () => void;
  onGoHome?: () => void;
}

export const OfflinePage: React.FC<OfflinePageProps> = ({ onRetry, onGoHome }) => {
  const navigate = useNavigate();
  const handleRefresh = (): void => {
    window.location.reload();
  };

  const handleGoHome = (): void => {
    navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 text-center shadow-xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/20 dark:to-red-900/20">
          <WifiOff className="h-10 w-10 text-orange-500" aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-2xl font-bold text-foreground">网络连接已断开</h1>
        <p className="mt-3 text-base text-muted-foreground">
          当前处于离线状态，无法加载页面内容。<br />
          请检查您的网络连接后重试。
        </p>

        <div className="mt-8 space-y-3">
          <Button
            onClick={onRetry ?? handleRefresh}
            className="w-full gap-2"
            size="lg"
          >
            <RefreshCw className="h-4 w-4" />
            重新加载
          </Button>
          <Button
            onClick={onGoHome ?? handleGoHome}
            variant="outline"
            className="w-full gap-2"
            size="lg"
          >
            <Home className="h-4 w-4" />
            返回首页
          </Button>
        </div>

        <div className="mt-8 rounded-xl bg-muted/50 p-4 text-left">
          <h3 className="text-sm font-semibold text-foreground">常见解决办法</h3>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li>• 检查 Wi-Fi 或移动数据是否开启</li>
            <li>• 确认当前网络可以正常访问其他网站</li>
            <li>• 尝试切换网络（如从 Wi-Fi 切换到移动数据）</li>
            <li>• 关闭后重新打开应用</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default OfflinePage;
