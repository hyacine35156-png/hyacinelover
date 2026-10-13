import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Textarea } from '@client/src/components/ui/textarea';
import { Input } from '@client/src/components/ui/input';
import { safeGetItem, safeSetItem } from '@client/src/utils/env';
import {
  getErrorBuffer,
  reportError,
} from '@client/src/utils/error-monitor';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

const FEEDBACK_STORAGE_KEY = 'app_feedback_list';
const MAX_FEEDBACK_COUNT = 50;

type FeedbackCategory = 'bug' | 'suggestion' | 'other';

interface FeedbackItem {
  id: string;
  content: string;
  contact: string;
  category: FeedbackCategory;
  timestamp: number;
  userAgent: string;
  path: string;
  user: string;
  logs: unknown[];
}

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryOptions: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: '🐛 错误反馈' },
  { value: 'suggestion', label: '💡 功能建议' },
  { value: 'other', label: '📝 其他' },
];

const FeedbackDialog = ({ open, onOpenChange }: FeedbackDialogProps) => {
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    if (!content.trim()) {
      toast.warning('请输入问题描述');
      return;
    }

    setSubmitting(true);

    try {
      const raw = safeGetItem(FEEDBACK_STORAGE_KEY);
      const list: FeedbackItem[] = raw ? JSON.parse(raw) : [];

      const errorBuffer = getErrorBuffer();
      const recentErrors = errorBuffer.slice(-5);
      const errorLogsText = recentErrors.length > 0
        ? recentErrors
            .map(
              (e) => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.source}: ${e.message.substring(0, 200)}`,
            )
            .join('\n')
        : undefined;

      const item: FeedbackItem = {
        id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        content: content.trim(),
        contact: contact.trim(),
        category,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        path: window.location.pathname + window.location.search,
        user: '',
        logs: errorBuffer,
      };

      list.push(item);

      if (list.length > MAX_FEEDBACK_COUNT) {
        list.splice(0, list.length - MAX_FEEDBACK_COUNT);
      }

      safeSetItem(FEEDBACK_STORAGE_KEY, JSON.stringify(list));

      const feedbackContent = `${contact ? `联系方式: ${contact}\n` : ''}${content}`;
      const feedbackTypeMap: Record<FeedbackCategory, string> = {
        bug: 'bug',
        suggestion: 'suggestion',
        other: 'feedback_general',
      };
      reportError(
        {
          message: `[${categoryOptions.find((o) => o.value === category)?.label ?? '反馈'}] ${content.substring(0, 200)}`,
          stack: errorLogsText,
          type: 'react',
          userFeedback: feedbackContent,
          feedbackCategory: feedbackTypeMap[category],
        } as any,
        { force: true },
      );

      setContent('');
      setContact('');
      setCategory('bug');
      onOpenChange(false);
      toast.success('感谢反馈！我们会尽快处理');
    } catch (err) {
      toast.error('提交失败，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = (): void => {
    setContent('');
    setContact('');
    setCategory('bug');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl border border-border/60 bg-card shadow-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
             意见反馈
           </DialogTitle>
           <DialogDescription className="text-sm text-muted-foreground">
             遇到任何问题或建议请告诉我们，我们会尽快处理
           </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">反馈类型</p>
            <div className="flex gap-2">
              {categoryOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value)}
                  className={`flex-1 px-2 py-2 text-sm rounded-lg transition-colors ${
                    category === opt.value
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-accent/30 text-muted-foreground border border-border/60 hover:bg-accent/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                category === 'bug'
                  ? '请描述您遇到的错误，包括操作步骤、出现的问题...'
                  : '请描述您的反馈内容...'
              }
              rows={5}
              className="resize-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="联系方式（选填）"
              className="rounded-xl focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50"
            />
          </div>
           {category === 'bug' && (
             <p className="text-xs text-muted-foreground">
               💡 提交时会附带最近的错误日志，帮助我们快速定位问题
             </p>
           )}
           <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
             <p className="text-xs text-muted-foreground">
               📮 如有疑问可联系作者：
               <UniversalLink
                 to="mailto:1691917356@qq.com"
                 className="ml-1 font-medium text-primary hover:underline"
               >
                 1691917356@qq.com
               </UniversalLink>
             </p>
           </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={submitting}
            className="rounded-xl"
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="rounded-xl bg-gradient-to-br from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/35"
          >
            {submitting ? '提交中...' : '提交反馈'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackDialog;
