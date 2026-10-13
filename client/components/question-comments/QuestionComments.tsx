import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Trash2,
  Send,
  Loader2,
  LogIn,
  Globe2,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { questionBankApi } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import { useNavigate } from '@client/src/utils/router';
import type { QuestionCommentItem } from '@shared/api.interface';
import { toast } from 'sonner';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface QuestionCommentsProps {
  questionId: string;
  collapsed?: boolean;
}

const AVATAR_COLORS = [
  'from-purple-500 to-pink-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-orange-500 to-red-500',
  'from-indigo-500 to-purple-500',
  'from-pink-500 to-rose-500',
  'from-teal-500 to-green-500',
  'from-amber-500 to-orange-500',
];

function getAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i += 1) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(username: string): string {
  if (!username) return '?';
  return username.charAt(0).toUpperCase();
}

function formatTimeAgo(dateStr: string): string {
  const now = dayjs();
  const target = dayjs(dateStr);
  const diffMinutes = now.diff(target, 'minute');

  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;

  const diffHours = now.diff(target, 'hour');
  if (diffHours < 24) return `${diffHours}小时前`;

  const diffDays = now.diff(target, 'day');
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;

  return target.format('YYYY-MM-DD');
}

const QuestionComments = ({
  questionId,
  collapsed: initialCollapsed = false,
}: QuestionCommentsProps) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [comments, setComments] = useState<QuestionCommentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const loadedRef = useRef(false);

  const { user, isRealUser } = useAuth();
  const navigate = useNavigate();

  const currentUserId = user?.id;

  const loadComments = useCallback(async () => {
    if (!questionId) return;
    try {
      setLoading(true);
      const res = await questionBankApi.getQuestionComments(questionId, 10);
      const items = res.items.map((item) => ({
        ...item,
        canDelete: isRealUser && item.userId === currentUserId,
      }));
      setComments(items);
      setTotal(res.total);
      setHasMore(res.hasMore);
      setNextCursor(res.nextCursor);
      loadedRef.current = true;
    } catch (error) {
      logger.error('加载评论失败', error);
      toast.error('加载评论失败');
    } finally {
      setLoading(false);
    }
  }, [questionId, isRealUser, currentUserId]);

  useEffect(() => {
    if (!isCollapsed && !loadedRef.current) {
      loadComments();
    }
  }, [isCollapsed, loadComments]);

  // 切换题目时重置状态
  useEffect(() => {
    setComments([]);
    setTotal(0);
    setHasMore(false);
    setNextCursor(undefined);
    setContent('');
    loadedRef.current = false;
    if (!isCollapsed) {
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  const handleToggle = () => {
    setIsCollapsed((prev) => !prev);
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    try {
      setLoadingMore(true);
      const res = await questionBankApi.getQuestionComments(
        questionId,
        10,
        nextCursor,
      );
      const items = res.items.map((item) => ({
        ...item,
        canDelete: isRealUser && item.userId === currentUserId,
      }));
      setComments((prev) => [...prev, ...items]);
      setHasMore(res.hasMore);
      setNextCursor(res.nextCursor);
    } catch (error) {
      logger.error('加载更多评论失败', error);
      toast.error('加载更多失败');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    if (trimmed.length > 1000) {
      toast.error('评论内容不能超过1000字');
      return;
    }

    try {
      setSubmitting(true);
      const res = await questionBankApi.createQuestionComment(
        questionId,
        trimmed,
      );

      const newComment: QuestionCommentItem = {
        id: res.id,
        questionId,
        userId: currentUserId!,
        username: user!.username,
        content: trimmed,
        createdAt: new Date().toISOString(),
        canDelete: true,
      };

      setComments((prev) => [newComment, ...prev]);
      setTotal((prev) => prev + 1);
      setContent('');
      toast.success('评论发表成功');
    } catch (error) {
      logger.error('发表评论失败', error);
      toast.error('发表评论失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (commentId: string) => {
    setDeletingId(commentId);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId || deleting) return;
    try {
      setDeleting(true);
      await questionBankApi.deleteQuestionComment(questionId, deletingId);
      setComments((prev) => prev.filter((c) => c.id !== deletingId));
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success('评论已删除');
      setDeleteConfirmOpen(false);
    } catch (error) {
      logger.error('删除评论失败', error);
      toast.error('删除失败');
    } finally {
      setDeleting(false);
      setDeletingId(null);
    }
  };

  const handleLoginClick = () => {
    navigate('/login', { state: { from: window.location.pathname } });
  };

  return (
    <div
      className="rounded-xl border border-border/60 bg-card shadow-sm"
      data-ai-section-type="card-list"
    >
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-accent/30 sm:px-5"
      >
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">评论</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Globe2 className="h-3 w-3" />
              全局
            </span>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {total}
            </span>
          </div>
        {isCollapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {!isCollapsed && (
        <div className="space-y-4 border-t border-border/60 px-4 py-4 sm:px-5">
          {/* 发表评论框 */}
          {isRealUser ? (
            <div className="space-y-2">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="写下你的评论..."
                className="min-h-[80px] w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                maxLength={1000}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {content.length}/1000
                </span>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!content.trim() || submitting}
                  className="h-8 gap-1 rounded-lg bg-gradient-to-r from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] text-xs font-medium text-white shadow-sm transition-all hover:brightness-105"
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  发表
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={handleLoginClick}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-accent-foreground"
            >
              <LogIn className="h-4 w-4" />
              登录后发表评论
            </div>
          )}

          {/* 评论列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : comments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              暂无评论，来发表第一条评论吧
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex gap-3 rounded-lg bg-muted/30 p-3"
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(
                      comment.username,
                    )} text-sm font-bold text-white shadow-sm`}
                  >
                    {getInitial(comment.username)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {comment.username}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(comment.createdAt)}
                        </span>
                      </div>
                      {comment.canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(comment.id)}
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label="删除评论"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 break-words text-sm leading-relaxed text-foreground/90">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}

              {hasMore && (
                <div className="pt-1 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="h-8 text-xs text-muted-foreground hover:text-accent-foreground"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        加载中...
                      </>
                    ) : (
                      '加载更多'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>确认删除评论</DialogTitle>
            <DialogDescription>
              删除后无法恢复，确定要删除这条评论吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="default"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  删除中
                </>
              ) : (
                '确认删除'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuestionComments;
