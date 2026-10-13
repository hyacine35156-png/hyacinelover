import { useState, memo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from '@client/src/utils/router';
import {
  BookOpen,
  Trash2,
  Eraser,
  Globe,
  Lock,
  User,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
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
import { Button } from '@client/src/components/ui/button';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Badge } from '@client/src/components/ui/badge';
import { getTagColor } from '@client/src/components/TagChip';
import BankDownloadButton from '@client/src/components/bank-download-button';
import SubjectPill from './SubjectPill';

import { practiceRecordApi } from '@client/src/api';
import type { QuestionBankItem } from '@shared/api.interface';
import BankDetailDialog from './BankDetailDialog';
import CopyBankDialog from './CopyBankDialog';
import { useBankDownload } from '@client/src/hooks/useBankDownload';
import PracticeModeDialog, { type PracticeMode } from '@client/src/components/practice/PracticeModeDialog';
import { getDefaultPracticeMode, PRACTICE_LAST_MODE_KEY } from '@client/src/utils/practice-mode';
import { safeSetItem } from '@client/src/utils/env';

interface BankCardProps {
  bank: QuestionBankItem;
  isMine?: boolean;
  selectable?: boolean;
  selected?: boolean;
  batchMode?: boolean;
  onToggleSelect?: (id: string) => void;
  onDelete: (id: string) => void;
  onPractice: (id: string) => void;
  onRefresh: () => void;
  subjectColors?: Record<string, string>;
}

const BankCard = ({
  bank,
  isMine = true,
  selectable = false,
  selected = false,
  batchMode = false,
  onToggleSelect,
  onDelete,
  onPractice,
  onRefresh,
  subjectColors = {},
}: BankCardProps) => {
  const dateStr = new Date(bank.createdAt).toLocaleDateString('zh-CN');
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const [nameExpanded, setNameExpanded] = useState(false);
  const [nameOverflow, setNameOverflow] = useState(false);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    setNameOverflow(el.scrollHeight > el.clientHeight + 1);
  }, [bank.name]);

  const isZcmu = /(^|[\s_\-])ZCMU/.test(bank.name);
   const renderHighlightedName = () => {
     if (!isZcmu) return bank.name;
     const parts = bank.name.split(/([\s_\-]?ZCMU)/g);
     return parts.map((part: string, i: number) =>
       /ZCMU/.test(part) ? (
        <span
          key={i}
          className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500"
        >
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  };

  const defaultMode = getDefaultPracticeMode();

  const {
    downloaded,
    downloading,
    progress,
    isOffline,
    handleDownload,
    handleDeleteDownload,
  } = useBankDownload(bank);

  const handleStartPractice = useCallback(() => {
    setModeDialogOpen(true);
  }, []);

  const handleModeSelect = useCallback(
    (mode: PracticeMode) => {
      safeSetItem(PRACTICE_LAST_MODE_KEY, mode);
      onPractice?.(bank.id);
      navigate(`/practice/${bank.id}?mode=${mode}`);
    },
    [bank.id, navigate, onPractice],
  );

  const handleClearRecords = async () => {
    try {
      setClearing(true);
      const res = await practiceRecordApi.clearBankRecords(bank.id);
      setClearDialogOpen(false);
      if (res.deletedCount > 0) {
        toast.success(`已清除 ${res.deletedCount} 条作答记录`);
      } else {
        toast.success('该题集暂无作答记录');
      }
      onRefresh();
    } catch (error) {
      logger.error('清除作答记录失败', error);
      toast.error('清除失败');
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card
      className={`card-hover group relative flex flex-col overflow-hidden rounded-xl border shadow-sm bg-card ${
        isZcmu
          ? 'border-amber-400/50 bg-gradient-to-br from-amber-50/[0.3] via-card to-card shadow-amber-200/30'
          : 'border-border/60'
      } ${selected ? 'ring-2 ring-primary/30 ring-offset-1' : ''}`}
    >
      {isZcmu && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-80" />
      )}
      {/* 右上角装饰角 */}
      <div className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br from-primary/[0.05] to-[hsl(290_75%_65%)/0.04] transition-all duration-300 ease-out group-hover:scale-150 group-hover:from-primary/[0.08] group-hover:to-[hsl(290_75%_65%)/0.06]" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-[hsl(290_75%_65%)/0.04] transition-all duration-500 ease-out group-hover:scale-125 group-hover:bg-primary/[0.06]" />
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              {selectable && (
                <div className={`mt-0.5 ${batchMode ? '' : 'opacity-0 transition-opacity group-hover:opacity-100'}`}>
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggleSelect?.(bank.id)}
                    aria-label={`选择题集 ${bank.name}`}
                  />
                </div>
              )}
              <CardTitle
                ref={nameRef}
                className={`min-h-[1.5rem] flex-1 break-words text-base font-semibold leading-snug text-foreground ${
                  nameExpanded ? '' : 'line-clamp-2'
                }`}
              >
                {renderHighlightedName()}
              </CardTitle>
            </div>
            {nameOverflow && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNameExpanded((v) => !v);
                }}
                className="mt-1 text-xs font-medium text-primary hover:underline"
              >
                {nameExpanded ? '收起' : '展开'}
              </button>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {isZcmu && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-amber-500/20">
                  ZCMU
                </span>
              )}
              {bank.isTemporary && (
                <span className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                  临时
                </span>
              )}
              {bank.isPublic ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                  <Globe className="h-3 w-3" />
                  公开
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  {isMine ? '仅自己可见' : '私密'}
                </span>
              )}
              {downloaded && (
                <Badge
                  variant="secondary"
                  className="h-4 shrink-0 px-1.5 text-[10px] font-normal"
                >
                  已离线
                </Badge>
              )}
              {isOffline && downloaded && (
                <Badge
                  variant="outline"
                  className="h-4 shrink-0 border-primary/50 bg-primary/10 px-1.5 text-[10px] font-normal text-primary"
                >
                  <WifiOff className="mr-0.5 h-2.5 w-2.5" />
                  离线可用
                </Badge>
              )}
            </div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary-foreground shadow-md shadow-primary/25 ring-1 ring-white/40 sm:h-11 sm:w-11" style={{ background: 'linear-gradient(135deg, hsl(265 85% 65%) 0%, hsl(290 75% 65%) 100%)' }}>
            <BookOpen className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </div>
        </div>
        {bank.description ? (
          <CardDescription className="mt-2 line-clamp-2 text-sm leading-relaxed">
            {bank.description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 pt-0 text-xs sm:gap-3 sm:text-sm">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
          {bank.questionCount}
          <span className="font-normal">道题</span>
        </span>
        <span className="text-xs text-muted-foreground">{dateStr}</span>
        {!isMine && bank.ownerUsername && (
          <>
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {bank.ownerUsername}
            </span>
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2.5 pt-0 sm:gap-3">
        {!bank.isTemporary && (
          <div className="flex items-center gap-2">
            {bank.subjectId && bank.subjectName ? (
              <SubjectPill
                subjectId={bank.subjectId}
                subjectName={bank.subjectName}
                subjectColors={subjectColors}
              />
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted/70 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                未分类
              </span>
            )}
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="default"
              onClick={handleStartPractice}
              className="flex-1 h-11 rounded-lg text-sm font-medium min-h-[44px]"
              style={{
                background:
                  'linear-gradient(135deg, hsl(265 85% 65%) 0%, hsl(290 75% 65%) 100%)',
                boxShadow: '0 2px 8px -2px hsl(265 85% 65% / 0.3)',
              }}
             >
               {isMine ? '开始练习' : '直接练习'}
             </Button>
            {isMine ? (
              <div className="flex gap-1">
                <BankDownloadButton
                  downloaded={downloaded}
                  downloading={downloading}
                  progress={progress}
                  onDownload={handleDownload}
                  onDelete={handleDeleteDownload}
                  bankName={bank.name}
                />
                <BankDetailDialog bank={bank} onSuccess={onRefresh} />
                <AlertDialog
                  open={clearDialogOpen}
                  onOpenChange={setClearDialogOpen}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-muted-foreground hover:text-warning hover:bg-warning/10 min-h-[44px]"
                       title="清除作答记录"
                    >
                      <Eraser className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                       <AlertDialogTitle>清除作答记录</AlertDialogTitle>
                       <AlertDialogDescription>
                          确定要清除该题集的所有作答记录吗？清除后数据将无法恢复，统计数据会同步更新。题集本身和题目不会被删除。
                       </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={clearing}>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearRecords}
                        disabled={clearing}
                        className="bg-amber-600 text-white hover:bg-amber-700"
                      >
                        {clearing ? '清除中…' : '确认清除'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-h-[44px]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                       <AlertDialogTitle>确认删除题集</AlertDialogTitle>
                       <AlertDialogDescription>
                          删除后将无法恢复，题集内的所有题目和相关作答记录都会被删除。
                       </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(bank.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        确认删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <div className="flex gap-1">
                 <BankDownloadButton
                   downloaded={downloaded}
                   downloading={downloading}
                   progress={progress}
                   onDownload={handleDownload}
                   onDelete={handleDeleteDownload}
                   bankName={bank.name}
                 />
                 <BankDetailDialog bank={bank} onSuccess={onRefresh} />
              </div>
            )}
          </div>
          {!isMine && (
            <CopyBankDialog bank={bank} onSuccess={onRefresh} />
          )}
        </div>
       </CardFooter>
      <PracticeModeDialog
        open={modeDialogOpen}
        onOpenChange={setModeDialogOpen}
        onSelect={handleModeSelect}
        defaultMode={defaultMode}
        bankName={bank.name}
        questionCount={bank.questionCount}
      />
    </Card>
  );
};

export default memo(BankCard);
