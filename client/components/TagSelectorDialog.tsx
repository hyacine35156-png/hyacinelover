import { useState, useEffect } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Label } from '@client/src/components/ui/label';
import { TagChip, TAG_COLORS, getTagColor } from '@client/src/components/TagChip';

import { questionTagApi } from '@client/src/api';
import type { QuestionTagItem } from '@shared/api.interface';

interface TagSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string;
  initialTags: QuestionTagItem[];
  onTagsUpdated?: (tags: QuestionTagItem[]) => void;
}

export function TagSelectorDialog({
  open,
  onOpenChange,
  questionId,
  initialTags,
  onTagsUpdated,
}: TagSelectorDialogProps) {
  const [allTags, setAllTags] = useState<QuestionTagItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('blue');
  const [creating, setCreating] = useState(false);
  const [showNewTag, setShowNewTag] = useState(false);

  useEffect(() => {
    if (open) {
      // Initialize selected ids from initialTags immediately
      setSelectedIds(initialTags.map((t: QuestionTagItem) => t.id));
      loadAllTags();
    }
  }, [open]);

  const loadAllTags = async () => {
    try {
      setLoading(true);
      const res = await questionTagApi.listTags();
      setAllTags(res.items);
    } catch (error) {
      logger.error('加载标签列表失败', error);
      toast.error('加载标签失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTag = (tagId: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, tagId] : prev.filter((id) => id !== tagId),
    );
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('请输入标签名称');
      return;
    }
    try {
      setCreating(true);
      const newTag = await questionTagApi.createTag({
        name: newTagName.trim(),
        color: newTagColor,
        labelType: 'private',
      });
      setAllTags((prev) => [newTag, ...prev]);
      setSelectedIds((prev) => [...prev, newTag.id]);
      setNewTagName('');
      setShowNewTag(false);
      toast.success('标签创建成功');
    } catch (error: any) {
      logger.error('创建标签失败', error);
      const msg = error?.response?.data?.message || error?.message || '创建失败';
      toast.error(`创建失败：${msg}`);
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await questionTagApi.setQuestionTags(questionId, selectedIds);
      toast.success('标签已更新');
      onTagsUpdated?.(res.tags);
      onOpenChange(false);
    } catch (error: any) {
      logger.error('保存标签失败', error);
      const msg = error?.response?.data?.message || error?.message || '保存失败';
      toast.error(`保存失败：${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setShowNewTag(false);
    setNewTagName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>管理标签</DialogTitle>
          <DialogDescription>
            为该题目添加或移除标签，便于分类整理和快速查找。
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">所有标签</span>
                <span className="text-xs text-muted-foreground">
                  已选 {selectedIds.length} 个
                </span>
              </div>

              <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : allTags.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    还没有标签，点击下方新建
                  </p>
                ) : (
                   allTags.map((tag) => {
                     const colorCfg = getTagColor(tag.color);
                     const checked = selectedIds.includes(tag.id);
                     return (
                       <div
                         key={tag.id}
                         className={`flex items-center gap-3 rounded-md px-2 py-2 transition-colors ${
                           checked ? 'bg-accent/40' : 'hover:bg-accent/30'
                         }`}
                       >
                         <Checkbox
                           id={`tag-check-${tag.id}`}
                           checked={checked}
                           onCheckedChange={(val) =>
                             handleToggleTag(tag.id, Boolean(val))
                           }
                         />
                         <label
                           htmlFor={`tag-check-${tag.id}`}
                           className="flex flex-1 cursor-pointer items-center gap-2 text-sm"
                         >
                           <span
                             className={`h-2.5 w-2.5 rounded-full ${colorCfg.dot}`}
                           />
                           <span className="text-foreground">{tag.name}</span>
                         </label>
                         {tag.questionCount !== undefined && (
                           <span className="text-xs text-muted-foreground">
                             {tag.questionCount} 题
                           </span>
                         )}
                       </div>
                     );
                   })
                )}
              </div>
            </div>

            {showNewTag ? (
              <div className="space-y-3 rounded-lg border border-border bg-accent/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    新建标签
                  </span>
                   <button
                     type="button"
                     onClick={() => {
                       setShowNewTag(false);
                       setNewTagName('');
                     }}
                     className="text-muted-foreground hover:text-foreground"
                   >
                    <Plus className="h-4 w-4 rotate-45" />
                  </button>
                </div>
                <div className="space-y-2">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="输入标签名称"
                    className="text-sm"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                     <span className="text-xs text-muted-foreground">颜色：</span>
                     <div className="flex flex-wrap gap-1.5">
                       {TAG_COLORS.map((c) => (
                         <button
                           key={c.name}
                           type="button"
                           onClick={() => setNewTagColor(c.name)}
                           className={`h-6 w-6 rounded-full ${c.dot} transition-all ${
                             newTagColor === c.name
                               ? `ring-2 ring-offset-2 ${c.ring}`
                               : 'opacity-70 hover:opacity-100'
                           }`}
                           aria-label={`选择${c.name}色`}
                         />
                       ))}
                    </div>
                  </div>
                   <div className="flex items-center gap-2">
                     <TagChip tag={{ name: newTagName || '预览', color: newTagColor }} />
                    <Button
                     size="sm"
                     onClick={handleCreateTag}
                     disabled={creating || !newTagName.trim()}
                     className="gap-1"
                   >
                     {creating ? (
                       <Loader2 className="h-3.5 w-3.5 animate-spin" />
                     ) : (
                       <Check className="h-3.5 w-3.5" />
                     )}
                     创建
                   </Button>
                 </div>
               </div>
             </div>
           ) : (
             <Button
               variant="outline"
               size="sm"
               onClick={() => setShowNewTag(true)}
               className="w-full gap-1.5"
             >
               <Plus className="h-4 w-4" />
               新建标签
             </Button>
           )}
          </div>
        </DialogBody>

        <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TagSelectorDialog;
