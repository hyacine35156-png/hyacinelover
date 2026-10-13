import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from '@client/src/utils/router';
import {
  BookX,
  Loader2,
  CheckCircle2,
  Play,
  Trash2,
  Search,
  X,
  Star,
  AlertTriangle,
  Download,
  BarChart3,
  ListFilter,
  Calendar,
  Flame,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@client/src/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';

import { questionBankApi } from '@client/src/api';
import { getWrongBookStats } from '@client/src/api/wrongbook';
import { APP_VERSION } from '@client/src/utils/version';
import { useAuth } from '@client/src/contexts/AuthContext';
import type {
  QuestionWithFavorite,
  WrongReason,
  DifficultyLevel,
  WrongBookStatsResponse,
} from '@shared/api.interface';
import { QuestionPreview } from '../banks/QuestionPreview';
import { WrongReasonBadge } from './WrongReasonBadge';
import { WrongBookStats } from './WrongBookStats';
import { QuestionExportDialog } from '@client/src/components/export/QuestionExportDialog';
import { getWrongBookExportList } from '@client/src/api/wrongbook';
import { StreakPractice } from './StreakPractice';

type MainTab = 'list' | 'stats';
type SubTab = 'all' | 'important';

const WRONG_REASON_FILTERS: { value: string; label: string }[] = [
  { value: '', label: '全部原因' },
  { value: 'concept_unclear', label: '概念不清' },
  { value: 'careless', label: '粗心大意' },
  { value: 'dont_know', label: '不会做' },
  { value: 'no_time', label: '时间不够' },
  { value: 'dispute', label: '题目争议' },
  { value: 'other', label: '其他' },
];

const DIFFICULTY_FILTERS: { value: string; label: string }[] = [
  { value: '', label: '全部难度' },
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
];

const WrongBookPage = () => {
  const [mainTab, setMainTab] = useState<MainTab>('list');
  const [subTab, setSubTab] = useState<SubTab>('all');
  const [questions, setQuestions] = useState<QuestionWithFavorite[]>([]);
  const [importantQuestions, setImportantQuestions] = useState<QuestionWithFavorite[]>([]);
  const [stats, setStats] = useState<WrongBookStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [reasonFilter, setReasonFilter] = useState<WrongReason | ''>('');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyLevel | ''>('');
  const [streakOpen, setStreakOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const activeList = subTab === 'important' ? importantQuestions : questions;
  const setActiveList = subTab === 'important' ? setImportantQuestions : setQuestions;

  const filteredQuestions = useMemo(() => {
    let list = activeList;
    if (reasonFilter) {
      list = list.filter((q) => q.wrongReason === reasonFilter);
    }
    if (!keyword.trim()) return list;
    const kw = keyword.trim().toLowerCase();
    return list.filter((q) => {
      if (q.content.toLowerCase().includes(kw)) return true;
      if (
        q.questionType === 'b1' &&
        q.subQuestions?.some((sq) => sq.content.toLowerCase().includes(kw))
      ) {
        return true;
      }
      return false;
    });
  }, [activeList, keyword, reasonFilter]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [allRes, importantRes] = await Promise.all([
        questionBankApi.getWrongBookList(),
        questionBankApi.getImportantWrongBookList(),
      ]);
      setQuestions(allRes.items);
      setImportantQuestions(importantRes.items);
    } catch (error) {
      logger.error('加载错题本失败', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (stats) return; // 已加载则不再重复加载，筛选变化时手动触发
    try {
      setStatsLoading(true);
      const res = await getWrongBookStats({
        reason: reasonFilter || undefined,
        difficulty: difficultyFilter || undefined,
      });
      setStats(res);
    } catch (error) {
      logger.error('加载统计数据失败', error);
      toast.error('统计加载失败');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (mainTab === 'stats') {
      loadStats();
    }
  }, [mainTab, reasonFilter, difficultyFilter]);

  const startPracticeWithIds = async (ids: string[], title: string) => {
    if (ids.length === 0) {
      toast.error('暂无符合条件的错题');
      return;
    }
    try {
      setStarting(true);
      const res = await questionBankApi.generateRandomBankByIds({
        questionIds: ids,
        name: `${title}_${ids.length}题`,
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
    const title = subTab === 'important' ? '重点错题练习' : '错题练习';
    void startPracticeWithIds(
      filteredQuestions.map((q) => q.id),
      title,
    );
  };

  const handleQuestionClick = (questionId: string) => {
    const title = subTab === 'important' ? '重点错题单练' : '错题单练';
    void startPracticeWithIds([questionId], title);
  };

  const handleMarkMastered = async (questionId: string) => {
    try {
      await questionBankApi.markQuestionMastered(questionId, true);
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setImportantQuestions((prev) => prev.filter((q) => q.id !== questionId));
      toast.success('已标记为掌握，从错题本移除');
    } catch (error) {
      logger.error('标记掌握失败', error);
      toast.error('操作失败');
    }
  };

  const handleRemoveFromWrongBook = async (questionId: string) => {
    try {
      const res = await questionBankApi.removeFromWrongBook(questionId);
      if (res.removed) {
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
        setImportantQuestions((prev) => prev.filter((q) => q.id !== questionId));
        toast.success('已从错题本移除');
      } else {
        toast.info('该题不在错题本中');
      }
    } catch (error) {
      logger.error('移出错题本失败', error);
      toast.error('操作失败');
    }
  };

  const computeStatsFromLocal = (): WrongBookStatsResponse => {
    const allWrong = questions;
    const reasonMap = new Map<string, number>();
    const typeMap = new Map<string, number>();
    const diffMap = new Map<string, number>();
    const knowMap = new Map<string, number>();
    const dateMap = new Map<string, number>();

    const WRONG_REASON_LABELS: Record<string, string> = {
      concept_unclear: '概念不清',
      careless: '粗心大意',
      dont_know: '不会做',
      no_time: '时间不够',
      dispute: '题目争议',
      other: '其他',
    };

    for (const q of allWrong) {
      const reason = q.wrongReason || 'other';
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);

      const type = q.questionType || 'single';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);

      const diff = (q.difficulty as string) || 'medium';
      diffMap.set(diff, (diffMap.get(diff) || 0) + 1);

      const qAny = q as any;
      if (qAny.tags && Array.isArray(qAny.tags)) {
        for (const tag of qAny.tags) {
          const tname = typeof tag === 'string' ? tag : tag?.name || '';
          if (tname) knowMap.set(tname, (knowMap.get(tname) || 0) + 1);
        }
      }

      const dateKey = qAny.lastWrongAt
        ? String(qAny.lastWrongAt).slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
    }

    const total = allWrong.length || 1;
    const byReason = Array.from(reasonMap.entries()).map(([reason, count]) => ({
      reason: reason as WrongReason,
      count,
      rate: Number(((count / total) * 100).toFixed(1)),
    }));
    const byType = Array.from(typeMap.entries()).map(([type, count]) => ({
      type: type as any,
      count,
      rate: Number(((count / total) * 100).toFixed(1)),
    }));
    const byDifficulty = Array.from(diffMap.entries()).map(([difficulty, count]) => ({
      difficulty: difficulty as DifficultyLevel,
      count,
      rate: Number(((count / total) * 100).toFixed(1)),
    }));
    const byKnowledge = Array.from(knowMap.entries())
      .map(([tagName, count]) => ({
        tagId: '',
        tagName,
        count,
        rate: Number(((count / total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const today = new Date();
    const byDate: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      byDate.push({ date: ds, count: dateMap.get(ds) || 0 });
    }

    return {
      totalWrong: allWrong.length,
      byReason,
      byType,
      byDifficulty,
      byKnowledge,
      byDate,
    } as any as WrongBookStatsResponse;
  };

  const displayStats = stats || computeStatsFromLocal();

  const handleStartStreak = () => {
    if (filteredQuestions.length === 0) {
      toast.error('暂无符合条件的错题');
      return;
    }
    setStreakOpen(true);
  };

  const handleQuestionMastered = (questionId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    setImportantQuestions((prev) => prev.filter((q) => q.id !== questionId));
  };

  const handleReasonChanged = (questionId: string, reason: WrongReason) => {
    // 更新本地状态
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, wrongReason: reason } : q,
      ),
    );
    setImportantQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, wrongReason: reason } : q,
      ),
    );
    // 清除已缓存的统计，下次切到统计 tab 重新加载
    setStats(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const subTabs: { key: SubTab; label: string; count: number; icon: typeof BookX }[] = [
    { key: 'all', label: '全部错题', count: questions.length, icon: BookX },
    { key: 'important', label: '重点错题', count: importantQuestions.length, icon: Star },
  ];

  const mainTabs: { key: MainTab; label: string; icon: typeof BookX }[] = [
    { key: 'list', label: '错题列表', icon: BookX },
    { key: 'stats', label: '统计分析', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
            <BookX className="h-3.5 w-3.5" />
            错题巩固
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">错题本</h1>
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary tabular-nums">
              {APP_VERSION}
            </span>
            {user?.uid && (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary tabular-nums">
                UID: {user.uid}
              </span>
            )}
          </div>
<p className="mt-1 text-sm text-muted-foreground wallpaper-text-muted">
             答错的题目自动收录，重点错题基于练习记录智能筛选
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setExportOpen(true)}
            disabled={questions.length === 0}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            导出
          </Button>
          {mainTab === 'list' && questions.length > 0 && (
            <button
              type="button"
              onClick={handleStartStreak}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary via-purple-500 to-pink-500 px-4 py-2 text-sm font-medium text-white shadow-[0_4px_16px_hsl(265_85%_65%_/_0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_hsl(265_85%_65%_/_0.4)]"
            >
              <Flame className="h-4 w-4" />
              错题重练模式
            </button>
          )}
          {mainTab === 'list' && (
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
          )}
        </div>
      </div>

      {/* 主 Tab 切换 */}
      <div className="inline-flex items-center gap-1 rounded-2xl bg-muted/60 p-1.5 shadow-sm">
        {mainTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setMainTab(t.key)}
            className={`relative flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all duration-200 ${
              mainTab === t.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {mainTab === 'list' ? (
        <>
          {/* 筛选栏 */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ListFilter className="h-4 w-4" />
              <span className="font-medium text-foreground">筛选</span>
            </div>
            <div className="flex flex-1 flex-wrap gap-3">
              <Select
                value={reasonFilter}
                onValueChange={(v) => setReasonFilter(v as WrongReason | '')}
              >
                <SelectTrigger size="sm" className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WRONG_REASON_FILTERS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={difficultyFilter}
                onValueChange={(v) => setDifficultyFilter(v as DifficultyLevel | '')}
              >
                <SelectTrigger size="sm" className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_FILTERS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(reasonFilter || difficultyFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setReasonFilter('');
                  setDifficultyFilter('');
                }}
                className="text-xs text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
                清除筛选
              </Button>
            )}
          </div>

          {/* 子 Tab (全部/重点) */}
          <div className="inline-flex items-center gap-1 rounded-2xl bg-muted/40 p-1 shadow-sm">
            {subTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSubTab(t.key)}
                className={`relative flex items-center gap-2 rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                  subTab === t.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                <span
                  className={`ml-1 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                    subTab === t.key
                      ? 'bg-primary/10 text-primary'
                      : 'bg-background text-muted-foreground'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {subTab === 'important' && importantQuestions.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-gradient-to-r from-warning/10 to-amber-500/5 p-4 text-warning-foreground">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-semibold text-foreground">重点错题规则</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  同一题两次全错，或多次练习错误率大于 50%（至少 2 次）
                </p>
              </div>
            </div>
          )}

          {activeList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center card-hover">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-success/20 to-accent shadow-sm">
                <CheckCircle2 className="h-10 w-10 text-success" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {subTab === 'important' ? '暂无重点错题' : '暂无错题'}
              </h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                {subTab === 'important'
                  ? '继续练习，当题目错误率超过 50% 时会自动出现在这里'
                  : '继续保持！答错的题目会自动出现在这里'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索错题内容..."
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
                {keyword || reasonFilter ? (
                  <>
                    共找到 <span className="font-medium text-foreground tabular-nums">{filteredQuestions.length}</span> 道题
                  </>
                ) : (
                  <>共 {activeList.length} 道题</>
                )}
              </p>
              {filteredQuestions.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  未找到匹配的题目
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {filteredQuestions.slice(0, 10).map((q) => (
                      <Card
                        key={q.id}
                        onClick={() => handleQuestionClick(q.id)}
                        className="card-hover rounded-xl border border-border/60 shadow-sm cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                      >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                {subTab === 'important' && (
                                  <Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 fill-amber-500" />
                                )}
                                <CardTitle className="text-base font-semibold leading-relaxed line-clamp-2">{q.content}</CardTitle>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleRemoveFromWrongBook(q.id);
                                  }}
                                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  title="移出错题本"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleMarkMastered(q.id);
                                  }}
                                  className="shrink-0 text-success hover:bg-success/10 hover:text-success"
                                  title="标记为掌握并移除"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="flex flex-wrap items-center gap-2 text-xs pt-0">
                            <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 font-medium text-accent-foreground">
                              {q.questionType === 'single'
                                ? 'A1型题'
                                : q.questionType === 'multiple'
                                  ? 'X型题'
                                  : 'B1型题'}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 font-medium text-destructive tabular-nums">
                              答错 {q.wrongCount || 1} 次
                            </span>
                             <div onClick={(e) => e.stopPropagation()}>
                               <WrongReasonBadge
                                 questionId={q.id}
                                 reason={q.wrongReason}
                                 onChanged={(reason) => handleReasonChanged(q.id, reason)}
                               />
                             </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                  {filteredQuestions.length > 10 && (
                    <div className="flex items-center justify-between">
                      <p className="py-2 text-center text-sm text-muted-foreground">
                        还有 {filteredQuestions.length - 10} 道题…
                      </p>
                      <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                        查看全部
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <WrongBookStats stats={displayStats} loading={statsLoading} />
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {subTab === 'important' ? '重点错题列表' : '错题列表'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <QuestionPreview
              questions={activeList}
              loading={false}
              searchPlaceholder="搜索错题内容..."
            />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <QuestionExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        source="wrongbook"
        fetchFn={(params) =>
          getWrongBookExportList(params as unknown as Parameters<typeof getWrongBookExportList>[0])
        }
        defaultReason={reasonFilter || undefined}
        defaultDifficulty={difficultyFilter || undefined}
      />

      <StreakPractice
        open={streakOpen}
        onOpenChange={setStreakOpen}
        questions={filteredQuestions}
        target={3}
        onQuestionMastered={handleQuestionMastered}
      />
    </div>
  );
};

export default WrongBookPage;
