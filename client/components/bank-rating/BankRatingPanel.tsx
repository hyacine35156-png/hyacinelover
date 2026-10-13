import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Star, Trash2, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Textarea } from '@client/src/components/ui/textarea';
import { Spinner } from '@client/src/components/ui/spinner';
import { bankRatingApi } from '@client/src/api';
import type { BankRatingItem } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface BankRatingPanelProps {
  bankId: string;
  avgRating: number;
  ratingCount: number;
  userRating?: number;
  onRatingChanged?: () => void;
}

const StarRow = ({ value, size = 'h-5 w-5' }: { value: number; size?: string }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={`${size} ${
          i <= Math.round(value) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        }`}
      />
    ))}
  </div>
);

const BankRatingPanel = ({
  bankId,
  avgRating,
  ratingCount,
  userRating,
  onRatingChanged,
}: BankRatingPanelProps) => {
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(userRating ?? 0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [items, setItems] = useState<BankRatingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedRating(userRating ?? 0);
  }, [userRating]);

  const fetchRatings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bankRatingApi.getBankRatings(bankId, { page, pageSize });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      toast.error('加载评分列表失败');
      logger.error(e);
    } finally {
      setLoading(false);
    }
  }, [bankId, page]);

  useEffect(() => {
    fetchRatings();
  }, [fetchRatings]);

  const handleSubmit = async () => {
    if (selectedRating === 0) return toast.error('请选择评分星级');
    setSubmitting(true);
    try {
      await bankRatingApi.submitRating({
        bankId,
        rating: selectedRating,
        comment: comment.trim() || undefined,
      });
      toast.success('评分提交成功');
      setComment('');
      onRatingChanged?.();
      fetchRatings();
    } catch (e) {
      toast.error('提交失败');
      logger.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!userRating) return;
    setDeleting(true);
    try {
      await bankRatingApi.deleteRating(bankId);
      toast.success('已删除评分');
      setSelectedRating(0);
      onRatingChanged?.();
      fetchRatings();
    } catch (e) {
      toast.error('删除失败');
      logger.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const displayRating = hoverRating || selectedRating;

  return (
    <div className="space-y-5">
      {/* 评分概览 */}
      <div className="flex flex-col items-center gap-2 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-foreground">
            {avgRating > 0 ? avgRating.toFixed(1) : '--'}
          </div>
          <div>
            <StarRow value={avgRating} />
            <p className="mt-1 text-xs text-muted-foreground">共 {ratingCount} 人评价</p>
          </div>
        </div>
        {userRating ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>我的评分：{userRating} 星</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}
      </div>

      {/* 评分输入 */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">评分：</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                className="transition-transform hover:scale-110"
                onMouseEnter={() => setHoverRating(i)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setSelectedRating(i)}
              >
                <Star
                  className={`h-7 w-7 ${
                    i <= displayRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
          {selectedRating > 0 && <span className="text-sm text-muted-foreground">{selectedRating} 星</span>}
        </div>
        <Textarea
          placeholder="说说你的评价（可选）..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSubmit} disabled={submitting || selectedRating === 0}>
            {submitting && <Spinner className="mr-1.5 h-3.5 w-3.5" />}
            {userRating ? '更新评分' : '提交评分'}
          </Button>
        </div>
      </div>

      {/* 评论列表 */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">最新评价</h3>
          <span className="text-xs text-muted-foreground">({total})</span>
        </div>
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-10"><Spinner /></div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card py-10 text-center text-sm text-muted-foreground">
            暂无评价，快来抢沙发吧
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{item.username}</span>
                    <StarRow value={item.rating} size="h-3 w-3" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                {item.comment && <p className="mt-2 text-sm text-foreground/90">{item.comment}</p>}
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[80px] text-center text-xs text-muted-foreground">第 {page} / {totalPages} 页</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankRatingPanel;
