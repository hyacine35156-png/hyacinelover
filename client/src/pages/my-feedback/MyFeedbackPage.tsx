import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { MessageCircle, Clock, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { Spinner } from '@client/src/components/ui/spinner';
import { adminFeedbackApi } from '@client/src/api';
import type {
  MyFeedbackItem,
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

const MyFeedbackPage = () => {
  const [items, setItems] = useState<MyFeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFeedbackApi.getMyFeedbackList({ page, pageSize });
      setItems(res.items);
      setTotal(res.total);
    } catch (error) {
      toast.error('加载失败');
      logger.error(error);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto w-full max-w-2xl fade-in-up px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            我的反馈
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            查看你提交的反馈和处理进度
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-16 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">还没有提交过反馈</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              遇到问题或有建议随时告诉我们
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-xl border border-border/60 bg-card transition-all duration-200 hover:border-primary/30"
            >
              <button
                type="button"
                className="w-full p-4 text-left"
                onClick={() =>
                  setExpandedId((prev) => (prev === item.id ? null : item.id))
                }
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {SOURCE_LABEL[item.source]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {FEEDBACK_TYPE_LABELS[item.feedbackType] || item.feedbackType}
                  </span>
                  <span
                    className={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[item.status]}`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-foreground">
                  {item.content || '(无内容)'}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </div>
              </button>

              {expandedId === item.id && (
                <div className="border-t border-border/60 bg-muted/20 p-4">
                  <div className="mb-3">
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      反馈内容
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-foreground">
                      {item.content || '(无内容)'}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      管理员回复
                    </div>
                    {item.adminReply ? (
                      <div className="whitespace-pre-wrap rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
                        {item.adminReply}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">
                        暂无回复
                      </div>
                    )}
                  </div>
                  {item.handledAt && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      处理时间：{new Date(item.handledAt).toLocaleString('zh-CN')}
                    </div>
                  )}
                </div>
              )}
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
    </div>
  );
};

export default MyFeedbackPage;
