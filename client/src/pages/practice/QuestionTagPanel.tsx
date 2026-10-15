import { useState, useEffect } from 'react';
import { Tag as TagIcon, Plus } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { TagChip } from '@client/src/components/TagChip';
import { TagSelectorDialog } from '@client/src/components/TagSelectorDialog';

import { questionTagApi } from '@client/src/api';
import type { QuestionTagItem } from '@shared/api.interface';

interface QuestionTagPanelProps {
  questionId: string;
}

export function QuestionTagPanel({ questionId }: QuestionTagPanelProps) {
  const [tags, setTags] = useState<QuestionTagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!questionId) return;
    loadTags();
  }, [questionId]);

  const loadTags = async () => {
    try {
      setLoading(true);
      const res = await questionTagApi.getQuestionTags(questionId);
      setTags(res.items);
    } catch (error) {
      logger.error('加载题目标签失败', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await questionTagApi.removeTagFromQuestion(questionId, tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      toast.success('已移除标签');
    } catch (error) {
      logger.error('移除标签失败', error);
      toast.error('操作失败');
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <TagIcon className="h-3.5 w-3.5" />
          题目标签
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="h-7 gap-1 rounded-full px-3 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          管理标签
        </Button>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">加载中...</p>
      ) : tags.length === 0 ? (
        <p className="rounded-full bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          暂无标签，点击「管理标签」添加
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <TagChip key={t.id} tag={t} onRemove={() => handleRemoveTag(t.id)} />
          ))}
        </div>
      )}

      <TagSelectorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        questionId={questionId}
        initialTags={tags}
        onTagsUpdated={setTags}
      />
    </div>
  );
}

export default QuestionTagPanel;
