import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from '@client/src/utils/router';
import { Eye, Plus, Play, Repeat, Users, Star, History } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogTrigger,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Switch } from '@client/src/components/ui/switch';
import { Textarea } from '@client/src/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@client/src/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';

import { questionBankApi, subjectApi, bankCollaborationApi } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import type { QuestionBankItem, SubjectItem } from '@shared/api.interface';
import { QuestionPreview } from './QuestionPreview';
import { QuestionEditItem } from './QuestionEditItem';
import { AddQuestionDialog } from './QuestionEditDialogs';
import BankRatingPanel from '@client/src/components/bank-rating/BankRatingPanel';
import BatchReplaceDialog from './BatchReplaceDialog';
import VersionHistoryDialog from './VersionHistoryDialog';

interface BankDetailDialogProps {
  bank: QuestionBankItem;
  triggerVariant?: 'default' | 'outline' | 'ghost';
  onSuccess?: () => void;
}

const BankDetailDialog = ({
  bank,
  triggerVariant = 'outline',
  onSuccess,
}: BankDetailDialogProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bankName, setBankName] = useState(bank.name);
  const [bankSubjectId, setBankSubjectId] = useState<string | null>(
    bank.subjectId ?? null,
  );
  const [isPublic, setIsPublic] = useState(bank.isPublic ?? false);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [batchReplaceOpen, setBatchReplaceOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [requesting, setRequesting] = useState(false);
  const { isRealUser, isGuest, user } = useAuth();
  const isOwner = user?.username === bank.ownerUsername;

  const loadSubjects = useCallback(async () => {
    if (!isRealUser) return;
    try {
      const res = await subjectApi.listSubjects();
      setSubjects(res.items);
    } catch (error) {
      logger.error('加载科目列表失败', error);
    }
  }, [isRealUser]);

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const res = isGuest && bank.isPublic
        ? await questionBankApi.getPublicBankQuestions(bank.id)
        : await questionBankApi.getQuestions(bank.id);
      setQuestions(res.items);
    } catch (error) {
      logger.error('加载题目失败', error);
      toast.error('加载题目失败');
    } finally {
      setLoading(false);
    }
  }, [bank.id, bank.isPublic, isGuest]);

  useEffect(() => {
    if (open) {
      setBankName(bank.name);
      setBankSubjectId(bank.subjectId ?? null);
      setIsPublic(bank.isPublic ?? false);
      setActiveTab('preview');
      loadSubjects();
      loadQuestions();
    }
  }, [open, bank.id, bank.name, bank.subjectId, bank.isPublic, loadSubjects, loadQuestions]);

  const handleSaveBank = async () => {
    if (!bankName.trim()) {
      toast.error('题集名称不能为空');
      return;
    }
    try {
      setSaving(true);
      await questionBankApi.updateBank(bank.id, {
        name: bankName.trim(),
        subjectId: bankSubjectId,
        isPublic,
      });
      toast.success('题集已更新');
      onSuccess?.();
    } catch (error) {
      logger.error('更新题集失败', error);
      toast.error('更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handleQuestionChanged = () => {
    loadQuestions();
    onSuccess?.();
  };

  const handleSubmitRequest = async () => {
    if (!requestReason.trim()) {
      toast.error('请填写申请理由');
      return;
    }
    try {
      setRequesting(true);
      await bankCollaborationApi.submitEditRequest({
        bankId: bank.id,
        reason: requestReason.trim(),
      });
      toast.success('申请已提交，等待所有者审核');
      setRequestDialogOpen(false);
      setRequestReason('');
    } catch (error) {
      logger.error('提交编辑申请失败', error);
      toast.error('提交失败');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-primary hover:bg-primary/10 min-h-[44px]" title="预览题集">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader className="flex-row items-start justify-between gap-4">
          <DialogTitle className="text-lg pr-10">{bank.name}</DialogTitle>
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => {
              setOpen(false);
              navigate(`/practice/${bank.id}`);
            }}
            disabled={bank.questionCount === 0}
            style={{
              background:
                'linear-gradient(135deg, hsl(265 85% 65%) 0%, hsl(290 75% 65%) 100%)',
              boxShadow: '0 2px 8px -2px hsl(265 85% 65% / 0.3)',
            }}
          >
            <Play className="h-4 w-4" />
             开始练习
          </Button>
        </DialogHeader>

        <DialogBody className="!p-0 flex flex-col">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'preview' | 'edit')}
            className="flex h-full flex-col"
          >
            <TabsList className="mx-5 mt-4 shrink-0 sm:mx-6">
              <TabsTrigger value="preview">预览题目</TabsTrigger>
              {bank.isPublic && <TabsTrigger value="rating">评分评论</TabsTrigger>}
              {isRealUser && <TabsTrigger value="edit">编辑题集</TabsTrigger>}
            </TabsList>

            <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
              <TabsContent value="preview" className="mt-0">
                <QuestionPreview questions={questions} loading={loading} />

                {bank.isPublic && isRealUser && !isOwner && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRequestDialogOpen(true)}
                    >
                      <Users className="mr-1.5 h-4 w-4" />
                      申请编辑权限
                    </Button>
                  </div>
                )}
              </TabsContent>

              {bank.isPublic && (
                <TabsContent value="rating" className="mt-0">
                  <BankRatingPanel
                    bankId={bank.id}
                    avgRating={bank.avgRating || 0}
                    ratingCount={bank.ratingCount || 0}
                  />
                </TabsContent>
              )}

              <TabsContent value="edit" className="mt-0">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank-name">题集名称</Label>
                    <div className="flex gap-2">
                      <Input
                        id="bank-name"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSaveBank}
                        disabled={saving}
                        style={{
                          background:
                            'linear-gradient(135deg, hsl(265 85% 65%) 0%, hsl(290 75% 65%) 100%)',
                          boxShadow: '0 2px 8px -2px hsl(265 85% 65% / 0.3)',
                        }}
                      >
                        {saving ? '保存中...' : '保存'}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank-subject">所属科目</Label>
                    <Select
                      value={bankSubjectId ?? ''}
                      onValueChange={(v) => setBankSubjectId(v || null)}
                    >
                      <SelectTrigger id="bank-subject" className="w-full">
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
                    <p className="text-xs text-muted-foreground">
                       选择所属科目后可在题集列表中按科目筛选
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="bank-public" className="text-sm font-medium">
                           公开题集
                        </Label>
                        <p className="text-xs text-muted-foreground">
                           公开后所有用户都能看到和复制你的题集
                        </p>
                      </div>
                      <Switch
                        id="bank-public"
                        checked={isPublic}
                        onCheckedChange={setIsPublic}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                     <div className="flex items-center justify-between">
                       <Label>题目列表</Label>
                        {isRealUser && (
                          <div className="flex gap-2 flex-wrap justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setVersionHistoryOpen(true)}
                            >
                              <History className="mr-1 h-3 w-3" /> 版本历史
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBatchReplaceOpen(true)}
                            >
                              <Repeat className="mr-1 h-3 w-3" /> 批量替换
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAdding(true)}
                            >
                              <Plus className="mr-1 h-3 w-3" /> 新增题目
                            </Button>
                          </div>
                        )}
                     </div>

                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
                      </div>
                    ) : questions.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        暂无题目，点击上方按钮新增
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {questions.map((q, idx) => (
                          <QuestionEditItem
                            key={q.id}
                            bankId={bank.id}
                            index={idx + 1}
                            question={q}
                            onChanged={handleQuestionChanged}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogBody>

        <AddQuestionDialog
          bankId={bank.id}
          open={adding}
          onOpenChange={setAdding}
          onSuccess={handleQuestionChanged}
        />

        <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>申请编辑权限</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <p className="text-sm text-muted-foreground">
                 提交申请后，题集所有者会收到通知并审核您的编辑权限。
                 获得权限后，您可以编辑、添加和删除该题集的题目。
              </p>
              <div className="space-y-2">
                <Label>申请理由</Label>
                <Textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="请简要说明申请编辑的原因，例如：我是该科目老师、发现题目有误想帮忙修正等"
                  rows={3}
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSubmitRequest} disabled={requesting}>
                {requesting ? '提交中...' : '提交申请'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <BatchReplaceDialog
          bankId={bank.id}
          open={batchReplaceOpen}
          onOpenChange={setBatchReplaceOpen}
          onSuccess={handleQuestionChanged}
        />

        <VersionHistoryDialog
          bankId={bank.id}
          open={versionHistoryOpen}
          onOpenChange={setVersionHistoryOpen}
          canRollback={isOwner}
          onRollbackSuccess={handleQuestionChanged}
        />
      </DialogContent>
    </Dialog>
  );
};

export default BankDetailDialog;
