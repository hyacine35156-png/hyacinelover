import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  StickyNote,
  Gauge,
  Flag,
  Loader2,
  Check,
  Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '@client/src/components/ui/dialog';
import { Textarea } from '@client/src/components/ui/textarea';
import { Badge } from '@client/src/components/ui/badge';
import {
  RadioGroup,
  RadioGroupItem,
} from '@client/src/components/ui/radio-group';
import { Label } from '@client/src/components/ui/label';

import { questionApi } from '@client/src/api';
import type { DifficultyLevel, FeedbackType } from '@shared/api.interface';

export interface QuestionActionBarHandle {
  /** 切换笔记弹窗打开/关闭 */
  toggleNote: () => void;
  /** 打开笔记弹窗 */
  openNote: () => void;
  /** 关闭笔记弹窗 */
  closeNote: () => void;
}

interface QuestionActionBarProps {
  questionId: string;
  isGuest?: boolean;
}

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  easy: 'bg-[hsl(152_60%_45%)]/10 text-[hsl(152_60%_45%)] ring-1 ring-[hsl(152_60%_45%)]/20',
  medium:
    'bg-[hsl(32_95%_58%)]/10 text-[hsl(32_95%_58%)] ring-1 ring-[hsl(32_95%_58%)]/20',
  hard: 'bg-[hsl(0_75%_62%)]/10 text-[hsl(0_75%_62%)] ring-1 ring-[hsl(0_75%_62%)]/20',
};

const FEEDBACK_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: 'wrong_answer', label: '答案错误' },
  { value: 'unclear_content', label: '题干不清' },
  { value: 'wrong_option', label: '选项有误' },
  { value: 'wrong_analysis', label: '解析错误' },
  { value: 'other', label: '其他' },
];

