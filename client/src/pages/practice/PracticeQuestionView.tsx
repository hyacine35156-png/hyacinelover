import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Star,
  BookX,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@client/src/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import { Button } from '@client/src/components/ui/button';
import QuestionTagPanel from './QuestionTagPanel';
import QuestionActionBar from '@client/src/components/question-action-bar/QuestionActionBar';
import FavoriteGroupMenu from '@client/src/components/favorite-group-menu/FavoriteGroupMenu';

interface OptionItem {
  label: string;
  text: string;
}

interface SubQuestionItem {
  content: string;
  correctAnswer: string;
  analysis?: string;
}

interface FlatQuestionItem {
  id: string;
  questionType: string;
  content: string;
  options: OptionItem[];
  correctAnswers: number[];
  analysis?: string;
  subIndex: number;
  subTotal: number;
  subQuestion?: SubQuestionItem;
  wrongCount?: number;
  mastered?: boolean;
}

interface PracticeQuestionViewProps {
  question: FlatQuestionItem;
  selectedAnswers: number[];
  isSubmitted: boolean;
  showAnswer: boolean;
  showCorrectness?: boolean;
  isCorrect: boolean;
  onSelectAnswer: (index: number) => void;
  onToggleFavorite?: (favorited: boolean) => void;
  onRemoveFromWrongBook?: () => void;
  isFavorited?: boolean;
  isGuest?: boolean;
  isWrongBook?: boolean;
  getTypeAbbr: (t: string) => string;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onFinish: () => void;
  isFirst: boolean;
  isLast: boolean;
  submittingResult: boolean;
  showAnalysis?: boolean;
}

