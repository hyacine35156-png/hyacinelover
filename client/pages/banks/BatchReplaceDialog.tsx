import { useState, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Search, Sparkles, Tag, AlertTriangle } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogBody, DialogFooter,
} from '@client/src/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Label } from '@client/src/components/ui/label';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@client/src/components/ui/tabs';
import { Badge } from '@client/src/components/ui/badge';

import { questionBankApi } from '@client/src/api';
import type {
  BatchReplaceRequest, BatchReplacePreviewResponse,
} from '@shared/api.interface';

interface BatchReplaceDialogProps {
  bankId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type TabValue = 'text' | 'analysis' | 'tags';

const BatchReplaceDialog: React.FC<BatchReplaceDialogProps> = ({
  bankId, open, onOpenChange, onSuccess,
}) => {
  const [tab, setTab] = useState<TabValue>('text');
  const [kpFilter, setKpFilter] = useState('');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [analysisTpl, setAnalysisTpl] = useState('');
  const [addTagsInput, setAddTagsInput] = useState('');
  const [removeTagsInput, setRemoveTagsInput] = useState('');
  const [preview, setPreview] = useState<BatchReplacePreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const buildDto = useCallback((): BatchReplaceRequest | null => {
    const dto: BatchReplaceRequest = {
      bankId, knowledgePoint: kpFilter.trim() || undefined,
    };
    if (tab === 'text') {
      if (!findText.trim()) return null;
      dto.replaceTextFrom = findText;
      dto.replaceTextTo = replaceText;
    } else if (tab === 'analysis') {
      if (!analysisTpl.trim()) return null;
      dto.analysisTemplate = analysisTpl;
    } else {
      const add = addTagsInput.split(',').map((s: string) => s.trim()).filter(Boolean);
      const remove = removeTagsInput.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (!add.length && !remove.length) return null;
      if (add.length) dto.addTags = add;
      if (remove.length) dto.removeTags = remove;
    }
    return dto;
  }, [bankId, kpFilter, tab, findText, replaceText, analysisTpl, addTagsInput, removeTagsInput]);

  const handlePreview = async () => {
    const dto = buildDto();
    if (!dto) { toast.error('请先填写操作内容'); return; }
    try {
      setPreviewing(true);
      const result = await questionBankApi.batchReplacePreview(bankId, dto);
      setPreview(result);
    } catch (error) {
      logger.error('预览批量替换失败', error);
      toast.error('预览失败');
    } finally { setPreviewing(false); }
  };

  const handleExecute = async () => {
    const dto = buildDto();
    if (!dto) { toast.error('请先填写操作内容'); return; }
    try {
      setExecuting(true);
      const result = await questionBankApi.batchReplace(bankId, dto);
      toast.success(`成功 ${result.successCount} 道，失败 ${result.failCount} 道`);
      setConfirmOpen(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      logger.error('执行批量替换失败', error);
      toast.error('执行失败');
    } finally { setExecuting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setPreview(null); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>批量替换</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="kp-filter">知识点关键词（可选）</Label>
            <Input id="kp-filter" value={kpFilter}
              onChange={(e) => setKpFilter(e.target.value)}
              placeholder="仅对题干或知识点包含关键词的题目生效" />
            <p className="text-xs text-muted-foreground">
              可选筛选：仅对题干或知识点包含该关键词的题目操作
            </p>
          </div>

          <Tabs value={tab}
            onValueChange={(v) => { setTab(v as TabValue); setPreview(null); }}>
            <TabsList className="w-full">
              <TabsTrigger value="text" className="flex-1">
                <Search className="mr-1 h-4 w-4" />文本替换
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex-1">
                <Sparkles className="mr-1 h-4 w-4" />解析模板
              </TabsTrigger>
              <TabsTrigger value="tags" className="flex-1">
                <Tag className="mr-1 h-4 w-4" />标签操作
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-2 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="find-text">查找文本</Label>
                <Input id="find-text" value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  placeholder="要查找的文本" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="replace-text">替换为</Label>
                <Input id="replace-text" value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="替换后的文本" />
              </div>
              <p className="text-xs text-muted-foreground">在题干和选项文本中替换</p>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-2 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="analysis-tpl">解析模板</Label>
                <Textarea id="analysis-tpl" rows={3} value={analysisTpl}
                  onChange={(e) => setAnalysisTpl(e.target.value)}
                  placeholder="支持 {{analysis}} 占位符表示原解析内容" />
              </div>
              <p className="text-xs text-muted-foreground">
                支持 <code className="text-primary">{'{{analysis}}'}</code> 占位符表示原解析内容
              </p>
            </TabsContent>

            <TabsContent value="tags" className="space-y-2 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="add-tags">添加标签（逗号分隔多个）</Label>
                <Input id="add-tags" value={addTagsInput}
                  onChange={(e) => setAddTagsInput(e.target.value)}
                  placeholder="标签1,标签2,标签3" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="remove-tags">移除标签（逗号分隔多个）</Label>
                <Input id="remove-tags" value={removeTagsInput}
                  onChange={(e) => setRemoveTagsInput(e.target.value)}
                  placeholder="标签1,标签2,标签3" />
              </div>
              <p className="text-xs text-muted-foreground">二选一或同时进行</p>
            </TabsContent>
          </Tabs>

          {preview && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <Badge variant="secondary">将影响 {preview.affectedCount} 道题</Badge>
              {preview.sampleQuestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">题干预览（前 3 题）</p>
                  {preview.sampleQuestions.slice(0, 3).map((q) => (
                    <p key={q.id} className="text-sm text-foreground/80 truncate" title={q.content}>
                      {q.content.length > 60 ? q.content.slice(0, 60) + '...' : q.content}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handlePreview} disabled={previewing}>
            {previewing ? '预览中...' : '预览影响'}
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={executing}>执行替换</Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />确认执行批量替换
            </AlertDialogTitle>
            <AlertDialogDescription>
              此操作将批量修改题集中的题目，确定要执行吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleExecute(); }}
              disabled={executing}
            >
              {executing ? '执行中...' : '确认执行'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default BatchReplaceDialog;
