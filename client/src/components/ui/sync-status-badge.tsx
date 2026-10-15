import { CheckCircle, RefreshCw, Clock, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error';

interface StatusConfigItem {
  label: string;
  color: string;
  bg: string;
  icon: LucideIcon;
}

const statusConfig: Record<SyncStatus, StatusConfigItem> = {
  synced: { label: '已同步', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
  syncing: { label: '同步中', color: 'text-blue-600', bg: 'bg-blue-100', icon: RefreshCw },
  pending: { label: '待同步', color: 'text-muted-foreground', bg: 'bg-muted', icon: Clock },
  error: { label: '同步失败', color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
};

export function computeSyncStatus(lastSyncedAt?: string, isSyncing = false): SyncStatus {
  if (isSyncing) return 'syncing';
  if (!lastSyncedAt) return 'pending';
  const diffMs = Date.now() - new Date(lastSyncedAt).getTime();
  if (diffMs < 0) return 'pending';
  if (diffMs <= 5 * 60 * 1000) return 'synced';
  return 'pending';
}

export function formatSyncTime(dateStr?: string): string {
  if (!dateStr) return '从未同步';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '刚刚同步';
  if (diffMins < 60) return `${diffMins} 分钟前同步`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} 小时前同步`;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface SyncStatusBadgeProps {
  status: SyncStatus;
}

const SyncStatusBadge = ({ status }: SyncStatusBadgeProps) => {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      <Icon className={`h-3 w-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
};

export default SyncStatusBadge;
