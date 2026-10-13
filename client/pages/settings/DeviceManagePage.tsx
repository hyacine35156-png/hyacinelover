import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Monitor,
  LogOut,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from '@client/src/utils/router';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '@client/src/components/ui/dialog';
import { userSettingsApi } from '@client/src/api';
import { logger } from '@lark-apaas/client-toolkit/logger';
import DeviceCard from './DeviceCard';
import type { UserDeviceItem } from '@shared/api.interface';

const DeviceManagePage = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<UserDeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoutConfirm, setLogoutConfirm] = useState<string | null>(null);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const list = await userSettingsApi.getDevices();
      setDevices(list);
    } catch (err) {
      logger.error('[DeviceManage] 获取设备列表失败', err);
      toast.error('获取设备列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleLogoutDevice = async (deviceId: string): Promise<void> => {
    try {
      setProcessing(true);
      await userSettingsApi.removeDevice(deviceId);
      toast.success('已下线该设备');
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      setLogoutConfirm(null);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || '下线失败，请稍后重试';
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  const handleLogoutAllOthers = async (): Promise<void> => {
    try {
      setProcessing(true);
      await userSettingsApi.logoutOtherDevices();
      toast.success('已下线所有其他设备');
      setDevices((prev) => prev.filter((d) => d.isCurrent));
      setLogoutAllOpen(false);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || '操作失败，请稍后重试';
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  const currentDevice = devices.find((d) => d.isCurrent);
  const otherDevices = devices.filter((d) => !d.isCurrent);
  const selectedDevice = devices.find((d) => d.id === logoutConfirm);

  return (
    <div className="mx-auto w-full max-w-2xl fade-in-up">
      {/* 顶部标题栏 */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings')}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            登录设备管理
          </h1>
          <p className="text-sm text-muted-foreground">
            管理你的登录设备，保护账号安全
          </p>
        </div>
      </div>

      {/* 下线所有其他设备按钮 */}
      {!loading && otherDevices.length > 0 && (
        <div className="mb-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setLogoutAllOpen(true)}
            className="w-full"
          >
            <LogOut className="h-4 w-4" />
            下线所有其他设备 ({otherDevices.length})
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">加载中...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 当前设备 */}
          {currentDevice && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                当前设备
              </h2>
              <DeviceCard device={currentDevice} />
            </div>
          )}

          {/* 其他设备 */}
          {otherDevices.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                其他设备 ({otherDevices.length})
              </h2>
              <div className="space-y-3">
                {otherDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onLogout={setLogoutConfirm}
                  />
                ))}
              </div>
            </div>
          )}

          {otherDevices.length === 0 && currentDevice && (
            <div className="rounded-xl border border-border/60 bg-card p-8 text-center shadow-sm">
              <Monitor className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                暂无其他登录设备
              </p>
            </div>
          )}
        </div>
      )}

      {/* 单个设备下线确认 */}
      <Dialog
        open={!!logoutConfirm}
        onOpenChange={(open) => !open && setLogoutConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              下线设备
            </DialogTitle>
            <DialogDescription>
              确定要下线此设备吗？下线后该设备上的账号将无法继续使用，需要重新登录。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-foreground">
              {selectedDevice?.deviceName}
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={processing}>
                取消
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => logoutConfirm && handleLogoutDevice(logoutConfirm)}
              disabled={processing}
            >
              {processing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              确认下线
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 下线所有其他设备确认 */}
      <Dialog open={logoutAllOpen} onOpenChange={setLogoutAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              下线所有其他设备
            </DialogTitle>
            <DialogDescription>
              确定要下线除当前设备外的所有设备吗？其他设备上的账号将立即失效，需要重新登录。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              将下线{' '}
              <span className="font-semibold text-foreground">
                {otherDevices.length}
              </span>{' '}
              台设备
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={processing}>
                取消
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleLogoutAllOthers}
              disabled={processing}
            >
              {processing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              确认全部下线
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeviceManagePage;
