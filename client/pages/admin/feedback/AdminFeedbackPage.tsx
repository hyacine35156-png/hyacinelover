import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  MessageSquare,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
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
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Textarea } from '@client/src/components/ui/textarea';
import { Spinner } from '@client/src/components/ui/spinner';
import { adminFeedbackApi } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import type {
  AdminFeedbackItem,
  AdminFeedbackStatsResponse,
  FeedbackStatus,
  FeedbackSource,
} from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

const SOURCE_LABEL: Record<FeedbackSource, string> = {
  question: '题目纠错',
  general: '意见反馈',
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  unread: '未读',
  read: '已读',
  processing: '处理中',
  resolved: '已解决',
  closed: '已关闭',
};

const STATUS_COLOR: Record<FeedbackStatus, string> = {
  unread: 'bg-red-500/15 text-red-500 border-red-500/20',
  read: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
  processing: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
  resolved: 'bg-green-500/15 text-green-600 border-green-500/20',
  closed: 'bg-gray-500/15 text-gray-500 border-gray-500/20',
};

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  wrong_answer: '答案错误',
  unclear_content: '题干不清',
  wrong_option: '选项有误',
  wrong_analysis: '解析错误',
  other: '其他',
  js_error: 'JS错误',
  unhandledrejection: 'Promise异常',
  bug: 'Bug反馈',
  suggestion: '功能建议',
  feedback_general: '通用反馈',
};

