import { useState, useEffect, useCallback } from 'react';
import { Link } from '@client/src/utils/router';
import {
  Plus,
  Pencil,
  Trash2,
  Folder,
  Hash,
  Loader2,
  Sparkles,
  BookOpen,
} from 'lucide-react';
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
import { TAG_COLORS, getTagColor } from '@client/src/components/TagChip';

import { subjectApi } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import type { SubjectItem } from '@shared/api.interface';

const SubjectsPage = () => {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<SubjectItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('blue');
  const [submitting, setSubmitting] = useState(false);
  const { isRealUser } = useAuth();

  const loadSubjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await subjectApi.listSubjects();
      setSubjects(res.items);
    } catch (error) {
      logger.error('加载科目列表失败', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isRealUser) {
      loadSubjects();
    }
  }, [loadSubjects, isRealUser]);

  const openCreateDialog = () => {
    setFormName('');
    setFormColor('blue');
    setCreateOpen(true);
  };

  const openEditDialog = (subject: SubjectItem) => {
    setEditingSubject(subject);
    setFormName(subject.name);
    setFormColor(subject.color);
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('请输入科目名称');
      return;
    }
    try {
      setSubmitting(true);
      await subjectApi.createSubject({
        name: formName.trim(),
        color: formColor,
      });
      toast.success('科目创建成功');
      setCreateOpen(false);
      loadSubjects();
    } catch (error) {
      logger.error('创建科目失败', error);
      toast.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingSubject || !formName.trim()) {
      toast.error('请输入科目名称');
      return;
    }
    try {
      setSubmitting(true);
      await subjectApi.updateSubject(editingSubject.id, {
        name: formName.trim(),
        color: formColor,
      });
      toast.success('科目已更新');
      setEditingSubject(null);
      loadSubjects();
    } catch (error) {
      logger.error('更新科目失败', error);
      toast.error('更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSubject) return;
    try {
      setIsDeleting(true);
      await subjectApi.deleteSubject(deletingSubject.id);
      toast.success('科目已删除');
      setDeletingSubject(null);
      loadSubjects();
    } catch (error) {
      logger.error('删除科目失败', error);
      toast.error('删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Folder className="h-3.5 w-3.5" />
            学科分类
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">科目管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            通过科目分类整理题集，按学科快速筛选练习
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openCreateDialog}
              className="gap-1.5 shadow-[0_4px_20px_hsl(265_85%_65%_/_0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_hsl(265_85%_65%_/_0.35)]"
            >
              <Plus className="h-4 w-4" />
              新建科目
            </Button>
          </DialogTrigger>
          <SubjectFormDialogContent
            title="新建科目"
            description="创建一个新的科目，用于分类整理题集。"
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
      ) : subjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center card-hover">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent shadow-sm">
            <BookOpen className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground">还没有科目</h3>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            点击新建科目开始整理你的题集，按学科分类更清晰
          </p>
          <Button
            onClick={openCreateDialog}
            className="mt-5 gap-1.5 shadow-[0_4px_16px_hsl(265_85%_65%_/_0.25)] transition-all duration-200 hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            新建科目
          </Button>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            学科分类，系统学习
          </div>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-ai-section-type="card-menu"
        >
          {subjects.map((subject) => {
            const colorCfg = getTagColor(subject.color);
            return (
              <Card
                key={subject.id}
                className="card-hover group rounded-xl border border-border/60 shadow-sm overflow-hidden"
              >
                <div className={`h-1 w-full ${colorCfg.dot}`} />
                <CardContent className="p-5">
                  <Link
                    to={`/banks?subjectId=${subject.id}`}
                    className="block"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorCfg.bg} shadow-sm`}>
                            <Folder className={`h-5 w-5 ${colorCfg.text}`} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-semibold text-foreground truncate">
                              {subject.name}
                            </h3>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground tabular-nums">
                              <Hash className="h-3 w-3" />
                              {subject.bankCount ?? 0} 个题集
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="mt-4 flex items-center justify-end gap-1 pt-3 border-t border-border/40 opacity-70 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(subject)}
                      className="h-8 gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingSubject(subject)}
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

      <Dialog
        open={!!editingSubject}
        onOpenChange={(v) => !v && setEditingSubject(null)}
      >
        <SubjectFormDialogContent
          title="编辑科目"
          description="修改科目的名称和颜色。"
          name={formName}
          color={formColor}
          onNameChange={setFormName}
          onColorChange={setFormColor}
          onSubmit={handleUpdate}
          submitting={submitting}
        />
      </Dialog>

      <AlertDialog
        open={!!deletingSubject}
        onOpenChange={(v) => !v && setDeletingSubject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除科目</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除科目「{deletingSubject?.name}」吗？
              删除后该科目下的所有题集将变为未分类，此操作不可撤销。
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

function SubjectFormDialogContent({
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
  const colorCfg = getTagColor(color);
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="subject-name">科目名称</Label>
            <Input
              id="subject-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="请输入科目名称"
              autoFocus
              className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label>科目颜色</Label>
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
          <div className="flex items-center justify-center py-3 rounded-xl bg-muted/50">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${colorCfg.bg} ${colorCfg.text}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${colorCfg.dot}`} />
              {name || '科目预览'}
            </span>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          type="button"
          onClick={() => onSubmit()}
          disabled={submitting}
        >
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

export default SubjectsPage;
