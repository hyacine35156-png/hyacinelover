import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from '@client/src/utils/router';
import {
  Star,
  Loader2,
  Play,
  Search,
  X,
  Sparkles,
  Download,
  CheckSquare,
  Square,
  ListChecks,
  Move,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';

import { questionBankApi, favoriteGroupApi } from '@client/src/api';
import type { QuestionWithFavorite, FavoriteGroupItem } from '@shared/api.interface';
import { QuestionExportDialog, type ExportItem } from '@client/src/components/export/QuestionExportDialog';
import { QuestionPreview } from '../banks/QuestionPreview';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@client/src/components/ui/dialog';
import FavoriteGroupSidebar from './FavoriteGroupSidebar';
import MoveToGroupDialog from './MoveToGroupDialog';

const FavoritesPage = () => {
  const [questions, setQuestions] = useState<QuestionWithFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<ExportItem[]>([]);
  const navigate = useNavigate();

  // 分组相关
  const [groups, setGroups] = useState<FavoriteGroupItem[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null); // null = 全部收藏
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      setGroupsLoading(true);
      const res = await favoriteGroupApi.getGroups();
      setGroups(res.items);
    } catch (error) {
      logger.error('加载收藏分组失败', error);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      setLoading(true);
      if (activeGroupId) {
        const res = await favoriteGroupApi.getGroupQuestions(activeGroupId);
        setQuestions(res.items);
      } else {
        const res = await questionBankApi.getFavoriteList();
        setQuestions(res.items);
      }
    } catch (error) {
      logger.error('加载收藏列表失败', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [activeGroupId]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  // 切换分组时清空选中
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, [activeGroupId]);

  const filteredQuestions = useMemo(() => {
    if (!keyword.trim()) return questions;
    const kw = keyword.trim().toLowerCase();
    return questions.filter((q) => {
      if (q.content.toLowerCase().includes(kw)) return true;
      if (
        q.questionType === 'b1' &&
        q.subQuestions?.some((sq) => sq.content.toLowerCase().includes(kw))
      ) {
        return true;
      }
      return false;
    });
  }, [questions, keyword]);

  const visibleQuestions = useMemo(
    () => filteredQuestions,
    [filteredQuestions],
  );

  const allSelected = useMemo(() => {
    if (visibleQuestions.length === 0) return false;
    return visibleQuestions.every((q) => selectedIds.has(q.id));
  }, [visibleQuestions, selectedIds]);

  const selectedCount = selectedIds.size;

  const startPracticeWithIds = async (ids: string[], title: string) => {
    if (ids.length === 0) {
      toast.error('暂无符合条件的题目');
      return;
    }
    try {
      setStarting(true);
      const res = await questionBankApi.generateRandomBankByIds({
        questionIds: ids,
        name: title,
      });
      if (res && res.bankId) {
        navigate(`/practice/${res.bankId}`);
      }
    } catch (error) {
      logger.error('开始练习失败', error);
      toast.error('开始练习失败');
    } finally {
      setStarting(false);
    }
  };

  const handleStartPractice = () => {
    const title = activeGroupId
      ? `分组练习_${filteredQuestions.length}题`
      : `收藏练习_${filteredQuestions.length}题`;
    void startPracticeWithIds(
      filteredQuestions.map((q) => q.id),
      title,
    );
  };

  const handleQuestionClick = (questionId: string) => {
    if (selectMode) return;
    const idx = filteredQuestions.findIndex((q) => q.id === questionId);
    if (idx === -1) return;
    const title = activeGroupId ? '收藏单题练习' : '收藏单题练习';
    void startPracticeWithIds([questionId], title);
  };

  const handleToggleFavorite = async (questionId: string, isFavorited: boolean) => {
    try {
      await questionBankApi.updateFavorite({ questionId, isFavorited });
      if (!isFavorited) {
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(questionId);
          return next;
        });
        // 同步刷新分组计数
        void loadGroups();
        toast.success('已取消收藏');
      }
    } catch (error) {
      logger.error('更新收藏失败', error);
      toast.error('操作失败');
    }
  };

  const handleRemoveFromGroup = async (questionId: string) => {
    if (!activeGroupId) return;
    try {
      await favoriteGroupApi.removeQuestionFromGroup(activeGroupId, questionId);
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
      void loadGroups();
      toast.success('已从分组移除');
    } catch (error) {
      logger.error('从分组移除失败', error);
      toast.error('操作失败');
    }
  };

  const handleEnterSelectMode = () => {
    setSelectMode(true);
    setSelectedIds(new Set());
  };

  const handleExitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleToggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleQuestions.forEach((q) => next.delete(q.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleQuestions.forEach((q) => next.add(q.id));
        return next;
      });
    }
  };

  const handleInvertSelection = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleQuestions.forEach((q) => {
        if (next.has(q.id)) {
          next.delete(q.id);
        } else {
          next.add(q.id);
        }
      });
      return next;
    });
  };

  const handleExportSelected = () => {
    if (selectedIds.size === 0) return;
    const items: ExportItem[] = questions
      .filter((q) => selectedIds.has(q.id))
      .map((q) => ({
        id: q.id,
        content: q.content,
        questionType: q.questionType,
        options: q.options,
        correctAnswers: q.correctAnswers,
        analysis: q.analysis,
        subQuestions: q.subQuestions as ExportItem['subQuestions'],
        note: (q as any).note,
      }));
    setSelectedItems(items);
    setExportOpen(true);
  };

  const handleMoveSelected = () => {
    if (selectedIds.size === 0) return;
    setMoveDialogOpen(true);
  };

  const handleMoved = () => {
    void loadFavorites();
    void loadGroups();
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  if (loading && questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fade-in-up pb-28">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 左侧边栏 */}
        <aside className="w-full shrink-0 lg:w-64">
            <div className="sticky top-20 rounded-2xl border border-border bg-white p-3 shadow-sm">
            <FavoriteGroupSidebar
              groups={groups}
              activeGroupId={activeGroupId}
              totalFavorites={questions.length > 0 ? questions.length : 0}
              onSelectGroup={setActiveGroupId}
              onGroupsChange={loadGroups}
              loading={groupsLoading}
            />
          </div>
        </aside>

        {/* 主内容区 */}
        <div className="min-w-0 flex-1 space-y-6">
          <div className="flex items-start justify-between flex-col gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">
                <Star className="h-3.5 w-3.5 fill-current" />
                {activeGroup ? '收藏分组' : '收藏夹'}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {activeGroup ? activeGroup.name : '我的收藏'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground wallpaper-text-muted">
                共{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {questions.length}
                </span>{' '}
                道收藏题目
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="default"
                onClick={handleStartPractice}
                disabled={filteredQuestions.length === 0 || starting}
                className="gap-1.5 shadow-[0_4px_20px_hsl(265_85%_65%_/_0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_hsl(265_85%_65%_/_0.35)]"
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
                {starting ? '生成中' : '开始练习'}
              </Button>
              {!selectMode && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setExportOpen(true)}
                    disabled={filteredQuestions.length === 0}
                    className="gap-1.5"
                  >
                    <Download className="h-4 w-4" />
                    导出
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleEnterSelectMode}
                    disabled={filteredQuestions.length === 0}
                    className="gap-1.5"
                  >
                    <ListChecks className="h-4 w-4" />
                    批量选择
                  </Button>
                </>
              )}
              {selectMode && (
                <Button variant="outline" onClick={handleExitSelectMode} className="gap-1.5">
                  <X className="h-4 w-4" />
                  取消选择
                </Button>
              )}
              <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={filteredQuestions.length === 0}>
                 查看全部
               </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center card-hover">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-amber-500/10 shadow-sm">
                <Star className="h-10 w-10 text-amber-500 fill-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {activeGroup ? '该分组暂无题目' : '暂无收藏题目'}
              </h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                {activeGroup
                  ? '在批量选择中可以将题目移动到该分组'
                  : '练习时点击星星图标可以收藏题目，方便随时回顾复习'}
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                好题收藏，高效复习
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索收藏题目内容..."
                  className="pl-9 pr-9 transition-all duration-200 focus-within:shadow-[0_0_0_4px_hsl(265_85%_65%_/_0.1)]"
                />
                {keyword && (
                  <button
                    type="button"
                    onClick={() => setKeyword('')}
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="清空搜索"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {keyword ? (
                  <>
                    共找到 <span className="font-medium text-foreground tabular-nums">{filteredQuestions.length}</span> 道题
                  </>
                ) : (
                  <>共 {questions.length} 道题</>
                )}
              </p>
              {filteredQuestions.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  未找到匹配的题目
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {visibleQuestions.map((q) => {
                      const checked = selectedIds.has(q.id);
                      return (
                        <Card
                          key={q.id}
                          onClick={() => handleQuestionClick(q.id)}
                          className={`card-hover rounded-xl border shadow-sm transition-all ${
                            selectMode
                              ? 'cursor-default'
                              : 'cursor-pointer hover:border-primary/50 hover:shadow-md'
                          } ${
                            selectMode && checked
                              ? 'border-primary bg-primary/[0.03] ring-2 ring-primary/20'
                              : 'border-border/60'
                          }`}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start gap-3">
                              {selectMode && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleOne(q.id)}
                                  className="shrink-0 pt-0.5 text-primary hover:text-primary/80 transition-colors"
                                  aria-label={checked ? '取消选择' : '选择'}
                                >
                                  {checked ? (
                                    <CheckSquare className="h-5 w-5 fill-primary text-primary" />
                                  ) : (
                                    <Square className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </button>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                  <CardTitle className="text-base font-medium leading-relaxed line-clamp-2">
                                    {q.content}
                                  </CardTitle>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (activeGroupId) {
                                        void handleRemoveFromGroup(q.id);
                                      } else {
                                        void handleToggleFavorite(q.id, false);
                                      }
                                    }}
                                    className="shrink-0 text-amber-500 hover:bg-amber-500/10 hover:text-amber-600"
                                    title={activeGroupId ? '从分组移除' : '取消收藏'}
                                  >
                                    <Star className="h-4 w-4 fill-current" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                           <CardContent className="pt-0 text-sm text-muted-foreground">
                             <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                               {q.questionType === 'b1'
                                 ? `B1型题 · ${q.subQuestions?.length ?? 0} 个子题`
                                 : `${q.questionType === 'single' ? 'A1型题' : 'X型题'} · ${q.options.length} 个选项`}
                             </span>
                           </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  {filteredQuestions.length > 10 && (
                    <p className="py-2 text-center text-sm text-muted-foreground">
                      还有 {filteredQuestions.length - 10} 道题…
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {selectMode && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur-xl px-4 py-3 shadow-lg">
                <div className="text-sm font-medium text-foreground">
                  已选 <span className="text-primary tabular-nums">{selectedCount}</span> 题
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="gap-1.5"
                  >
                    {allSelected ? '取消全选' : '全选'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleInvertSelection} className="gap-1.5">
                    反选
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMoveSelected}
                    disabled={selectedCount === 0 || groups.length === 0}
                    className="gap-1.5"
                  >
                    <Move className="h-4 w-4" />
                    移动到分组
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleExportSelected}
                    disabled={selectedCount === 0}
                    className="gap-1.5 shadow-[0_4px_16px_hsl(265_85%_65%_/_0.25)]"
                  >
                    <Download className="h-4 w-4" />
                    导出选中{selectedCount > 0 ? ` (${selectedCount})` : ''}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleExitSelectMode}>
                    取消
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {activeGroup ? `${activeGroup.name} · 题目列表` : '收藏题目列表'}
                </DialogTitle>
              </DialogHeader>
              <DialogBody>
                <QuestionPreview questions={questions} loading={false} searchPlaceholder="搜索题目内容..." />
              </DialogBody>
            </DialogContent>
          </Dialog>

          <QuestionExportDialog
            open={exportOpen}
            onOpenChange={setExportOpen}
            source="favorite"
            fetchFn={(params) => questionBankApi.getFavoriteExportList(params)}
            preloadedItems={selectedItems.length > 0 ? selectedItems : undefined}
          />

          <MoveToGroupDialog
            open={moveDialogOpen}
            onOpenChange={setMoveDialogOpen}
            groups={groups}
            questionIds={Array.from(selectedIds)}
            fromGroupId={activeGroupId ?? null}
            onMoved={handleMoved}
          />
        </div>
      </div>
    </div>
  );
};

export default FavoritesPage;
