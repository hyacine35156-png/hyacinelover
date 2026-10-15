import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  FileText,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  BarChart3,
  LogIn,
  LogOut,
  Database,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Badge } from '@client/src/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import { Spinner } from '@client/src/components/ui/spinner';
import { Card, CardContent } from '@client/src/components/ui/card';
import { systemLogApi } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import type {
  SystemLogItem,
  SystemLogType,
  SystemLogExportFormat,
} from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

const LOG_TYPE_LABEL: Record<SystemLogType, string> = {
  login: '登录',
  logout: '登出',
  data_change: '数据变更',
  import: '导入',
  export: '导出',
  anomaly: '异常',
};

const LOG_TYPE_COLOR: Record<SystemLogType, string> = {
  login: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
  logout: 'bg-gray-500/15 text-gray-500 border-gray-500/20',
  data_change: 'bg-blue-500/15 text-blue-600 border-blue-500/20',
  import: 'bg-orange-500/15 text-orange-600 border-orange-500/20',
  export: 'bg-purple-500/15 text-purple-600 border-purple-500/20',
  anomaly: 'bg-red-500/15 text-red-600 border-red-500/20',
};

const LOG_TYPE_ICON: Record<SystemLogType, typeof LogIn> = {
  login: LogIn,
  logout: LogOut,
  data_change: Database,
  import: Upload,
  export: Download,
  anomaly: AlertTriangle,
};

const LOG_TYPES: SystemLogType[] = [
  'login',
  'logout',
  'data_change',
  'import',
  'export',
  'anomaly',
];

const QUICK_RANGES = [
  { label: '今天', getRange: () => getDayRange(0) },
  { label: '近7天', getRange: () => getDayRange(6) },
  { label: '近30天', getRange: () => getDayRange(29) },
];

