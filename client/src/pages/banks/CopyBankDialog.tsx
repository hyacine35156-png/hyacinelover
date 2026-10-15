import { useState, useCallback } from 'react';
import { useNavigate } from '@client/src/utils/router';
import { Copy, Loader2 } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';

import { questionBankApi, subjectApi } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import type { QuestionBankItem, SubjectItem } from '@shared/api.interface';

interface CopyBankDialogProps {
  bank: QuestionBankItem;
  onSuccess?: () => void;
  triggerVariant?: 'default' | 'outline' | 'secondary' | 'ghost';
}

const CopyBankDialog = ({
  bank,
  onSuccess,
  triggerVariant = 'secondary',
}: CopyBankDialogProps) => {
  const [open, setOpen] = useState(false);
  const [targetName, setTargetName] = useState('');
  const [targetSubjectId, setTargetSubjectId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { isRealUser, isGuest } = useAuth();

  const loadSubjects = useCallback(async () => {
    if (!isRealUser) return;
    try {
      setLoading(true);
      const res = await subjectApi.listSubjects();
      setSubjects(res.items);
    } catch (error) {
      logger.error('加载科目列表失败', error);
    } finally {
      setLoading(false);
    }
  }, [isRealUser]);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) {
      setTargetName(`${bank.name}（副本）`);
      setTargetSubjectId(bank.subjectId ?? null);
      loadSubjects();
    }
  };

  const handleCopy = async () => {
    if (isGuest) {
      toast.info('请登录后使用复制功能');
      return;
    }
    if (!targetName.trim()) {
      toast.error('请输入新题集名称');
      return;
    }
    try {
      setSubmitting(true);
      const res = await questionBankApi.copyBank(bank.id, {
        targetName: targetName.trim(),
        targetSubjectId: targetSubjectId || undefined,
      });
      toast.success(`已复制到「${res.name}」`, {
        action: {
          label: '去查看',
          onClick: () => navigate(`/practice/${res.id}`),
        },
      });
      setOpen(false);
      onSuccess?.();
    } catch (error) {
       logger.error('复制题集失败', error);
      toast.error('复制失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          size="sm"
          className="w-full gap-1.5 h-10 min-h-[40px]"
        >
          <Copy className="h-4 w-4" />
          复制到我的题集
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>复制题集</DialogTitle>
          <DialogDescription>
            将「{bank.name}」复制为你的私有题集
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="copy-name">新题集名称</Label>
              <Input
                id="copy-name"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="copy-subject">所属科目（可选）</Label>
              <Select
                value={targetSubjectId ?? ''}
                onValueChange={(v) => setTargetSubjectId(v || null)}
                disabled={loading}
              >
                <SelectTrigger id="copy-subject">
                  <SelectValue placeholder="未分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">未分类</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleCopy} disabled={submitting || !targetName.trim()}
            style={{
              background:
                'linear-gradient(135deg, hsl(265 85% 65%) 0%, hsl(290 75% 65%) 100%)',
              boxShadow: '0 2px 8px -2px hsl(265 85% 65% / 0.3)',
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                复制中
              </>
            ) : (
              '确认复制'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CopyBankDialog;
