import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigate } from '@client/src/utils/router';
import {
  ArrowLeft,
  Play,
  Loader2,
  Hash,
  Tag as TagIcon,
  Trash2,
  Globe,
  Lock,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { Card, CardContent } from '@client/src/components/ui/card';
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
import { TagChip, getTagColor } from '@client/src/components/TagChip';

import { questionTagApi, questionBankApi } from '@client/src/api';
import type {
  QuestionTagItem,
  QuestionWithFavorite,
} from '@shared/api.interface';

const TagDetailPage = () => {
  const { tagId } = useParams<{ tagId: string }>();
  const navigate = useNavigate();

  const [tag, setTag] = useState<QuestionTagItem | null>(null);
  const [questions, setQuestions] = useState<QuestionWithFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTagData = useCallback(async () => {
    if (!tagId) return;
    try {
      setLoading(true);
      const res = await questionTagApi.getQuestionsByTag(tagId);
      setTag(res.tag);
      setQuestions(res.items);
    } catch (error) {
      logger.error('加载标签详情失败', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [tagId]);

  useEffect(() => {
    loadTagData();
  }, [loadTagData]);

  const handleStartPractice = async () => {
    if (!tagId || questions.length === 0) return;
    try {
      setGenerating(true);
      const res = await questionTagApi.generateBankByTags({
        tagIds: [tagId],
        questionCount: questions.length,
        name: `${tag?.name ?? '标签'}练习`,
      });
      if (res?.bankId) {
        toast.success(`已生成临时题集「${res.name}」`);
        navigate(`/practice/${res.bankId}`);
      }
    } catch (error) {
       logger.error('生成题集失败', error);
      toast.error('生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleRemoveTag = async (questionId: string) => {
    if (!tagId) return;
    try {
      await questionTagApi.removeTagFromQuestion(questionId, tagId);
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setTag((prev) =>
        prev && prev.questionCount !== undefined
          ? { ...prev, questionCount: prev.questionCount - 1 }
          : prev,
      );
      toast.success('已移除标签');
    } catch (error) {
      logger.error('移除标签失败', error);
      toast.error('操作失败');
    }
  };

  const handleDeleteTag = async () => {
    if (!tagId) return;
    try {
      setIsDeleting(true);
      await questionTagApi.deleteTag(tagId);
      toast.success('标签已删除');
      setDeleteOpen(false);
      navigate('/tags');
    } catch (error) {
      logger.error('删除标签失败', error);
      toast.error('删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePracticeOne = async (questionId: string) => {
    try {
      const res = await questionBankApi.generateRandomBankByIds({
        questionIds: [questionId],
        name: '单题练习',
      });
      if (res?.bankId) {
        navigate(`/practice/${res.bankId}`);
      }
    } catch (error) {
      logger.error('生成单题练习失败', error);
      toast.error('操作失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tag) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-medium text-foreground">标签不存在</p>
        <p className="mt-1 text-sm text-muted-foreground">该标签可能已被删除</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/tags')}>
          返回标签列表
        </Button>
      </div>
    );
  }

  const colorCfg = getTagColor(tag.color);

  return (
    <div className="space-y-6 fade-in-up">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/tags')}
        className="gap-1 text-muted-foreground hover:text-foreground hover:bg-accent/60"
      >
        <ArrowLeft className="h-4 w-4" />
        返回标签列表
      </Button>

      <Card className="rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className={`h-1.5 w-full ${colorCfg.dot}`} />
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
             <div className="flex items-center gap-3">
               <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorCfg.bg} shadow-sm`}>
                 <TagIcon className={`h-5 w-5 ${colorCfg.text}`} />
               </div>
               <div>
                 <div className="flex items-center gap-2">
                   <h1 className="text-xl font-bold text-foreground">{tag.name}</h1>
                   <span
                     className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                       tag.labelType === 'public'
                         ? 'bg-info/10 text-info'
                         : 'bg-muted text-muted-foreground'
                     }`}
                   >
                     {tag.labelType === 'public' ? (
                       <Globe className="h-3 w-3" />
                     ) : (
                       <Lock className="h-3 w-3" />
                     )}
                     {tag.labelType === 'public' ? '公共标签' : '私人标签'}
                   </span>
                 </div>
               </div>
             </div>
            <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-2.5 py-1 font-medium text-accent-foreground tabular-nums">
                <Hash className="h-3.5 w-3.5" />
                {questions.length} 道题
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="gap-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            >
              <Trash2 className="h-4 w-4" />
              删除标签
            </Button>
            <Button
              onClick={handleStartPractice}
              disabled={questions.length === 0 || generating}
              className="gap-2 shadow-[0_4px_16px_hsl(265_85%_65%_/_0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_hsl(265_85%_65%_/_0.35)]"
            >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            开始练习
          </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          标签下的题目
          <span className="inline-flex items-center justify-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground tabular-nums">
            共 {questions.length} 道
          </span>
        </h2>

        {questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center card-hover">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
              <TagIcon className="h-7 w-7 text-accent-foreground" />
            </div>
            <p className="font-medium text-foreground">该标签下还没有题目</p>
            <p className="mt-1 text-sm text-muted-foreground">
              在练习页或题集预览中为题目添加标签
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <Card key={q.id} className="card-hover rounded-xl border border-border/60 shadow-sm overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent text-xs font-semibold text-accent-foreground tabular-nums">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                         <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                            {q.questionType === 'b1'
                              ? 'B1型题'
                              : q.questionType === 'single'
                                ? 'A1型题'
                                : 'X型题'}
                         </span>
                        {q.wrongCount > 0 && (
                          <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive tabular-nums">
                            错 {q.wrongCount} 次
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-foreground line-clamp-2 leading-relaxed">
                        {q.content}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                         <TagChip
                           tag={{ name: tag.name, color: tag.color, labelType: tag.labelType }}
                           onRemove={() => handleRemoveTag(q.id)}
                         />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePracticeOne(q.id)}
                      className="shrink-0 gap-1"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      练习
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除标签</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除标签「{tag?.name}」吗？
              删除后所有题目的该标签将被移除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTag}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TagDetailPage;
