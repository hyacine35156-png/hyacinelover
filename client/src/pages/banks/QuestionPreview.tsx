import { useState, useMemo, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Check,
  Search,
  X,
  Tag as TagIcon,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import { TagChip } from '@client/src/components/TagChip';
import { TagSelectorDialog } from '@client/src/components/TagSelectorDialog';

import { questionTagApi } from '@client/src/api';
import type { QuestionItem, QuestionTagItem } from '@shared/api.interface';
import QuestionComments from '@client/src/components/question-comments/QuestionComments';

const TYPE_LABELS: Record<string, string> = {
  single: 'A1型题',
  multiple: 'X型题',
  b1: 'B1型题',
};

const getTypeLabel = (t: string): string => TYPE_LABELS[t] || '未知题型';

export function QuestionPreview({
  questions,
  loading,
  searchPlaceholder = '搜索题目内容...',
}: {
  questions: QuestionItem[];
  loading: boolean;
  searchPlaceholder?: string;
}) {
  const [keyword, setKeyword] = useState('');

  const filteredQuestions = useMemo(() => {
    if (!keyword.trim()) return questions;
    const kw = keyword.trim().toLowerCase();
    return questions.filter((q) => {
      if (q.content.toLowerCase().includes(kw)) return true;
      if (
        q.subQuestions &&
        q.subQuestions.some((sq) => sq.content.toLowerCase().includes(kw))
      ) {
        return true;
      }
      return false;
    });
  }, [questions, keyword]);

  const showSearchResultCount = keyword.trim().length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9 pr-9"
        />
        {keyword && (
          <button
            type="button"
            onClick={() => setKeyword('')}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="清空搜索"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {showSearchResultCount ? (
        <p className="text-xs text-muted-foreground">
          共找到 {filteredQuestions.length} 道题
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">共 {questions.length} 道题</p>
      )}
      {filteredQuestions.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {keyword ? '未找到匹配的题目' : '暂无题目'}
        </div>
      ) : (
        filteredQuestions.map((q, idx) => (
          <QuestionPreviewItem key={q.id} index={idx + 1} question={q} />
        ))
      )}
    </div>
  );
}

function QuestionPreviewItem({
  index,
  question,
}: {
  index: number;
  question: QuestionItem;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tags, setTags] = useState<QuestionTagItem[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    if (expanded && tags.length === 0 && !tagsLoading) {
      loadTags();
    }
  }, [expanded]);

  const loadTags = async () => {
    try {
      setTagsLoading(true);
      const res = await questionTagApi.getQuestionTags(question.id);
      setTags(res.items);
    } catch (error) {
      logger.error('加载题目标签失败', error);
    } finally {
      setTagsLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await questionTagApi.removeTagFromQuestion(question.id, tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch (error) {
      logger.error('移除标签失败', error);
    }
  };

  const isB1 = question.questionType === 'b1';

  return (
    <div className="rounded-lg border border-border bg-card">
      <div
        className="flex cursor-pointer items-start justify-between gap-3 p-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
              {index}
            </span>
            <span className="text-xs text-muted-foreground">
              {getTypeLabel(question.questionType)}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">
            {question.content}
          </p>
          {isB1 && question.subQuestions && question.subQuestions.length > 0 && (
            <div className="mt-2 space-y-1 pl-2">
              {question.subQuestions.map((sq, i) => (
                <p
                  key={i}
                  className="text-sm text-foreground/80"
                >{`${i + 1}. ${sq.content}`}</p>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="text-muted-foreground">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <div className="space-y-2">
            {isB1 && (
              <p className="text-xs font-medium text-muted-foreground">
                共用备选答案
              </p>
            )}
            <div className="space-y-1.5">
              {question.options.map((opt, i) => {
                const isCorrect = question.correctAnswers.includes(i);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      isCorrect
                        ? 'bg-success/10 text-foreground'
                        : 'bg-muted/50 text-foreground'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                        isCorrect
                          ? 'bg-success text-success-foreground'
                          : 'bg-background text-muted-foreground'
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="flex-1">{opt.text}</span>
                    {isCorrect && <Check className="h-4 w-4 text-success" />}
                  </div>
                );
              })}
            </div>
          </div>

          {isB1 &&
            question.subQuestions &&
            question.subQuestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  子问题与答案
                </p>
                <div className="space-y-2">
                  {question.subQuestions.map((sq, i) => (
                    <div
                      key={i}
                      className="space-y-1.5 rounded-md border border-border bg-muted/20 p-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {i + 1}.
                        </span>
                        <p className="flex-1 text-sm text-foreground">
                          {sq.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 pl-5 text-xs">
                        <span className="text-muted-foreground">正确答案：</span>
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-success text-[10px] font-medium text-success-foreground">
                          {sq.correctAnswer}
                        </span>
                      </div>
                      {sq.analysis && (
                        <div className="pl-5 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            解析：
                          </span>
                          {sq.analysis}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          <div className="space-y-2 rounded-md bg-muted/30 p-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <TagIcon className="h-3.5 w-3.5" />
                标签
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectorOpen(true);
                }}
                className="h-6 gap-1 text-xs"
              >
                管理标签
              </Button>
            </div>
            {tagsLoading ? (
              <p className="text-xs text-muted-foreground">加载中...</p>
            ) : tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                暂无标签，点击管理标签添加
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <TagChip
                    key={t.id}
                    tag={t}
                    onRemove={() => handleRemoveTag(t.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {!isB1 && question.analysis && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs font-medium text-foreground">答案解析</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {question.analysis}
              </p>
            </div>
          )}

          <QuestionComments questionId={question.id} collapsed />
        </div>
      )}

      <TagSelectorDialog
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        questionId={question.id}
        initialTags={tags}
        onTagsUpdated={setTags}
      />
    </div>
  );
}
