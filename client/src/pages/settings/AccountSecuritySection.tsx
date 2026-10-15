import { useState, useCallback, useEffect } from 'react';
import {
  Shield,
  Monitor,
  Eye,
  EyeOff,
  ChevronRight,
  User,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from '@client/src/utils/router';
import { useAuth } from '@client/src/contexts/AuthContext';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import PasswordStrengthIndicator from '@client/src/components/ui/password-strength-indicator';
import { changePassword } from '@client/src/api/auth';
import { userSettingsApi } from '@client/src/api';

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
}

const PasswordInput = ({
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
}: PasswordInputProps) => {
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
        aria-label={show ? '隐藏密码' : '显示密码'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

const AccountSecuritySection = () => {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();

  // 修改密码
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changing, setChanging] = useState(false);

  // 设备数
  const [deviceCount, setDeviceCount] = useState<number>(0);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const fetchDeviceCount = useCallback(async () => {
    if (isGuest) return;
    try {
      setLoadingDevices(true);
      const devices = await userSettingsApi.getDevices();
      setDeviceCount(devices.length);
    } catch {
      // 静默失败
    } finally {
      setLoadingDevices(false);
    }
  }, [isGuest]);

  useEffect(() => {
    fetchDeviceCount();
  }, [fetchDeviceCount]);

  const handleChangePassword = async (): Promise<void> => {
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
      toast.success('密码修改成功，其他设备已下线');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      void fetchDeviceCount();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || '密码修改失败，请稍后重试';
      toast.error(message);
    } finally {
      setChanging(false);
    }
  };

  const handleGoDevices = (): void => {
    navigate('/settings/devices');
  };

  return (
    <div className="space-y-4">
      {/* 账号信息 */}
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {user?.username || '未登录'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isGuest ? '游客模式' : `UID: ${user?.uid || '—'}`}
            </p>
          </div>
        </div>
      </div>

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

        {isGuest ? (
          <p className="text-sm text-muted-foreground">
            游客模式下无需密码，请先注册账号后使用此功能
          </p>
        ) : (
          <div className="space-y-3">
            <PasswordInput
              label="原密码"
              value={oldPassword}
              onChange={setOldPassword}
              show={showOldPassword}
              onToggleShow={() => setShowOldPassword((v) => !v)}
              placeholder="原密码"
            />
            <PasswordInput
              label="新密码"
              value={newPassword}
              onChange={setNewPassword}
              show={showNewPassword}
              onToggleShow={() => setShowNewPassword((v) => !v)}
              placeholder="新密码（至少 6 位）"
            />
            <PasswordStrengthIndicator password={newPassword} />
            <PasswordInput
              label="确认新密码"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirmPassword}
              onToggleShow={() => setShowConfirmPassword((v) => !v)}
              placeholder="确认新密码"
            />
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
        )}
      </div>

      {/* 登录设备入口 */}
      <div
        className="cursor-pointer rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md sm:p-6"
        role="button"
        tabIndex={0}
        onClick={handleGoDevices}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleGoDevices();
          }
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Monitor className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">登录设备</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {loadingDevices
                ? '加载中...'
                : `当前共有 ${deviceCount} 台设备登录此账号`}
            </p>
          </div>
          <Button variant="ghost" size="sm" tabIndex={-1} className="text-primary">
            管理设备
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccountSecuritySection;
