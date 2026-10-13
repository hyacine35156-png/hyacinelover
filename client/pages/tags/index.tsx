import { useState, useEffect, useCallback } from 'react';
import { Link } from '@client/src/utils/router';
import { Plus, Pencil, Trash2, Calendar, Hash, Loader2, Sparkles } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { Card, CardContent } from '@client/src/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import { TagChip, TAG_COLORS, getTagColor } from '@client/src/components/TagChip';
import { questionTagApi } from '@client/src/api';
import type { QuestionTagItem } from '@shared/api.interface';

const TagsPage = () => {
  const [tags, setTags] = useState<QuestionTagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const [editingTag, setEditingTag] = useState<QuestionTagItem | null>(null);
  const [deletingTag, setDeletingTag] = useState<QuestionTagItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('blue');
  const [submitting, setSubmitting] = useState(false);

  const loadTags = useCallback(async () => {
    try {
      setLoading(true);
      const res = await questionTagApi.listTags();
      setTags(res.items);
    } catch (error) {
      logger.error('加载标签列表失败', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const openCreateDialog = () => {
    setFormName('');
    setFormColor('blue');
    setCreateOpen(true);
  };

  const openEditDialog = (tag: QuestionTagItem) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormColor(tag.color);
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('请输入标签名称');
      return;
    }
    try {
      setSubmitting(true);
      await questionTagApi.createTag({
        name: formName.trim(),
        color: formColor,
        labelType: 'private',
      });
      toast.success('标签创建成功');
      setCreateOpen(false);
      loadTags();
    } catch (error) {
      logger.error('创建标签失败', error);
      toast.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingTag || !formName.trim()) {
      toast.error('请输入标签名称');
      return;
    }
    try {
      setSubmitting(true);
      await questionTagApi.updateTag(editingTag.id, {
        name: formName.trim(),
        color: formColor,
        labelType: 'private',
      });
      toast.success('标签已更新');
      setEditingTag(null);
      loadTags();
    } catch (error) {
      logger.error('更新标签失败', error);
      toast.error('更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTag) return;
    try {
      setIsDeleting(true);
      await questionTagApi.deleteTag(deletingTag.id);
      toast.success('标签已删除');
      setDeletingTag(null);
      loadTags();
    } catch (error) {
      logger.error('删除标签失败', error);
      toast.error('删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-info/10 px-3 py-1 text-xs font-medium text-info">
            <Hash className="h-3.5 w-3.5" />
            标签体系
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">标签管理</h1>
<p className="mt-1 text-sm text-muted-foreground wallpaper-text-muted">
             通过标签分类整理题目，按主题快速筛选练习
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openCreateDialog}
              className="gap-1.5 shadow-[0_4px_20px_hsl(265_85%_65%_/_0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_hsl(265_85%_65%_/_0.35)]"
            >
              <Plus className="h-4 w-4" />
              新建标签
            </Button>
          </DialogTrigger>
          <TagFormDialogContent
            title="新建标签"
            description="创建一个新的标签，用于分类整理题目。"
            name={formName}
            color={formColor}
            onNameChange={setFormName}
            onColorChange={setFormColor}
            onSubmit={handleCreate}
            submitting={submitting}
          />
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center card-hover">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent shadow-sm">
            <Hash className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground">还没有标签</h3>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            点击新建标签开始整理你的题目，按主题分类更高效
          </p>
          <Button
            onClick={openCreateDialog}
            className="mt-5 gap-1.5 shadow-[0_4px_16px_hsl(265_85%_65%_/_0.25)] transition-all duration-200 hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            新建标签
          </Button>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            分类标签，精准练习
          </div>
        </div>
      ) : (
            <div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              data-ai-section-type="card-menu"
            >
              {tags.map((tag) => {
                const colorCfg = getTagColor(tag.color);
                return (
                  <Card
                    key={tag.id}
                    className="card-hover group rounded-xl border border-border/60 shadow-sm overflow-hidden"
                  >
                    <div className={`h-1 w-full ${colorCfg.dot}`} />
                    <CardContent className="p-5">
                      <Link
                        to={`/tags/${tag.id}`}
                        className="block"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorCfg.dot} shadow-sm`}
                              />
                              <h3 className="text-base font-semibold text-foreground truncate">
                                {tag.name}
                              </h3>
                            </div>
                            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1 rounded-full bg-accent/60 px-2.5 py-1 font-medium text-accent-foreground tabular-nums">
                                <Hash className="h-3 w-3" />
                                {tag.questionCount ?? 0} 道题
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(tag.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>

                      <div className="mt-4 flex items-center justify-end gap-1 pt-3 border-t border-border/40 opacity-70 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(tag)}
                          className="h-8 gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingTag(tag)}
                          className="h-8 gap-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
      )}

      <Dialog open={!!editingTag} onOpenChange={(v) => !v && setEditingTag(null)}>
        <TagFormDialogContent
          title="编辑标签"
          description="修改标签的名称和颜色。"
          name={formName}
          color={formColor}
          onNameChange={setFormName}
          onColorChange={setFormColor}
          onSubmit={handleUpdate}
          submitting={submitting}
        />
      </Dialog>

      <AlertDialog
        open={!!deletingTag}
        onOpenChange={(v) => !v && setDeletingTag(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除标签</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除标签「{deletingTag?.name}」吗？
              删除后所有题目的该标签将被移除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
             <AlertDialogAction
               onClick={handleDelete}
               disabled={isDeleting}
               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
             >
               {isDeleting ? '删除中...' : '删除'}
             </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function TagFormDialogContent({
  title,
  description,
  name,
  color,
  onNameChange,
  onColorChange,
  onSubmit,
  submitting,
}: {
  title: string;
  description: string;
  name: string;
  color: string;
  onNameChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="space-y-5">
          <div className="space-y-2">
          <Label htmlFor="tag-name">标签名称</Label>
          <Input
            id="tag-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="请输入标签名称"
            autoFocus
            className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/50"
          />
        </div>
        <div className="space-y-2">
          <Label>标签颜色</Label>
          <div className="flex flex-wrap gap-2.5">
            {TAG_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => onColorChange(c.name)}
                className={`h-8 w-8 rounded-full ${c.dot} transition-all duration-200 hover:scale-110 ${
                  color === c.name
                    ? `ring-2 ring-offset-2 ${c.ring} scale-110 shadow-md`
                    : 'opacity-60 hover:opacity-100'
                }`}
                aria-label={`选择${c.name}色`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center py-2 rounded-xl bg-muted/50">
          <TagChip tag={{ name: name || '标签预览', color }} size="md" />
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={() => onSubmit()} disabled={submitting}>
          取消
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitting || !name.trim()}
          className="gap-2 shadow-[0_4px_16px_hsl(265_85%_65%_/_0.25)] transition-all duration-200 hover:-translate-y-0.5"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          确定
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default TagsPage;
