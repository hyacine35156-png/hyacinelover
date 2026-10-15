import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Monitor,
  Eye,
  EyeOff,
  LogOut,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Input } from '@client/src/components/ui/input';
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
import {
  changePassword,
  getDevices,
  deleteDevice as apiDeleteDevice,
  logoutOtherDevices as apiLogoutOtherDevices,
} from '@client/src/api/auth';
import { checkPasswordStrength } from '@client/src/utils/password-strength';
import type { UserDeviceItem } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} 小时前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-CN');
  } catch {
    return dateStr;
  }
}

const SecuritySection = () => {
  // 修改密码
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changing, setChanging] = useState(false);

  // 设备管理
  const [devices, setDevices] = useState<UserDeviceItem[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState<string | null>(null);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const passwordStrength = checkPasswordStrength(newPassword);

  const fetchDevices = useCallback(async () => {
    try {
      setLoadingDevices(true);
      const resp = await getDevices();
      setDevices(resp.items);
    } catch (err) {
      logger.error('获取设备列表失败', err);
      // 静默失败，不打扰用户
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.warning('请填写完整的密码信息');
      return;
    }
    if (newPassword.length < 6) {
      toast.warning('新密码长度不能少于 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning('两次输入的新密码不一致');
      return;
    }
    if (newPassword === oldPassword) {
      toast.warning('新密码不能与原密码相同');
      return;
    }

    try {
      setChanging(true);
      await changePassword({ oldPassword, newPassword });
      toast.success('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || '密码修改失败，请稍后重试';
      toast.error(message);
    } finally {
      setChanging(false);
    }
  };

  const handleLogoutDevice = async (deviceId: string) => {
    try {
      setProcessing(true);
      await apiDeleteDevice(deviceId);
      toast.success('已下线该设备');
      setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
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

  const handleLogoutAllOthers = async () => {
    try {
      setProcessing(true);
      const resp = await apiLogoutOtherDevices();
      toast.success(`已下线 ${resp.removedCount} 台设备`);
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

  const getStrengthBarColor = (): string => {
    if (!newPassword) return 'bg-border';
    switch (passwordStrength.level) {
      case 'strong':
        return 'bg-green-500';
      case 'medium':
        return 'bg-amber-500';
      default:
        return 'bg-red-500';
    }
  };

  const getStrengthTextColor = (): string => {
    if (!newPassword) return 'text-muted-foreground';
    switch (passwordStrength.level) {
      case 'strong':
        return 'text-green-600';
      case 'medium':
        return 'text-amber-600';
      default:
        return 'text-red-500';
    }
  };

  const otherDevicesCount = devices.filter((d) => !d.isCurrent).length;

  return (
    <div className="space-y-4">
      {/* 修改密码 */}
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">修改密码</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              定期修改密码可保护账号安全
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Input
              type={showOldPassword ? 'text' : 'password'}
              placeholder="原密码"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowOldPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label={showOldPassword ? '隐藏密码' : '显示密码'}
            >
              {showOldPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="relative">
            <Input
              type={showNewPassword ? 'text' : 'password'}
              placeholder="新密码（至少 6 位）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label={showNewPassword ? '隐藏密码' : '显示密码'}
            >
              {showNewPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* 密码强度指示器 */}
          {newPassword && (
            <div className="space-y-1">
              <div className="flex h-1.5 gap-1">
                <div
                  className={`flex-1 rounded-full transition-colors ${
                    newPassword.length >= 6 ? getStrengthBarColor() : 'bg-border'
                  }`}
                />
                <div
                  className={`flex-1 rounded-full transition-colors ${
                    passwordStrength.score >= 2
                      ? getStrengthBarColor()
                      : 'bg-border'
                  }`}
                />
                <div
                  className={`flex-1 rounded-full transition-colors ${
                    passwordStrength.score >= 3
                      ? getStrengthBarColor()
                      : 'bg-border'
                  }`}
                />
                <div
                  className={`flex-1 rounded-full transition-colors ${
                    passwordStrength.level === 'strong'
                      ? getStrengthBarColor()
                      : 'bg-border'
                  }`}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${getStrengthTextColor()}`}>
                  密码强度：{passwordStrength.label}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {passwordStrength.criteria.length ? '✓ 长度≥8' : '长度 6-7'}·
                  {passwordStrength.criteria.number ? '✓' : '✗'}数字 ·
                  {passwordStrength.criteria.uppercase ? '✓' : '✗'}大写 ·
                  {passwordStrength.criteria.special ? '✓' : '✗'}特殊
                </span>
              </div>
            </div>
          )}

          <div className="relative">
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="确认新密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-500">两次输入的密码不一致</p>
          )}

          <Button
            onClick={handleChangePassword}
            disabled={changing}
            className="w-full sm:w-auto"
          >
            {changing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            确认修改
          </Button>
        </div>
      </div>

      {/* 登录设备 */}
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Monitor className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">登录设备</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              管理你的登录设备，下线不认识的设备
            </p>
          </div>
          {otherDevicesCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogoutAllOpen(true)}
            >
              <LogOut className="h-3.5 w-3.5" />
              下线其他设备
            </Button>
          )}
        </div>

        {loadingDevices ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : devices.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            暂无登录设备记录
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/40 bg-muted/30 p-3 transition-all hover:border-border/60 hover:bg-muted/50"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Monitor className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {device.deviceName}
                      </p>
                      {device.isCurrent && (
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                          当前设备
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {device.browser && device.os
                        ? `${device.browser} · ${device.os}`
                        : device.browser || device.os || ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      最后活跃：{formatRelativeTime(device.lastActiveAt)}
                    </p>
                  </div>
                </div>
                {!device.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoutConfirm(device.deviceId)}
                    className="shrink-0 text-muted-foreground hover:text-red-500"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">下线</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 单个设备下线确认 */}
      <Dialog open={!!logoutConfirm} onOpenChange={(open) => !open && setLogoutConfirm(null)}>
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
              {devices.find((d) => d.deviceId === logoutConfirm)?.deviceName}
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
              将下线 <span className="font-semibold text-foreground">{otherDevicesCount}</span> 台设备
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

export default SecuritySection;