const AdminFeedbackPage = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const [stats, setStats] = useState<AdminFeedbackStatsResponse | null>(null);
  const [items, setItems] = useState<AdminFeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(false);

  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<string>('newest');
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminFeedbackItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFeedbackApi.getFeedbackList({
        page,
        pageSize,
        source: sourceFilter === 'all' ? undefined : (sourceFilter as FeedbackSource),
        status: statusFilter === 'all' ? undefined : (statusFilter as FeedbackStatus),
        sort: sort as 'newest' | 'oldest',
        keyword: keyword || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (error) {
      toast.error('加载反馈列表失败');
      logger.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, sourceFilter, statusFilter, sort, keyword]);

  useEffect(() => {
    adminFeedbackApi.getFeedbackStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSearch = () => {
    setKeyword(searchInput.trim());
    setPage(1);
  };

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    setDetail(null);
    setReplyText('');
    try {
      const data = await adminFeedbackApi.getFeedbackDetail(id);
      setDetail(data);
      setReplyText(data.adminReply ?? '');
      if (data.status === 'unread') {
        await adminFeedbackApi.updateFeedbackStatus(id, { status: 'read' });
        fetchList();
      }
    } catch (error) {
      toast.error('加载反馈详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChange = async (status: FeedbackStatus) => {
    if (!detailId) return;
    setUpdating(true);
    try {
      await adminFeedbackApi.updateFeedbackStatus(detailId, {
        status,
        adminReply: replyText.trim() || undefined,
      });
      toast.success('状态已更新');
      setDetail((prev) =>
        prev ? { ...prev, status, adminReply: replyText.trim() || prev.adminReply } : prev,
      );
      fetchList();
      adminFeedbackApi.getFeedbackStats().then(setStats).catch(() => {});
    } catch (error) {
      toast.error('更新失败');
    } finally {
      setUpdating(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const unreadCount = stats?.unread ?? 0;

  useEffect(() => {
    if (!isLoading && user?.role !== 'admin') {
      toast.error('您没有管理员权限');
      navigate('/settings', { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading || !user || user.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl fade-in-up px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            反馈管理
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            查看和处理用户提交的所有反馈
          </p>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="px-3 py-1">
            {unreadCount} 条未读
          </Badge>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="总反馈" value={stats?.total ?? 0} loading={!stats} />
        <StatCard label="未读" value={stats?.unread ?? 0} loading={!stats} tone="red" />
        <StatCard label="处理中" value={stats?.processing ?? 0} loading={!stats} tone="yellow" />
        <StatCard label="已解决" value={stats?.resolved ?? 0} loading={!stats} tone="green" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="搜索反馈内容..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
          />
        </div>
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[120px]">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue placeholder="来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            <SelectItem value="question">题目纠错</SelectItem>
            <SelectItem value="general">意见反馈</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="unread">未读</SelectItem>
            <SelectItem value="read">已读</SelectItem>
            <SelectItem value="processing">处理中</SelectItem>
            <SelectItem value="resolved">已解决</SelectItem>
            <SelectItem value="closed">已关闭</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[120px]">
            <Clock className="mr-2 h-3.5 w-3.5" />
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">最新优先</SelectItem>
            <SelectItem value="oldest">最早优先</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-16 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">暂无反馈数据</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="group rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-normal">
                      {SOURCE_LABEL[item.source]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {FEEDBACK_TYPE_LABELS[item.feedbackType] || item.feedbackType}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[item.status]}`}
                    >
                      {item.status === 'unread' && (
                        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                      {STATUS_LABEL[item.status]}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-foreground">
                    {item.content || '(无内容)'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{item.username || '匿名用户'}</span>
                    <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
                  onClick={() => openDetail(item.id)}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  查看
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

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
          <span className="min-w-[80px] text-center text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
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

      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              反馈详情
              {detail && (
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[detail.status]}`}
                >
                  {STATUS_LABEL[detail.status]}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {detail?.id?.slice(0, 8)}...
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : detail ? (
            <div className="space-y-5">
              <InfoRow label="反馈来源" value={SOURCE_LABEL[detail.source]} />
              <InfoRow
                label="反馈类型"
                value={FEEDBACK_TYPE_LABELS[detail.feedbackType] || detail.feedbackType}
              />
              <InfoRow label="提交用户" value={detail.username || '匿名用户'} />
              <InfoRow
                label="提交时间"
                value={new Date(detail.createdAt).toLocaleString('zh-CN')}
              />
              {detail.handledAt && (
                <InfoRow
                  label="处理时间"
                  value={`${new Date(detail.handledAt).toLocaleString('zh-CN')} (${detail.handledByUsername || '管理员'})`}
                />
              )}
              {detail.questionId && (
                <InfoRow label="题目ID" value={detail.questionId} />
              )}
              {detail.pageUrl && <InfoRow label="页面地址" value={detail.pageUrl} />}
              {detail.appVersion && <InfoRow label="应用版本" value={detail.appVersion} />}
              {detail.userAgent && (
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    用户代理
                  </div>
                  <div className="break-all rounded-lg bg-muted/50 p-2 font-mono text-xs text-muted-foreground">
                    {detail.userAgent}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                  反馈内容
                </div>
                <div className="whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-foreground">
                  {detail.content || '(无内容)'}
                </div>
              </div>

              {detail.errorStack && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <AlertCircle className="h-3 w-3" />
                    错误堆栈
                  </div>
                  <div className="max-h-40 overflow-auto rounded-lg bg-red-500/5 p-3 font-mono text-[11px] leading-relaxed text-red-500/80">
                    {detail.errorStack}
                  </div>
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="text-sm font-semibold text-foreground">
                  处理操作
                </div>
                <Textarea
                  placeholder="填写管理员回复（可选）..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                />
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    status="read"
                    current={detail.status}
                    loading={updating}
                    onClick={() => handleStatusChange('read')}
                  >
                    标记已读
                  </ActionButton>
                  <ActionButton
                    status="processing"
                    current={detail.status}
                    loading={updating}
                    onClick={() => handleStatusChange('processing')}
                  >
                    处理中
                  </ActionButton>
                  <ActionButton
                    status="resolved"
                    current={detail.status}
                    loading={updating}
                    onClick={() => handleStatusChange('resolved')}
                  >
                    已解决
                  </ActionButton>
                  <ActionButton
                    status="closed"
                    current={detail.status}
                    loading={updating}
                    onClick={() => handleStatusChange('closed')}
                  >
                    关闭
                  </ActionButton>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value: number;
  loading: boolean;
  tone?: 'red' | 'yellow' | 'green';
}) => {
  const toneClass =
    tone === 'red'
      ? 'text-red-500'
      : tone === 'yellow'
        ? 'text-yellow-600'
        : tone === 'green'
          ? 'text-green-600'
          : 'text-foreground';
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>
        {loading ? '...' : value.toLocaleString()}
      </div>
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
    <span className="min-w-0 flex-1 break-all text-sm text-foreground">{value}</span>
  </div>
);

const ActionButton = ({
  status,
  current,
  loading,
  onClick,
  children,
}: {
  status: FeedbackStatus;
  current: FeedbackStatus;
  loading: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => {
  const isActive = current === status;
  const variant = isActive ? 'default' : 'outline';
  return (
    <Button
      variant={variant as 'default' | 'outline'}
      size="sm"
      disabled={loading || isActive}
      onClick={onClick}
    >
      {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
      {children}
    </Button>
  );
};

export default AdminFeedbackPage;