const QuestionActionBar = forwardRef<QuestionActionBarHandle, QuestionActionBarProps>(
function QuestionActionBar(
  { questionId, isGuest }: QuestionActionBarProps,
  ref,
) {
  // 笔记
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [hasNote, setHasNote] = useState(false);

  // 难度
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel | null>(null);
  const [difficultyLoading, setDifficultyLoading] = useState(false);
  const [difficultySaving, setDifficultySaving] = useState(false);

  // 反馈
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('wrong_answer');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // 加载笔记和难度
  const loadNote = useCallback(async () => {
    if (!questionId || isGuest) return;
    try {
      setNoteLoading(true);
      const res = await questionApi.getNote(questionId);
      setNoteText(res.note || '');
      setHasNote(Boolean(res.note));
    } catch (err) {
      logger.error('加载笔记失败', err);
    } finally {
      setNoteLoading(false);
    }
  }, [questionId, isGuest]);

  const loadDifficulty = useCallback(async () => {
    if (!questionId || isGuest) return;
    try {
      setDifficultyLoading(true);
      const res = await questionApi.getDifficulty(questionId);
      setDifficulty(res.difficulty);
    } catch (err) {
      logger.error('加载难度失败', err);
    } finally {
      setDifficultyLoading(false);
    }
  }, [questionId, isGuest]);

  useEffect(() => {
    setNoteText('');
    setHasNote(false);
    setDifficulty(null);
    if (!isGuest) {
      loadNote();
      loadDifficulty();
    }
  }, [questionId, isGuest, loadNote, loadDifficulty]);

  const handleSaveNote = async () => {
    if (!questionId) return;
    try {
      setNoteSaving(true);
      const res = await questionApi.saveNote(questionId, { note: noteText });
      setNoteText(res.note);
      setHasNote(Boolean(res.note));
      toast.success('笔记已保存');
      setNoteOpen(false);
    } catch (err) {
      logger.error('保存笔记失败', err);
      toast.error('保存失败，请稍后重试');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleSetDifficulty = async (level: DifficultyLevel) => {
    if (!questionId) return;
    try {
      setDifficultySaving(true);
      const res = await questionApi.setDifficulty(questionId, {
        difficulty: level,
      });
      setDifficulty(res.difficulty);
      toast.success(`已标记为${DIFFICULTY_LABELS[res.difficulty]}`);
      setDifficultyOpen(false);
    } catch (err) {
      logger.error('设置难度失败', err);
      toast.error('设置失败，请稍后重试');
    } finally {
      setDifficultySaving(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!questionId) return;
    try {
      setFeedbackSubmitting(true);
      await questionApi.submitFeedback(questionId, {
        feedbackType,
        description: feedbackDescription.trim() || undefined,
      });
      toast.success('感谢反馈，我们会尽快处理');
      setFeedbackDescription('');
      setFeedbackOpen(false);
    } catch (err) {
      logger.error('提交反馈失败', err);
      toast.error('提交失败，请稍后重试');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleNoteOpenChange = (open: boolean) => {
    if (!isGuest && open) {
      loadNote();
    }
    setNoteOpen(open);
  };

  useImperativeHandle(ref, () => ({
    toggleNote: () => {
      if (isGuest) return;
      handleNoteOpenChange(!noteOpen);
    },
    openNote: () => {
      if (isGuest) return;
      handleNoteOpenChange(true);
    },
    closeNote: () => {
      setNoteOpen(false);
    },
  }), [isGuest, noteOpen, loadNote]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 px-2 py-2 sm:gap-2">
      {/* 笔记按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleNoteOpenChange(!noteOpen)}
        disabled={isGuest}
        className="gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      >
        <StickyNote className="h-3.5 w-3.5" />
        <span>笔记</span>
        {hasNote && (
          <Lightbulb className="h-3 w-3 text-primary" />
        )}
      </Button>

      {/* 难度按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDifficultyOpen(!difficultyOpen)}
        disabled={isGuest || difficultyLoading}
        className="gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      >
        <Gauge className="h-3.5 w-3.5" />
        {difficulty ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${DIFFICULTY_COLORS[difficulty]}`}
          >
            {DIFFICULTY_LABELS[difficulty]}
          </span>
        ) : (
          <span>难度</span>
        )}
      </Button>

      {/* 反馈按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setFeedbackOpen(!feedbackOpen)}
        disabled={isGuest}
        className="gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      >
        <Flag className="h-3.5 w-3.5" />
        <span>反馈</span>
      </Button>

      {/* 笔记对话框 */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>题目笔记</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {noteLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="在这里记录你的笔记、思路或易错点..."
                className="min-h-[180px] resize-none rounded-xl text-sm leading-relaxed"
              />
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">
                取消
              </Button>
            </DialogClose>
            <Button
              variant="default"
              onClick={handleSaveNote}
              disabled={noteSaving || noteLoading}
              className="rounded-xl bg-gradient-to-r from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] text-white shadow-[0_4px_12px_hsl(265_85%_65%/0.35)] hover:brightness-105"
            >
              {noteSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  保存中
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  保存
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 难度对话框 */}
      <Dialog open={difficultyOpen} onOpenChange={setDifficultyOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>题目难度</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {difficultyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map(
                  (level) => {
                    const isActive = difficulty === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => handleSetDifficulty(level)}
                        disabled={difficultySaving}
                        className={`group flex flex-col items-center gap-2 rounded-2xl border px-4 py-5 transition-all duration-200 disabled:opacity-60 ${
                          isActive
                            ? `${DIFFICULTY_COLORS[level]} border-current/30 shadow-sm`
                            : 'border-border/60 bg-card hover:border-primary/30 hover:bg-accent/30 hover:shadow-sm'
                        }`}
                      >
                        <Gauge
                          className={`h-6 w-6 ${isActive ? 'text-current' : 'text-muted-foreground group-hover:text-primary'}`}
                        />
                        <Badge
                          variant="outline"
                          className={`rounded-full text-[11px] ${
                            isActive
                              ? DIFFICULTY_COLORS[level] + ' border-current/30'
                              : ''
                          }`}
                        >
                          {DIFFICULTY_LABELS[level]}
                        </Badge>
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">
                关闭
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 反馈对话框 */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>题目反馈</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                问题类型
              </Label>
              <RadioGroup
                value={feedbackType}
                onValueChange={(v) => setFeedbackType(v as FeedbackType)}
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              >
                {FEEDBACK_OPTIONS.map((opt) => (
                  <div key={opt.value}>
                    <Label
                      htmlFor={`feedback-${opt.value}`}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-xs font-medium text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-accent/40 has-[[data-state=checked]]:text-accent-foreground"
                    >
                      <RadioGroupItem
                        value={opt.value}
                        id={`feedback-${opt.value}`}
                        className="size-3.5"
                      />
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                补充说明
                <span className="ml-1 font-normal text-muted-foreground">
                  （可选）
                </span>
              </Label>
              <Textarea
                value={feedbackDescription}
                onChange={(e) => setFeedbackDescription(e.target.value)}
                placeholder="请描述具体问题..."
                className="min-h-[100px] resize-none rounded-xl text-sm leading-relaxed"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">
                取消
              </Button>
            </DialogClose>
            <Button
              variant="default"
              onClick={handleSubmitFeedback}
              disabled={feedbackSubmitting}
              className="rounded-xl bg-gradient-to-r from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] text-white shadow-[0_4px_12px_hsl(265_85%_65%/0.35)] hover:brightness-105"
            >
              {feedbackSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  提交中
                </>
              ) : (
                '提交反馈'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    );
},);

QuestionActionBar.displayName = 'QuestionActionBar';

export default QuestionActionBar;
