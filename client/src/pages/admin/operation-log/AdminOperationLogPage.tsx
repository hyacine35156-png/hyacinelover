import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ClipboardList, Filter, Search, ChevronLeft, ChevronRight, CheckCircle2, Calendar } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Badge } from '@client/src/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/src/components/ui/select';
import { Spinner } from '@client/src/components/ui/spinner';
import { adminOperationLogApi } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import type { AdminOperationLogItem, AdminOperationType } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

const OPERATION_LABEL: Record<string, string> = {
  delete_bank: '删除题集', delete_question: '删除题目', delete_user: '删除用户',
  delete_feedback: '删除反馈', change_user_role: '修改用户角色', kick_device: '下线设备',
  rollback_bank_version: '回滚题集版本', approve_edit_request: '同意编辑申请',
  reject_edit_request: '拒绝编辑申请', remove_collaborator: '移除协作者',
  change_bank_public: '修改公开状态',
};

const OPERATION_COLOR: Record<string, string> = {
  delete_bank: 'bg-red-500/15 text-red-500 border-red-500/20',
  delete_question: 'bg-red-500/15 text-red-500 border-red-500/20',
  delete_user: 'bg-red-500/15 text-red-500 border-red-500/20',
  delete_feedback: 'bg-red-500/15 text-red-500 border-red-500/20',
  change_user_role: 'bg-purple-500/15 text-purple-500 border-purple-500/20',
  kick_device: 'bg-orange-500/15 text-orange-500 border-orange-500/20',
  rollback_bank_version: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
  approve_edit_request: 'bg-green-500/15 text-green-600 border-green-500/20',
  reject_edit_request: 'bg-red-500/15 text-red-500 border-red-500/20',
  remove_collaborator: 'bg-orange-500/15 text-orange-500 border-orange-500/20',
  change_bank_public: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
};

const OPERATION_TYPES: AdminOperationType[] = [
  'delete_bank', 'delete_question', 'delete_user', 'delete_feedback',
  'change_user_role', 'kick_device', 'rollback_bank_version',
  'approve_edit_request', 'reject_edit_request', 'remove_collaborator', 'change_bank_public',
];

const AdminOperationLogPage = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const [items, setItems] = useState<AdminOperationLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(false);
  const [operationType, setOperationType] = useState<string>('all');
  const [adminKeyword, setAdminKeyword] = useState('');
  const [adminInput, setAdminInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminOperationLogApi.getOperationLogs({
        page, pageSize,
        operationType: operationType === 'all' ? undefined : operationType,
        adminId: adminKeyword || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      toast.error('加载操作日志失败');
      logger.error(e);
    } finally { setLoading(false); }
  }, [page, operationType, adminKeyword, startDate, endDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSearch = () => {
    setAdminKeyword(adminInput.trim());
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (!isLoading && user?.role !== 'admin') {
      toast.error('您没有管理员权限');
      navigate('/settings', { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading || !user || user.role !== 'admin') {
    return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl fade-in-up px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">操作日志</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">查看所有管理员操作记录</p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={operationType} onValueChange={(v) => { setOperationType(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue placeholder="操作类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {OPERATION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{OPERATION_LABEL[t] || t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative min-w-[160px] flex-1 sm:max-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9" placeholder="管理员用户名..." value={adminInput}
            onChange={(e) => setAdminInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
        </div>

        <div className="flex items-center gap-1">
          <Calendar className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
          <Input type="date" className="w-[140px]" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
          <span className="text-xs text-muted-foreground">至</span>
          <Input type="date" className="w-[140px]" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* 日志列表 */}
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-16 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">暂无操作日志</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">时间</th>
                  <th className="px-4 py-2.5 text-left font-medium">管理员</th>
                  <th className="px-4 py-2.5 text-left font-medium">操作类型</th>
                  <th className="px-4 py-2.5 text-left font-medium">目标</th>
                  <th className="px-4 py-2.5 text-left font-medium">详情</th>
                  <th className="px-4 py-2.5 text-left font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/40 last:border-b-0 transition-colors hover:bg-muted/20">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-foreground">{item.adminUsername}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={OPERATION_COLOR[item.operationType] || 'bg-gray-500/15 text-gray-500 border-gray-500/20'}>
                        {OPERATION_LABEL[item.operationType] || item.operationType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[180px] truncate">
                        <span className="text-xs text-muted-foreground">{item.targetType || '-'}</span>
                        {item.targetName && <div className="truncate text-foreground">{item.targetName}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground/80">
                      <div className="max-w-[240px] truncate">{item.operationDetail || '-'}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{item.ipAddress || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[80px] text-center text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminOperationLogPage;