function getDayRange(daysAgo: number): { start: string; end: string } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - daysAgo);
  start.setHours(0, 0, 0, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

const AdminSystemLogPage = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const [items, setItems] = useState<SystemLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [logType, setLogType] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [usernameInput, setUsernameInput] = useState('');
  const [username, setUsername] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailLog, setDetailLog] = useState<SystemLogItem | null>(null);

  const [stats, setStats] = useState<{
    todayTotal: number;
    todayLogin: number;
    todayAnomaly: number;
    last7Days: { date: string; count: number }[];
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await systemLogApi.getSystemLogs({
        page,
        pageSize,
        logType: logType === 'all' ? undefined : (logType as SystemLogType),
        username: username || undefined,
        status: status === 'all' ? undefined : (status as 'success' | 'failed'),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        keyword: keyword || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      toast.error('加载系统日志失败');
      logger.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, logType, status, username, startDate, endDate, keyword]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await systemLogApi.getSystemLogStats();
      setStats(res);
    } catch (e) {
      logger.error('获取日志统计失败', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user?.role === 'admin') {
      fetchLogs();
      fetchStats();
    }
  }, [fetchLogs, fetchStats, user?.role, isLoading]);

  useEffect(() => {
    if (!isLoading && user && user.role !== 'admin') {
      toast.error('您没有管理员权限');
      navigate('/settings', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleQuickRange = (rangeIdx: number) => {
    const range = QUICK_RANGES[rangeIdx].getRange();
    setStartDate(range.start);
    setEndDate(range.end);
    setPage(1);
  };

  const handleSearch = () => {
    setUsername(usernameInput.trim());
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  const handleExport = async (format: SystemLogExportFormat) => {
    setExporting(true);
    try {
      await systemLogApi.exportSystemLogs({
        format,
        logType: logType === 'all' ? undefined : (logType as SystemLogType),
        username: username || undefined,
        status: status === 'all' ? undefined : (status as 'success' | 'failed'),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        keyword: keyword || undefined,
      });
      toast.success('导出成功');
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : '导出失败';
      toast.error(errMsg);
      logger.error(e);
    } finally {
      setExporting(false);
    }
  };

  const maxBarCount = useMemo(() => {
    if (!stats) return 0;
    return Math.max(...stats.last7Days.map((d) => d.count), 1);
  }, [stats]);

  if (isLoading || !user || user.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl fade-in-up px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">系统日志</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            查看全部用户操作记录与系统行为
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              导出
              {exporting && <Spinner className="ml-2 h-3 w-3" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              导出为 CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('excel')}>
              导出为 Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('json')}>
              导出为 JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">今日操作数</div>
              <div className="mt-1 text-2xl font-bold text-foreground">
                {stats.todayTotal}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">今日登录数</div>
              <div className="mt-1 text-2xl font-bold text-emerald-600">
                {stats.todayLogin}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">今日异常数</div>
              <div className="mt-1 text-2xl font-bold text-red-500">
                {stats.todayAnomaly}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <BarChart3 className="h-3 w-3" />
                近7天操作趋势
              </div>
              <div className="flex h-10 items-end gap-1">
                {stats.last7Days.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 rounded-sm bg-primary/30 transition-all hover:bg-primary/50"
                    style={{
                      height: `${(d.count / maxBarCount) * 100}%`,
                      minHeight: d.count > 0 ? '4px' : '0',
                    }}
                    title={`${d.date}: ${d.count}`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-3">
        <Select value={logType} onValueChange={(v) => { setLogType(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="操作类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {LOG_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {LOG_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="failed">失败</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative min-w-[140px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="用户名..."
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
        </div>

        <div className="relative min-w-[160px] flex-1 sm:max-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="关键词（操作/目标/详情）..."
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
        </div>

        <div className="flex items-center gap-1">
          <Calendar className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="date"
            className="w-[130px]"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          />
          <span className="text-xs text-muted-foreground">至</span>
          <Input
            type="date"
            className="w-[130px]"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          />
        </div>

        <div className="flex items-center gap-1">
          {QUICK_RANGES.map((r, i) => (
            <Button
              key={r.label}
              variant="outline"
              size="sm"
              onClick={() => handleQuickRange(i)}
            >
              {r.label}
            </Button>
          ))}
        </div>

        <Button size="sm" onClick={handleSearch}>
          <Search className="mr-1.5 h-3.5 w-3.5" />
          搜索
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-16 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">暂无系统日志</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-xs text-muted-foreground">
                  <th className="w-8 px-3 py-2.5"></th>
                  <th className="px-4 py-2.5 text-left font-medium">时间</th>
                  <th className="px-4 py-2.5 text-left font-medium">用户</th>
                  <th className="px-4 py-2.5 text-left font-medium">操作类型</th>
                  <th className="px-4 py-2.5 text-left font-medium">操作描述</th>
                  <th className="px-4 py-2.5 text-left font-medium">目标</th>
                  <th className="px-4 py-2.5 text-left font-medium">IP</th>
                  <th className="px-4 py-2.5 text-left font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const TypeIcon = LOG_TYPE_ICON[item.logType] || FileText;
                  const isExpanded = expandedId === item.id;
                  return (
                    <>
                      <tr
                        key={item.id}
                        className="cursor-pointer border-b border-border/40 last:border-b-0 transition-colors hover:bg-muted/20"
                        onClick={() => {
                          setExpandedId(isExpanded ? null : item.id);
                          setDetailLog(item);
                        }}
                      >
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {item.username || '-'}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant="outline"
                            className={`gap-1 ${LOG_TYPE_COLOR[item.logType] || ''}`}
                          >
                            <TypeIcon className="h-3 w-3" />
                            {LOG_TYPE_LABEL[item.logType] || item.logType}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-foreground/80">
                          {item.action}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="max-w-[180px] truncate">
                            <span className="text-xs text-muted-foreground">
                              {item.targetType || '-'}
                            </span>
                            {item.targetName && (
                              <div className="truncate text-foreground">
                                {item.targetName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {item.ipAddress || '-'}
                        </td>
                        <td className="px-4 py-2.5">
                          {item.status === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border/40 bg-muted/10">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                              <div>
                                <div className="text-xs text-muted-foreground">浏览器</div>
                                <div className="text-foreground">
                                  {(item.deviceInfo as Record<string, string>)?.browser || '-'}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">操作系统</div>
                                <div className="text-foreground">
                                  {(item.deviceInfo as Record<string, string>)?.os || '-'}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">User Agent</div>
                                <div className="max-w-[300px] truncate font-mono text-xs">
                                  {item.userAgent || '-'}
                                </div>
                              </div>
                              {item.errorMessage && (
                                <div className="col-span-2 sm:col-span-3">
                                  <div className="text-xs text-muted-foreground">错误信息</div>
                                  <div className="break-words text-red-500">
                                    {item.errorMessage}
                                  </div>
                                </div>
                              )}
                              {item.detail && (
                                <div className="col-span-2 sm:col-span-3">
                                  <div className="text-xs text-muted-foreground">操作详情</div>
                                  <div className="break-words text-foreground/80">
                                    {item.detail}
                                  </div>
                                </div>
                              )}
                              {item.targetId && (
                                <div>
                                  <div className="text-xs text-muted-foreground">目标ID</div>
                                  <div className="font-mono text-xs">{item.targetId}</div>
                                </div>
                              )}
                              {item.userId && (
                                <div>
                                  <div className="text-xs text-muted-foreground">用户ID</div>
                                  <div className="font-mono text-xs">{item.userId}</div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[100px] text-center text-sm text-muted-foreground">
            第 {page} / {totalPages} 页（共 {total} 条）
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog
        open={!!detailLog && expandedId !== detailLog?.id}
        onOpenChange={(open) => {
          if (!open) setDetailLog(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>日志详情</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">操作</div>
                <div>{detailLog.action}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSystemLogPage;
