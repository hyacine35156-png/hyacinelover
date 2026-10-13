import { useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@client/src/components/ui/alert-dialog';
import { Switch } from '@client/src/components/ui/switch';
import { Label } from '@client/src/components/ui/label';

import { questionBankApi, questionApi } from '@client/src/api';
import type { QuestionItem } from '@shared/api.interface';
import { useQuestionForm, QuestionForm } from './QuestionForm';

export function EditQuestionDialog({
  bankId,
  question,
  open,
  onOpenChange,
  onSuccess,
}: {
  bankId: string;
  question: QuestionItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const form = useQuestionForm(question);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (confirm = false) => {
    const err = form.validate();
    if (err) {
      toast.error(err);
      return;
    }
    try {
      setSubmitting(true);
      const result = await questionApi.updateQuestion(question.id, {
        ...form.getPayload(),
        confirm,
      });
      if (result.hasAnswerRecords && !confirm) {
        setConfirmDialogOpen(true);
        return;
      }
      toast.success('题目已更新');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      logger.error('更新题目失败', error);
      toast.error('更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSave = () => {
    setConfirmDialogOpen(false);
    handleSubmit(true);
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await questionApi.deleteQuestion(question.id);
      toast.success('题目已删除');
      setDeleteConfirmOpen(false);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      logger.error('删除题目失败', error);
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑题目</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <QuestionForm form={form} />
        </DialogBody>
        <DialogFooter className="justify-between">
          <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="mr-1 h-4 w-4" />
                删除题目
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  确定删除该题目？删除后不可恢复，相关作答记录也将删除。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleting}
                >
                  {deleting ? '删除中...' : '确认删除'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={submitting}>
              {submitting ? '保存中...' : '保存修改'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认修改</AlertDialogTitle>
            <AlertDialogDescription>
              该题目已有作答记录，修改可能影响已有统计数据，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDialogOpen(false)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave}>
              确认修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

export function AddQuestionDialog({
  bankId,
  open,
  onOpenChange,
  onSuccess,
}: {
  bankId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const form = useQuestionForm();
  const [submitting, setSubmitting] = useState(false);
  const [keepAdding, setKeepAdding] = useState(false);

  const handleSubmit = async () => {
    const err = form.validate();
    if (err) {
      toast.error(err);
      return;
    }
    try {
      setSubmitting(true);
      await questionBankApi.addQuestion(bankId, form.getPayload());
      toast.success('添加成功');
      onSuccess();
      if (!keepAdding) {
        onOpenChange(false);
      } else {
        form.setContent('');
        form.setAnalysis('');
        form.setKnowledgePoints('');
        form.setUnitName('');
        form.setCorrectAnswers([]);
      }
    } catch (error) {
      logger.error('添加题目失败', error);
      toast.error('添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增题目</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <QuestionForm form={form} />
        </DialogBody>
        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Switch
              id="keep-adding"
              checked={keepAdding}
              onCheckedChange={setKeepAdding}
            />
            <Label htmlFor="keep-adding" className="text-sm">
              继续添加模式
            </Label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '添加中...' : '添加题目'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
