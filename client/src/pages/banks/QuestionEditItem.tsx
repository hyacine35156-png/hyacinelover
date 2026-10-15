import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
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

import { questionBankApi } from '@client/src/api';
import type { QuestionItem } from '@shared/api.interface';
import { EditQuestionDialog } from './QuestionEditDialogs';

export function QuestionEditItem({
  bankId,
  index,
  question,
  onChanged,
}: {
  bankId: string;
  index: number;
  question: QuestionItem;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      await questionBankApi.deleteQuestion(bankId, question.id);
      toast.success('题目已删除');
      setDeleting(false);
      onChanged();
    } catch (error) {
      logger.error('删除题目失败', error);
      toast.error('删除失败');
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
              {index}
            </span>
             <span className="text-xs text-muted-foreground">
                {question.questionType === 'b1'
                  ? 'B1型题'
                  : question.questionType === 'single'
                    ? 'A1型题'
                    : 'X型题'}
             </span>
          </div>
          <p className="mt-1 text-sm text-foreground line-clamp-2">{question.content}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog open={deleting} onOpenChange={setDeleting}>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除题目</AlertDialogTitle>
                <AlertDialogDescription>
                  删除后将无法恢复。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <EditQuestionDialog
        bankId={bankId}
        question={question}
        open={editing}
        onOpenChange={setEditing}
        onSuccess={() => {
          setEditing(false);
          onChanged();
        }}
      />
    </div>
  );
}