const PracticeQuestionView = React.memo(function PracticeQuestionView({
  question,
  selectedAnswers,
  isSubmitted,
  showAnswer,
  showCorrectness = false,
  onSelectAnswer,
  onToggleFavorite,
  onRemoveFromWrongBook,
  isFavorited,
  isGuest,
  isWrongBook,
  getTypeAbbr,
  onPrev,
  onNext,
  onSubmit,
  onFinish,
  isFirst,
  isLast,
  submittingResult,
}: PracticeQuestionViewProps) {
  return (
    <Card className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-all duration-200 card-hover">
      <CardHeader className="space-y-3 px-4 pb-4 pt-5 sm:space-y-4 sm:px-6 sm:pb-5 sm:pt-6 md:px-8 md:pt-7">
        <div className="flex items-start gap-4">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent text-xs font-bold text-primary shadow-sm ring-1 ring-primary/20 sm:h-10 sm:w-10">
            {getTypeAbbr(question.questionType)}
          </span>
          <div className="flex-1">
            {question.questionType === 'b1' && (
              <p className="mb-2 inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                共用备选答案
              </p>
            )}
            <p className="text-sm font-medium leading-relaxed text-foreground sm:text-base md:text-lg md:leading-relaxed">
              {question.questionType === 'b1' && question.subQuestion
                ? `${question.subIndex + 1}. ${question.subQuestion.content}`
                : question.content}
            </p>
            {question.questionType === 'b1' && (
              <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                第 {question.subIndex + 1} 小题 / 共 {question.subTotal} 小题
              </p>
            )}
          </div>
          <TooltipProvider delayDuration={200}>
            <div className="flex flex-col gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <FavoriteGroupMenu
                      questionId={question.id}
                      isFavorited={isFavorited ?? false}
                      onToggle={onToggleFavorite}
                      isGuest={isGuest}
                      size="md"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">
                    {isFavorited ? '收藏管理' : '收藏本题'}
                  </p>
                </TooltipContent>
              </Tooltip>
              {isWrongBook && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onRemoveFromWrongBook}
                      className="h-9 w-9 shrink-0 rounded-xl text-destructive transition-all duration-200 hover:scale-105 hover:bg-destructive/10"
                    >
                      <BookX className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p className="text-xs">移出错题本</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-14">
          <span className="inline-flex items-center rounded-full bg-gradient-to-r from-primary/10 to-accent px-3 py-1 text-xs font-semibold text-accent-foreground ring-1 ring-primary/15">
            {question.questionType === 'single'
              ? 'A1型题（单选）'
              : question.questionType === 'b1'
                ? 'B1型题（配伍）'
                : 'X型题（多选）'}
          </span>
        </div>
      </CardHeader>

      {/* 标签面板 */}
      <div className="border-t border-border/60 bg-gradient-to-b from-muted/30 to-transparent px-4 py-3 sm:px-6 sm:py-4 md:px-8">
        <QuestionTagPanel questionId={question.id} />
      </div>

      {/* 选项区 */}
      <CardContent className="space-y-2.5 px-4 py-5 sm:space-y-3 sm:px-6 sm:py-6 md:px-8 md:py-7">
        {question.options.map((opt, idx) => {
          const isSelected = selectedAnswers.includes(idx);
          const isCorrectOption =
            question.questionType === 'b1'
              ? question.subQuestion?.correctAnswer === opt.label
              : question.correctAnswers.includes(idx);
          const isWrongSelected =
            showCorrectness && isSelected && !isCorrectOption;

          let optionClass =
            'border-border/80 bg-card hover:border-primary/40 hover:bg-accent/30 hover:shadow-sm';
          if (showAnswer) {
            if (isCorrectOption) {
              optionClass =
                'border-success/50 bg-success/8 text-success ring-1 ring-success/20 shadow-sm';
            } else if (isWrongSelected) {
              optionClass =
                'border-destructive/50 bg-destructive/8 text-destructive ring-1 ring-destructive/20 shadow-sm';
            } else if (showCorrectness) {
              optionClass =
                'border-border/40 bg-muted/20 text-muted-foreground/70';
            } else {
              optionClass =
                'border-border/60 bg-card hover:border-primary/40 hover:bg-accent/30 hover:shadow-sm';
            }
          } else if (isSelected) {
            optionClass =
              'border-primary bg-accent/40 text-foreground ring-2 ring-primary/25 shadow-sm';
          }

          return (
            <button
              key={idx}
              onClick={() => onSelectAnswer(idx)}
              disabled={showAnswer}
              className={`group flex w-full min-h-[48px] items-center gap-3 rounded-full border px-4 py-3 text-left transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-default sm:gap-4 sm:px-6 sm:py-4 ${optionClass}`}
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-200 sm:h-10 sm:w-10 sm:text-sm ${
                  showCorrectness
                    ? isCorrectOption
                      ? 'border-success bg-success text-success-foreground shadow-[0_0_0_3px_hsl(152_60%_45%/0.15)]'
                      : isWrongSelected
                        ? 'border-destructive bg-destructive text-destructive-foreground shadow-[0_0_0_3px_hsl(0_75%_62%/0.15)]'
                        : 'border-border/50 bg-card text-muted-foreground/50'
                    : showAnswer
                      ? isCorrectOption
                        ? 'border-success bg-success text-success-foreground shadow-[0_0_0_3px_hsl(152_60%_45%/0.15)]'
                        : 'border-border/70 bg-card text-foreground group-hover:border-primary/50 group-hover:text-primary'
                      : isSelected
                        ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_0_3px_hsl(265_85%_65%/0.2)]'
                        : 'border-border/70 bg-card text-foreground group-hover:border-primary/50 group-hover:text-primary'
                }`}
              >
                {opt.label}
              </div>
              <span className="flex-1 text-sm leading-relaxed text-foreground">
                {opt.text}
              </span>
              {showCorrectness && isCorrectOption && (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-success" />
              )}
              {showCorrectness && isWrongSelected && (
                <XCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
              )}
            </button>
          );
        })}
      </CardContent>

      {/* 解析区 */}
      {showAnswer && question.analysis && (
        <div className="fade-in-up border-t border-border/60 bg-gradient-to-br from-accent/30 via-primary/5 to-transparent px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Check className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-bold uppercase tracking-wider text-accent-foreground">
              答案解析
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-border">
            <p className="text-sm font-medium text-foreground">
              正确答案：
              <span className="ml-1 text-success font-semibold">
                {question.questionType === 'b1' && question.subQuestion
                  ? question.options.find(
                      (o) => o.label === question.subQuestion!.correctAnswer,
                    )?.label || ''
                  : question.correctAnswers
                      .map((i) => question.options[i]?.label)
                      .join('、')}
              </span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground/85">
              {question.analysis}
            </p>
          </div>
        </div>
      )}

      {/* 题目操作栏（笔记/难度/反馈） */}
      <div className="border-t border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
        <QuestionActionBar
          questionId={question.id}
          isGuest={isGuest}
        />
      </div>

      {/* 底部操作栏 */}
      <CardFooter className="flex items-center justify-between gap-2 border-t border-border/60 bg-gradient-to-t from-muted/40 to-transparent px-4 py-4 sm:gap-0 sm:px-6 sm:py-5 md:px-8">
        <Button
          variant="outline"
          onClick={onPrev}
          disabled={isFirst}
          className="h-11 min-h-[44px] flex-1 gap-1 rounded-xl border border-border/60 px-2 text-sm transition-all duration-200 hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm disabled:hover:translate-y-0 sm:flex-none sm:gap-1.5 sm:px-5"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sm:inline">上一题</span>
        </Button>

        {showAnswer ? (
          isLast ? (
            <Button
              variant="default"
              onClick={onFinish}
              disabled={submittingResult}
              className="h-11 min-h-[44px] flex-[1.5] rounded-xl bg-gradient-to-r from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] px-3 text-sm font-semibold text-white shadow-[0_4px_16px_hsl(265_85%_65%/0.35)] transition-all duration-200 hover:shadow-[0_6px_24px_hsl(265_85%_65%/0.45)] hover:brightness-105 sm:flex-none sm:px-6"
            >
              {submittingResult ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  提交中
                </>
              ) : (
                '查看结果'
              )}
            </Button>
          ) : (
            <Button
              variant="default"
              onClick={onNext}
              className="h-11 min-h-[44px] flex-[1.5] gap-1 rounded-xl bg-gradient-to-r from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] px-3 text-sm font-semibold text-white shadow-[0_4px_16px_hsl(265_85%_65%/0.35)] transition-all duration-200 hover:shadow-[0_6px_24px_hsl(265_85%_65%/0.45)] hover:brightness-105 sm:flex-none sm:gap-1.5 sm:px-6"
            >
              <span className="sm:inline">下一题</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )
        ) : (
          <Button
            variant="default"
            onClick={onSubmit}
            disabled={selectedAnswers.length === 0}
            className="h-11 min-h-[44px] flex-[1.5] rounded-xl bg-gradient-to-r from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] px-3 text-sm font-semibold text-white shadow-[0_4px_16px_hsl(265_85%_65%/0.35)] transition-all duration-200 hover:shadow-[0_6px_24px_hsl(265_85%_65%/0.45)] hover:brightness-105 disabled:opacity-50 sm:flex-none sm:px-8"
          >
            提交答案
          </Button>
        )}
      </CardFooter>
    </Card>
  );
});

export default PracticeQuestionView;
