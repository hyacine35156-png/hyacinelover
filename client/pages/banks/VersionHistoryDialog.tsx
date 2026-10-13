import { useState, useEffect } from 'react';
import {
  History,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  FileText,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import { Skeleton } from '@client/src/components/ui/skeleton';

import { bankCollaborationApi } from '@client/src/api';
import type {
  BankVersionItem,
  QuestionItemV2,
} from '@shared/api.interface';

interface VersionHistoryDialogProps {
  bankId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRollback: boolean;
  onRollbackSuccess?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  single: 'A1型题', multiple: 'X型题', b1: 'B1型题',
  judge: '判断题', fill: '填空题',
};
const getTypeLabel = (t: string): string => TYPE_LABELS[t] || '未知题型';

const formatRelativeTime = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minute = 60 * 1000, hour = 60 * minute, day = 24 * hour;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  return `${Math.floor(diff / day)}天前`;
};

const formatFullTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const VersionHistoryDialog: React.FC<VersionHistoryDialogProps> = ({
  bankId, open, onOpenChange, canRollback, onRollbackSuccess,
}) => {
  const [versions, setVersions] = useState<BankVersionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailQuestions, setDetailQuestions] = useState<QuestionItemV2[]>([]);
  const [detailCount, setDetailCount] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<BankVersionItem | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  useEffect(() => {
    if (open && bankId) loadVersions();
  }, [open, bankId]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const res = await bankCollaborationApi.getBankVersions(bankId, { page: 1, pageSize: 20 });
      setVersions(res.items);
    } catch (e) {
      logger.error('加载版本历史失败', e);
      toast.error('加载版本历史失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = async (version: BankVersionItem) => {
    if (expandedId === version.id) { setExpandedId(null); return; }
    setExpandedId(version.id);
    try {
      setDetailLoading(true);
      const res = await bankCollaborationApi.getBankVersionDetail(version.id);
      setDetailQuestions(res.questions);
      setDetailCount(res.questionCount);
    } catch (e) {
      logger.error('加载版本详情失败', e);
      toast.error('加载版本详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleConfirmRollback = async () => {
    if (!rollbackTarget) return;
    try {
      setRollbackLoading(true);
      await bankCollaborationApi.rollbackVersion(rollbackTarget.id);
      toast.success(`已回退到版本 v${rollbackTarget.versionNumber}`);
      setRollbackTarget(null);
      loadVersions();
      onRollbackSuccess?.();
    } catch (e) {
      logger.error('回退版本失败', e);
      toast.error('回退版本失败');
    } finally {
      setRollbackLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              版本历史
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-1">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : versions.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">暂无版本历史</div>
            ) : (
              <div className="space-y-3">
                {versions.map((v, idx) => {
                  const isLatest = idx === 0;
                  const isExpanded = expandedId === v.id;
                  const rollbackDisabled = isLatest || !canRollback;
                  const tooltipText = isLatest ? '当前版本' : !canRollback ? '仅所有者和管理员可回退' : '';
                  return (
                    <div key={v.id} className="overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/30 hover:shadow-sm">
                      <div className="flex cursor-pointer items-start gap-3 p-4" onClick={() => handleToggleExpand(v)}>
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl font-bold text-primary">
                          v{v.versionNumber}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">版本 v{v.versionNumber}</span>
                            {isLatest && (
                              <Badge variant="default" className="bg-success/15 text-success hover:bg-success/20">
                                当前版本
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-1 text-sm text-foreground/80">{v.changeSummary || '无修改说明'}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatRelativeTime(v.createdAt)} · {formatFullTime(v.createdAt)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              {v.createdByUsername || '未知用户'}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" />
                              共 {v.questionCount} 题
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-end gap-2">
                          <div className="text-muted-foreground">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Button
                                  variant="outline" size="sm" disabled={rollbackDisabled}
                                  onClick={(e) => { e.stopPropagation(); setRollbackTarget(v); }}
                                  className="border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  回退到此版本
                                </Button>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{tooltipText}</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-border bg-muted/20 p-4 animate-in fade-in duration-200">
                          {detailLoading ? (
                            <div className="space-y-2">
                              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
                            </div>
                          ) : (
                            <>
                              {detailCount > 20 && (
                                <p className="mb-2 text-xs text-muted-foreground">共 {detailCount} 题，仅显示前 20 条</p>
                              )}
                              <div className="space-y-2">
                                {detailQuestions.slice(0, 20).map((q, i) => (
                                  <div key={q.id} className="rounded-md border border-border bg-background p-3">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-accent-foreground">{i + 1}</span>
                                      <span className="text-[11px] text-muted-foreground">{getTypeLabel(q.questionType)}</span>
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-sm text-foreground">{q.content}</p>
                                    <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                                      <span className="text-muted-foreground">正确答案：</span>
                                      <div className="flex gap-1">
                                        {q.correctAnswers.map((ans: number) => (
                                          <span key={ans} className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-success text-[10px] font-medium text-success-foreground">
                                            {q.options[ans]?.label || ans}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!rollbackTarget} onOpenChange={(o) => !o && setRollbackTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认回退？</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {rollbackTarget
                ? `确定回退到版本 v${rollbackTarget.versionNumber} 吗？\n回退后将创建新版本记录，当前版本也会保存在历史中，可随时恢复。\n\n该版本：v${rollbackTarget.versionNumber} · ${rollbackTarget.questionCount} 题 · ${formatFullTime(rollbackTarget.createdAt)}`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRollback} disabled={rollbackLoading}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {rollbackLoading ? '回退中...' : '确认回退'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default VersionHistoryDialog;
