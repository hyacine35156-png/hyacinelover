import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Trophy,
  Flame,
  RotateCcw,
  Target,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { Progress } from '@client/src/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';

import { smartPracticeApi } from '@client/src/api';
import type { QuestionWithFavorite, QuestionOption } from '@shared/api.interface';

interface StreakPracticeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: QuestionWithFavorite[];
  target: number;
  onQuestionMastered: (questionId: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  single: 'A1型题',
  multiple: 'X型题',
  b1: 'B1型题',
};

interface CurrentState {
  streak: number;
  wrongCount: number;
}

export const StreakPractice = ({
  open,
  onOpenChange,
  questions,
  target,
  onQuestionMastered,
}: StreakPracticeProps) => {
  // 打乱顺序
  const shuffled = useMemo(() => {
    const arr = [...questions];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [questions, open]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [streakStates, setStreakStates] = useState<Record<string, CurrentState>>({});
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  // 重置状态
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setSelected([]);
      setAnswered(false);
      setIsCorrect(false);
      setMasteredCount(0);
      setFinished(false);
      setStreakStates({});
      setRemovedIds(new Set());
    }
  }, [open]);

  const remainingList = useMemo(
    () => shuffled.filter((q) => !removedIds.has(q.id)),
    [shuffled, removedIds],
  );

  const current = remainingList[currentIndex];

  const loadStreakState = useCallback(async (qid: string) => {
    if (streakStates[qid]) return;
    try {
      const res = await smartPracticeApi.getStreakState(qid);
      setStreakStates((prev) => ({
        ...prev,
        [qid]: { streak: res.streak, wrongCount: res.wrongCount },
      }));
    } catch (error) {
      logger.error('加载 streak 状态失败', error);
    }
  }, [streakStates]);

  useEffect(() => {
    if (current && !answered) {
      void loadStreakState(current.id);
    }
  }, [current?.id, answered, loadStreakState, current]);

  const totalCount = questions.length;
  const remainingCount = remainingList.length;

  const handleToggleOption = (idx: number) => {
    if (answered) return;
    if (current?.questionType === 'single' || current?.questionType === 'b1') {
      setSelected([idx]);
    } else {
      setSelected((prev) =>
        prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx],
      );
    }
  };

  const handleSubmit = async () => {
    if (!current || selected.length === 0 || answered) return;
    try {
      setSubmitting(true);
      const correct = current.correctAnswers ?? [];
      const sortedSelected = [...selected].sort((a, b) => a - b);
      const sortedCorrect = [...correct].sort((a, b) => a - b);
      const correctAnswer =
        sortedSelected.length === sortedCorrect.length &&
        sortedSelected.every((v, i) => v === sortedCorrect[i]);

      setIsCorrect(correctAnswer);
      setAnswered(true);

      // 提交 streak
      const res = await smartPracticeApi.submitStreak(current.id, correctAnswer);
      setStreakStates((prev) => ({
        ...prev,
        [current.id]: { streak: res.streak, wrongCount: res.wrongCount },
      }));

      if (res.mastered) {
        setMasteredCount((prev) => prev + 1);
        toast.success('已掌握！移出错题本');
        onQuestionMastered(current.id);
      } else {
        toast(correctAnswer ? '回答正确！' : '回答错误，继续加油', {
          icon: correctAnswer ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          ),
        });
      }
    } catch (error) {
      logger.error('提交答案失败', error);
      toast.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!current) return;

    const isMastered = streakStates[current.id]?.streak >= target;

    if (isMastered) {
      // 移出错题本，从队列移除
      const newRemoved = new Set(removedIds);
      newRemoved.add(current.id);
      setRemovedIds(newRemoved);

      const newRemaining = shuffled.filter((q) => !newRemoved.has(q.id));
      if (newRemaining.length === 0 || currentIndex >= newRemaining.length) {
        setFinished(true);
      }
      // index 不变（下一道会顶上来）
    } else {
      if (currentIndex + 1 >= remainingList.length) {
        setFinished(true);
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    }

    setSelected([]);
    setAnswered(false);
    setIsCorrect(false);
  };

  // 监听 removedIds 变化以判断是否结束
  useEffect(() => {
    if (open && !finished && remainingList.length === 0) {
      setFinished(true);
    }
    if (
      open &&
      !finished &&
      currentIndex >= remainingList.length &&
      remainingList.length > 0
    ) {
      setFinished(true);
    }
  }, [remainingList.length, currentIndex, finished, open]);

  const currentStreak = current ? streakStates[current.id]?.streak ?? 0 : 0;
  const progressPercent = target > 0 ? (currentStreak / target) * 100 : 0;

  const renderOption = (opt: QuestionOption, idx: number) => {
    const isSelected = selected.includes(idx);
    const isCorrectOpt = current?.correctAnswers?.includes(idx);
    let optClass =
      'relative flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200 cursor-pointer';

    if (!answered) {
      optClass += isSelected
        ? ' border-primary bg-primary/10 shadow-sm'
        : ' border-border/60 bg-card hover:border-primary/40 hover:bg-accent/30';
    } else {
      if (isCorrectOpt) {
        optClass += ' border-success/50 bg-success/10';
      } else if (isSelected && !isCorrectOpt) {
        optClass += ' border-destructive/50 bg-destructive/10';
      } else {
        optClass += ' border-border/40 bg-card/50 opacity-70';
      }
    }

    return (
      <button
        key={idx}
        type="button"
        onClick={() => handleToggleOption(idx)}
        disabled={answered}
        className={optClass}
      >
        <span
          className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
            answered && isCorrectOpt
              ? 'bg-success text-white'
              : answered && isSelected && !isCorrectOpt
                ? 'bg-destructive text-white'
                : isSelected
                  ? 'bg-primary text-white'
                  : 'bg-accent text-foreground'
          }`}
        >
          {answered && isCorrectOpt ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : answered && isSelected && !isCorrectOpt ? (
            <XCircle className="h-4 w-4" />
          ) : (
            String.fromCharCode(65 + idx)
          )}
        </span>
        <span className="flex-1 text-sm leading-relaxed text-foreground">
          {opt.text}
        </span>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[92vh]">
        {finished ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                练习完成
              </DialogTitle>
              <DialogDescription>本次错题重练模式结果</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-6 py-4 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-pink-400/20">
                  <Trophy className="h-10 w-10 text-primary" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex items-center justify-center gap-1 text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">已掌握</span>
                    </div>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
                      {masteredCount}
                    </p>
                    <p className="text-xs text-muted-foreground">道题</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex items-center justify-center gap-1 text-warning">
                      <RotateCcw className="h-4 w-4" />
                      <span className="text-sm font-medium">仍需练习</span>
                    </div>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
                      {Math.max(0, totalCount - masteredCount)}
                    </p>
                    <p className="text-xs text-muted-foreground">道题</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  共完成 {totalCount} 道题，{' '}
                  {masteredCount > 0
                    ? `其中 ${masteredCount} 道已连续答对 ${target} 次，自动移出错题本`
                    : '继续加油，坚持就是胜利！'}
                </p>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                关闭
              </Button>
              <Button
                onClick={() => {
                  setCurrentIndex(0);
                  setSelected([]);
                  setAnswered(false);
                  setIsCorrect(false);
                  setMasteredCount(0);
                  setFinished(false);
                  setStreakStates({});
                  setRemovedIds(new Set());
                }}
                className="shadow-[0_4px_20px_hsl(265_85%_65%_/_0.25)]"
              >
                <RotateCcw className="h-4 w-4" />
                再来一轮
              </Button>
            </DialogFooter>
          </>
        ) : current ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Flame className="h-5 w-5 text-primary" />
                  错题重练模式
                </DialogTitle>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  第 <span className="font-medium text-foreground tabular-nums">
                    {currentIndex + 1}
                  </span> / {remainingList.length} 题
                </span>
                <span>目标：连续答对 {target} 次</span>
              </div>
            </DialogHeader>
            <DialogBody className="space-y-5">
              {/* streak 进度条 */}
              <div className="space-y-2 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] to-pink-400/[0.05] p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 font-medium text-primary">
                    <Target className="h-3.5 w-3.5" />
                    连续答对进度
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {currentStreak} / {target}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {/* 题型 */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                  {TYPE_LABELS[current.questionType] || current.questionType}
                </span>
                {current.wrongCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive tabular-nums">
                    答错 {current.wrongCount} 次
                  </span>
                )}
              </div>

              {/* 题干 */}
              <p className="text-base font-medium leading-relaxed text-foreground">
                {current.content}
              </p>

              {/* 选项 */}
              <div className="space-y-2.5">
                {(current.options || []).map((opt: QuestionOption, idx: number) =>
                  renderOption(opt, idx),
                )}
              </div>

              {/* 答案解析 */}
              {answered && (
                <div
                  className={`rounded-xl border p-4 ${
                    isCorrect
                      ? 'border-success/30 bg-success/5'
                      : 'border-destructive/30 bg-destructive/5'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {isCorrect ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span
                      className={`text-sm font-semibold ${
                        isCorrect ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {isCorrect ? '回答正确' : '回答错误'}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      正确答案：
                      {(current.correctAnswers || [])
                        .map((i: number) => String.fromCharCode(65 + i))
                        .join('、')}
                    </span>
                  </div>
                  {current.analysis && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">解析：</span>
                      {current.analysis}
                    </p>
                  )}
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              {!answered ? (
                <Button
                  onClick={handleSubmit}
                  disabled={selected.length === 0 || submitting}
                  className="w-full shadow-[0_4px_20px_hsl(265_85%_65%_/_0.25)] sm:w-auto"
                >
                  {submitting ? '提交中…' : '提交答案'}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className="w-full shadow-[0_4px_20px_hsl(265_85%_65%_/_0.25)] sm:w-auto"
                >
                  {currentIndex + 1 >= remainingList.length ? '完成练习' : '下一题'}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
