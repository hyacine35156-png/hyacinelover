import { Monitor, Globe, Clock, LogOut, Laptop, Smartphone, Monitor as MonitorIcon } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import type { LucideIcon } from 'lucide-react';
import type { UserDeviceItem } from '@shared/api.interface';

const formatRelativeTime = (dateStr: string): string => {
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
};

const formatDateTime = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

const getDeviceIcon = (os: string | null | undefined): LucideIcon => {
  if (!os) return MonitorIcon;
  if (/Android|iOS|iPad|iPhone/.test(os)) return Smartphone;
  return Laptop;
};

interface DeviceCardProps {
  device: UserDeviceItem;
  onLogout?: (deviceId: string) => void;
}

const DeviceCard = ({ device, onLogout }: DeviceCardProps) => {
  const DeviceIcon = getDeviceIcon(device.os);
  return (
    <div
      className={`relative rounded-xl border p-4 shadow-sm transition-all duration-200 ${
        device.isCurrent
          ? 'border-primary/40 bg-primary/[0.04] shadow-md'
          : 'border-border/60 bg-card hover:shadow-md'
      }`}
    >
      {device.isCurrent && (
        <span className="absolute right-3 top-3 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
          当前设备
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <DeviceIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pr-12 sm:pr-0">
          <h4 className="truncate text-sm font-semibold text-foreground">
            {device.deviceName}
          </h4>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {device.browser && device.os
              ? `${device.browser} · ${device.os}`
              : device.browser || device.os || '未知设备'}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">IP：{device.ipAddress || '未知'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            最后活跃：{formatRelativeTime(device.lastActiveAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Monitor className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            登录时间：{formatDateTime(device.createdAt)}
          </span>
        </div>
      </div>
      {!device.isCurrent && onLogout && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onLogout(device.id)}
          className="mt-3 w-full text-muted-foreground hover:text-red-500 hover:bg-red-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          下线设备
        </Button>
      )}
    </div>
  );
};

export default DeviceCard;
