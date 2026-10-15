import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Users, Filter, Clock, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Loader2, FileEdit,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@client/src/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@client/src/components/ui/dialog';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@client/src/components/ui/tabs';
import { Spinner } from '@client/src/components/ui/spinner';
import { bankCollaborationApi } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import type { EditRequestItem } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

type EditRequestStatus = 'pending' | 'approved' | 'rejected';

const STATUS_LABEL: Record<EditRequestStatus, string> = {
  pending: '待审核', approved: '已同意', rejected: '已拒绝',
};
const STATUS_COLOR: Record<EditRequestStatus, string> = {
  pending: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
  approved: 'bg-green-500/15 text-green-600 border-green-500/20',
  rejected: 'bg-red-500/15 text-red-500 border-red-500/20',
};

const CollaborationManagePage = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const [items, setItems] = useState<EditRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bankCollaborationApi.getReceivedEditRequests({
        page, pageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      toast.error('加载编辑申请列表失败');
      logger.error(e);
    } finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const openReview = (id: string, action: 'approve' | 'reject') => {
    setReviewId(id);
    setReviewAction(action);
    setReviewNote('');
  };

  const handleReview = async () => {
    if (!reviewId) return;
    setReviewing(true);
    try {
      await bankCollaborationApi.reviewEditRequest(reviewId, {
        requestId: reviewId,
        action: reviewAction,
        reviewNote: reviewNote.trim() || undefined,
      });
      toast.success(reviewAction === 'approve' ? '已同意申请' : '已拒绝申请');
      setReviewId(null);
      fetchList();
    } catch (e) {
      toast.error('操作失败');
      logger.error(e);
    } finally { setReviewing(false); }
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
    <div className="mx-auto w-full max-w-5xl fade-in-up px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">协作管理</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">管理题集编辑申请与协作者权限</p>
        </div>
      </div>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="requests"><FileEdit className="mr-1.5 h-3.5 w-3.5" />编辑申请</TabsTrigger>
          <TabsTrigger value="banks"><Users className="mr-1.5 h-3.5 w-3.5" />我的题集协作</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <Filter className="mr-2 h-3.5 w-3.5" />
                <SelectValue placeholder="审核状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待审核</SelectItem>
                <SelectItem value="approved">已同意</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />共 {total} 条
            </div>
          </div>

          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-16 text-center">
              <CheckCircle2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">暂无编辑申请</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{item.bankName}</span>
                        <Badge variant="outline" className="font-normal">编辑申请</Badge>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[item.status as EditRequestStatus]}`}>
                          {STATUS_LABEL[item.status as EditRequestStatus]}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-foreground/80">
                        <span className="text-muted-foreground">申请理由：</span>{item.reason || '(无)'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>申请人：{item.username}</span>
                        <span>申请时间：{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                      </div>
                      {item.reviewNote && <div className="mt-2 text-xs text-muted-foreground">审核意见：{item.reviewNote}</div>}
                    </div>
                    {item.status === 'pending' && (
                      <div className="flex shrink-0 flex-col gap-2">
                        <Button size="sm" className="text-xs" onClick={() => openReview(item.id, 'approve')}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />同意
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs text-destructive" onClick={() => openReview(item.id, 'reject')}>
                          <XCircle className="mr-1 h-3.5 w-3.5" />拒绝
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
        </TabsContent>

        <TabsContent value="banks">
          <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-16 text-center">
            <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">我的题集协作功能开发中</p>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewId} onOpenChange={(open) => !open && setReviewId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{reviewAction === 'approve' ? '同意编辑申请' : '拒绝编辑申请'}</DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve' ? '同意后申请人将获得该题集的编辑权限' : '拒绝后申请人无法编辑该题集'}
            </DialogDescription>
          </DialogHeader>
          <Textarea placeholder="填写审核意见（可选）..." value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReviewId(null)} disabled={reviewing}>取消</Button>
            <Button size="sm" variant={reviewAction === 'approve' ? 'default' : 'destructive'} onClick={handleReview} disabled={reviewing}>
              {reviewing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              确认{reviewAction === 'approve' ? '同意' : '拒绝'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CollaborationManagePage;
