import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from '@client/src/utils/router';
import {
  Shuffle,
  Loader2,
  Star,
  BookX,
  Tag as TagIcon,
  Globe,
  Lock,
  Search,
  X,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@client/src/components/ui/tooltip';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@client/src/components/ui/tabs';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { getTagColor } from '@client/src/components/TagChip';

import { questionBankApi, questionTagApi } from '@client/src/api';
import type { QuestionBankItem, QuestionTagItem, QuestionItem } from '@shared/api.interface';
import { useAuth } from '@client/src/contexts/AuthContext';
import PracticeModeDialog, { type PracticeMode } from '@client/src/components/practice/PracticeModeDialog';
import { getDefaultPracticeMode, PRACTICE_LAST_MODE_KEY } from '@client/src/utils/practice-mode';
import { safeSetItem } from '@client/src/utils/env';

const GUEST_PRACTICE_KEY = 'guest_practice_session';

interface GuestPracticeSession {
  bankId: string;
  bankName: string;
  questions: QuestionItem[];
}

function setGuestPracticeSession(data: GuestPracticeSession): void {
  try {
    sessionStorage.setItem(GUEST_PRACTICE_KEY, JSON.stringify(data));
  } catch {
    // storage unavailable, ignore
  }
}

interface RandomDrawDialogProps {
  banks: QuestionBankItem[];
  onSuccess: () => void;
  triggerVariant?: 'default' | 'secondary';
}

const QUICK_OPTIONS = [10, 20];
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 100;

interface VirtualSource {
  id: string;
  name: string;
  questionCount: number;
  virtual: 'favorite' | 'wrongbook';
}

const RandomDrawDialog = ({
  banks,
  onSuccess,
  triggerVariant = 'secondary',
}: RandomDrawDialogProps) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'bank' | 'tag'>('bank');
  const navigate = useNavigate();

  // === 模式选择对话框状态 ===
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const generatedBankRef = useRef<{ bankId: string; bankName: string; questionCount: number } | null>(null);

  // === Bank mode state ===
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [countType, setCountType] = useState<'quick' | 'custom'>('quick');
  const [quickCount, setQuickCount] = useState(20);
  const [customCount, setCustomCount] = useState<number>(20);
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingVirtual, setLoadingVirtual] = useState(false);
  const [virtualSources, setVirtualSources] = useState<VirtualSource[]>([]);
  const [bankSourceType, setBankSourceType] = useState<'mine' | 'public' | 'all'>('mine');
  const [publicBanks, setPublicBanks] = useState<QuestionBankItem[]>([]);
  const [publicBanksLoading, setPublicBanksLoading] = useState(false);
  const [publicBanksLoaded, setPublicBanksLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { isGuest } = useAuth();

  // === Tag mode state ===
  const [allTags, setAllTags] = useState<QuestionTagItem[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagCount, setTagCount] = useState<number>(10);
  const [tagsLoading, setTagsLoading] = useState(false);

  interface BankSourceItem {
    id: string;
    name: string;
    questionCount: number;
    virtual: 'favorite' | 'wrongbook' | null;
    isPublic: boolean;
  }

  const loadPublicBanks = async () => {
    if (publicBanksLoaded || publicBanksLoading) return;
    try {
      setPublicBanksLoading(true);
      const res = isGuest
        ? await questionBankApi.getPublicBanks()
        : await questionBankApi.getBanks({ visibility: 'public' });
      setPublicBanks(res.items);
      setPublicBanksLoaded(true);
    } catch (error) {
      logger.error('加载公共题集失败', error);
    } finally {
      setPublicBanksLoading(false);
    }
  };

  useEffect(() => {
    if (open && (bankSourceType === 'public' || bankSourceType === 'all')) {
      loadPublicBanks();
    }
  }, [open, bankSourceType]);

  const allSources = useMemo<BankSourceItem[]>(() => {
    const myBankItems: BankSourceItem[] = banks.map((b) => ({
      id: b.id,
      name: b.name,
      questionCount: b.questionCount,
      virtual: null,
      isPublic: b.isPublic,
    }));

    const publicBankItems: BankSourceItem[] = publicBanks.map((b) => ({
      id: b.id,
      name: b.name,
      questionCount: b.questionCount,
      virtual: null,
      isPublic: true,
    }));

    const virtualItems: BankSourceItem[] = virtualSources.map((v) => ({
      id: v.id,
      name: v.name,
      questionCount: v.questionCount,
      virtual: v.virtual,
      isPublic: false,
    }));

    const myBankIds = new Set(banks.map((b: QuestionBankItem) => b.id));

    if (bankSourceType === 'mine') {
      return [...myBankItems, ...virtualItems];
    }
    if (bankSourceType === 'public') {
      return publicBankItems;
    }
    // all：我的题集 + 公共题集（去重）+ 虚拟题源
    const uniquePublic = publicBankItems.filter((b) => !myBankIds.has(b.id));
    return [...myBankItems, ...uniquePublic, ...virtualItems];
  }, [banks, publicBanks, virtualSources, bankSourceType]);

  const visibleSources = useMemo<BankSourceItem[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allSources;
    return allSources.filter((s) => s.name.toLowerCase().includes(q));
  }, [allSources, searchQuery]);

  const totalBankAvailable = useMemo(() => {
    return allSources
      .filter((b) => selectedBankIds.includes(b.id))
      .reduce((sum, b) => sum + b.questionCount, 0);
  }, [allSources, selectedBankIds]);

  const visibleAvailableCount = visibleSources.filter(
    (s) => s.questionCount > 0,
  ).length;

  const totalTagAvailable = useMemo(() => {
    return allTags
      .filter((t) => selectedTagIds.includes(t.id))
      .reduce((sum, t) => sum + (t.questionCount ?? 0), 0);
  }, [allTags, selectedTagIds]);

  const effectiveMaxBank = Math.min(
    Math.max(totalBankAvailable, MIN_QUESTION_COUNT),
    MAX_QUESTION_COUNT,
  );
  const effectiveMaxTag = Math.min(
    Math.max(totalTagAvailable, MIN_QUESTION_COUNT),
    MAX_QUESTION_COUNT,
  );

  const finalBankCount = countType === 'quick' ? quickCount : customCount;
  const finalCount = mode === 'bank' ? finalBankCount : tagCount;
  const totalAvailable = mode === 'bank' ? totalBankAvailable : totalTagAvailable;

  // === Handlers ===

  const handleToggleBank = (id: string, checked: boolean) => {
    setSelectedBankIds((prev) =>
      checked ? [...prev, id] : prev.filter((i) => i !== id),
    );
  };

  const handleAllBankToggle = (checked: boolean) => {
    if (checked) {
      const visibleIds = visibleSources
        .filter((s) => s.questionCount > 0)
        .map((b) => b.id);
      setSelectedBankIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    } else {
      const visibleIds = new Set(visibleSources.map((s) => s.id));
      setSelectedBankIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    }
  };

  const allVisibleSelected = useMemo(() => {
    const selectable = visibleSources.filter((s) => s.questionCount > 0);
    if (selectable.length === 0) return false;
    return selectable.every((s) => selectedBankIds.includes(s.id));
  }, [visibleSources, selectedBankIds]);

  const handleToggleTag = (id: string, checked: boolean) => {
    setSelectedTagIds((prev) =>
      checked ? [...prev, id] : prev.filter((i) => i !== id),
    );
  };

  const handleAllTagToggle = (checked: boolean) => {
    if (checked) {
      setSelectedTagIds(
        allTags.filter((t) => (t.questionCount ?? 0) > 0).map((t) => t.id),
      );
    } else {
      setSelectedTagIds([]);
    }
  };

  const loadVirtualSources = async () => {
    if (isGuest) return;
    try {
      setLoadingVirtual(true);
      const [favRes, wrongRes] = await Promise.all([
        questionBankApi.getFavoriteList(),
        questionBankApi.getWrongBookList(),
      ]);
      setVirtualSources([
        {
          id: '__favorite__',
          name: '收藏',
          questionCount: favRes.items.length,
          virtual: 'favorite',
        },
        {
          id: '__wrongbook__',
          name: '错题本',
          questionCount: wrongRes.items.length,
          virtual: 'wrongbook',
        },
      ]);
    } catch (error) {
      logger.error('加载虚拟题源失败', error);
    } finally {
      setLoadingVirtual(false);
    }
  };

  const loadTags = async () => {
    if (isGuest) return;
    try {
      setTagsLoading(true);
      const res = await questionTagApi.listTags();
      setAllTags(res.items);
    } catch (error) {
      logger.error('加载标签列表失败', error);
    } finally {
      setTagsLoading(false);
    }
  };

  useEffect(() => {
    if (open && mode === 'tag' && allTags.length === 0 && !tagsLoading) {
      loadTags();
    }
  }, [open, mode, allTags.length, tagsLoading]);

  const canSubmit =
    (mode === 'bank' ? selectedBankIds.length > 0 : selectedTagIds.length > 0) &&
    finalCount >= MIN_QUESTION_COUNT &&
    finalCount <= MAX_QUESTION_COUNT &&
    finalCount <= totalAvailable &&
    !loading;

  const disabledReason = (() => {
    if (loading) return '生成中...';
    if (mode === 'bank' && selectedBankIds.length === 0) return '请至少选择一个题源';
    if (mode === 'tag' && selectedTagIds.length === 0) return '请至少选择一个标签';
    if (finalCount < MIN_QUESTION_COUNT) return `至少 ${MIN_QUESTION_COUNT} 道`;
    if (finalCount > MAX_QUESTION_COUNT) return `最多 ${MAX_QUESTION_COUNT} 道`;
    if (totalAvailable === 0) return '所选题源/标签没有可用题目';
    if (finalCount > totalAvailable) return `最多 ${totalAvailable} 道可用`;
    return '';
  })();

  logger.debug('[RandomDraw] canSubmit 状态', {
    mode,
    selectedBankIds: selectedBankIds.length,
    selectedTagIds: selectedTagIds.length,
    finalCount,
    totalAvailable,
    loading,
    canSubmit,
    disabledReason,
  });

  const handleGenerateByBanks = async () => {
    const regularIds = selectedBankIds.filter((id) => !id.startsWith('__'));
    const useFavorite = selectedBankIds.includes('__favorite__');
    const useWrongBook = selectedBankIds.includes('__wrongbook__');

    const questionIds: string[] = [];
    const allQuestions: QuestionItem[] = [];

    if (regularIds.length > 0) {
      const publicBankIdSet = new Set(publicBanks.map((b: QuestionBankItem) => b.id));
      const results = await Promise.all(
        regularIds.map((id) =>
          publicBankIdSet.has(id)
            ? questionBankApi.getPublicBankQuestions(id)
            : questionBankApi.getQuestions(id),
        ),
      );
      for (const res of results) {
        for (const q of res.items) {
          questionIds.push(q.id);
          if (isGuest) {
            allQuestions.push(q as QuestionItem);
          }
        }
      }
    }

    if (useFavorite) {
      const res = await questionBankApi.getFavoriteList();
      for (const q of res.items) {
        questionIds.push(q.id);
      }
    }

    if (useWrongBook) {
      const res = await questionBankApi.getWrongBookList();
      for (const q of res.items) {
        questionIds.push(q.id);
      }
    }

    const uniqueIds = Array.from(new Set(questionIds));
    if (uniqueIds.length < finalBankCount) {
      toast.error(`抽题数量不能超过可用题目总数（${uniqueIds.length} 道）`);
      return null;
    }

    // 游客模式：前端抽题 + 跳转，不调用后端 create 接口
    if (isGuest) {
      const seen = new Set<string>();
      const uniqueQuestions: QuestionItem[] = [];
      for (const q of allQuestions) {
        if (seen.has(q.id)) continue;
        seen.add(q.id);
        uniqueQuestions.push(q);
      }
      const shuffled = [...uniqueQuestions]
        .sort(() => Math.random() - 0.5)
        .slice(0, finalBankCount);
      const virtualBankId = `guest-random-${Date.now()}`;
      const bankName = customName.trim() || `随机抽题_${finalBankCount}题`;
      setGuestPracticeSession({
        bankId: virtualBankId,
        bankName,
        questions: shuffled,
      });
      setOpen(false);
      onSuccess();
      setModeDialogOpen(true);
      generatedBankRef.current = {
        bankId: virtualBankId,
        bankName,
        questionCount: shuffled.length,
      };
      return null;
    }

    const shuffled = [...uniqueIds]
      .sort(() => Math.random() - 0.5)
      .slice(0, finalBankCount);

    return questionBankApi.generateRandomBankByIds({
      questionIds: shuffled,
      name: customName.trim() || undefined,
    });
  };

  const handleGenerate = async () => {
    logger.info('[RandomDraw] 点击立即开始练习', {
      mode,
      countType,
      finalCount,
      totalAvailable,
      canSubmit,
      selectedBankIds: selectedBankIds.length,
      selectedTagIds: selectedTagIds.length,
    });
    if (!canSubmit) {
      logger.warn('[RandomDraw] canSubmit 为 false，已阻止提交', { disabledReason });
      return;
    }
    try {
      setLoading(true);
      let res;

      if (mode === 'bank') {
        res = await handleGenerateByBanks();
        if (!res) {
          setLoading(false);
          return;
        }
      } else {
        if (isGuest) {
          toast.info('请登录后使用标签抽题');
          setLoading(false);
          return;
        }
        res = await questionTagApi.generateBankByTags({
          tagIds: selectedTagIds,
          questionCount: tagCount,
          name: customName.trim() || undefined,
        });
      }

      if (res && res.bankId) {
        toast.success(`已生成临时题集「${res.name}」`);
        setOpen(false);
        onSuccess();
        setModeDialogOpen(true);
        generatedBankRef.current = {
          bankId: res.bankId,
          bankName: res.name,
          questionCount: finalCount,
        };
      } else {
        throw new Error('生成失败');
      }
    } catch (error: unknown) {
      logger.error('生成随机题集失败', error);
      let msg = '生成失败，请重试';
      if (error && typeof error === 'object' && 'response' in error) {
        const resp = (error as { response?: { data?: { message?: string; statusCode?: number } } }).response;
        if (resp?.data?.message) {
          msg = resp.data.message;
        }
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const defaultMode = getDefaultPracticeMode();

  const handleModeSelect = (practiceMode: PracticeMode): void => {
    safeSetItem(PRACTICE_LAST_MODE_KEY, practiceMode);
    const info = generatedBankRef.current;
    if (!info) return;
    navigate(`/practice/${info.bankId}?mode=${practiceMode}`);
  };

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (val) {
      setMode('bank');
      setBankSourceType(isGuest ? 'public' : 'mine');
      setSearchQuery('');
      setSelectedBankIds([]);
      setSelectedTagIds([]);
      setCountType('quick');
      setQuickCount(20);
      setCustomCount(20);
      setTagCount(10);
      setCustomName('');
      loadVirtualSources();
    }
  };

  const availableBankCount = allSources.filter((s) => s.questionCount > 0).length;
  const visibleBankCount = visibleSources.filter((s) => s.questionCount > 0).length;
  const availableTagCount = allTags.filter(
    (t) => (t.questionCount ?? 0) > 0,
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>
          <Shuffle className="mr-2 h-4 w-4" />
          随机抽题
        </Button>
      </DialogTrigger>
      <DialogContent>
         <DialogHeader>
           <DialogTitle>随机抽题</DialogTitle>
            <DialogDescription>
              从已有的题集或标签中随机抽取指定数量的题目，组成临时题集进行练习。
            </DialogDescription>
         </DialogHeader>

         <DialogBody>
         <Tabs value={mode} onValueChange={(v) => setMode(v as 'bank' | 'tag')}>
            <TabsList className="grid w-full grid-cols-2 mb-5">
               <TabsTrigger value="bank">按题集抽题</TabsTrigger>
              <TabsTrigger value="tag" disabled={isGuest}>
                按标签抽题
                {isGuest && <span className="ml-1 text-[10px] opacity-60">（需登录）</span>}
              </TabsTrigger>
            </TabsList>

           <div className="space-y-5">
            <TabsContent value="bank" className="space-y-5 mt-0">
               <BankSourcePanel
                 sources={visibleSources}
                 selectedIds={selectedBankIds}
                 loadingVirtual={loadingVirtual}
                 publicBanksLoading={publicBanksLoading}
                 bankSourceType={bankSourceType}
                 searchQuery={searchQuery}
                 allVisibleSelected={allVisibleSelected}
                 availableCount={visibleBankCount}
                 totalAvailable={totalBankAvailable}
                 onToggle={handleToggleBank}
                 onAllToggle={handleAllBankToggle}
                 onSourceTypeChange={setBankSourceType}
                 onSearchChange={setSearchQuery}
               />
             </TabsContent>

            <TabsContent value="tag" className="space-y-5 mt-0">
              <TagSourcePanel
                allTags={allTags}
                selectedIds={selectedTagIds}
                loading={tagsLoading}
                availableCount={availableTagCount}
                totalAvailable={totalTagAvailable}
                onToggle={handleToggleTag}
                onAllToggle={handleAllTagToggle}
              />
            </TabsContent>

            <div className="space-y-3">
              <Label className="text-sm font-medium">抽题数量</Label>
              {mode === 'bank' ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_OPTIONS.map((num) => (
                      <Button
                        key={num}
                        type="button"
                        variant={
                          countType === 'quick' && quickCount === num
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => {
                          setCountType('quick');
                          setQuickCount(num);
                        }}
                      >
                        {num} 题
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant={countType === 'custom' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCountType('custom')}
                    >
                      自定义
                    </Button>
                  </div>
                  {countType === 'custom' && (
                    <div className="flex items-center gap-2">
                       <Input
                         type="number"
                         min={MIN_QUESTION_COUNT}
                         max={effectiveMaxBank}
                         value={customCount || ''}
                         onChange={(e) => {
                           const val = parseInt(e.target.value, 10);
                           if (Number.isNaN(val)) {
                             setCustomCount(0);
                           } else {
                             setCustomCount(Math.max(0, val));
                           }
                         }}
                         placeholder="请输入题数"
                         className="w-40"
                       />
                       <span className="text-xs text-muted-foreground">
                         {MIN_QUESTION_COUNT}-{MAX_QUESTION_COUNT} 题，最多 {totalBankAvailable} 道可用
                       </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                 <Input
                   type="number"
                   min={MIN_QUESTION_COUNT}
                   max={effectiveMaxTag}
                   value={tagCount || ''}
                   onChange={(e) => {
                     const val = parseInt(e.target.value, 10);
                     if (Number.isNaN(val)) {
                       setTagCount(0);
                     } else {
                       setTagCount(Math.max(0, val));
                     }
                   }}
                   placeholder="请输入题数"
                   className="w-40"
                 />
                 <span className="text-xs text-muted-foreground">
                   {MIN_QUESTION_COUNT}-{MAX_QUESTION_COUNT} 题，最多 {totalTagAvailable} 道可用
                 </span>
                </div>
              )}
              {totalAvailable > 0 && finalCount > totalAvailable && (
                <p className="text-xs text-destructive">
                  抽题数量不能超过可用题目总数（{totalAvailable} 道）
                </p>
              )}
              {finalCount < MIN_QUESTION_COUNT && (
                <p className="text-xs text-destructive">
                  抽题数量最少 {MIN_QUESTION_COUNT} 道
                </p>
              )}
              {finalCount > MAX_QUESTION_COUNT && (
                <p className="text-xs text-destructive">
                  抽题数量最多 {MAX_QUESTION_COUNT} 道
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="temp-name" className="text-sm font-medium">
                 临时题集名称{' '}
                 <span className="text-muted-foreground">(可选)</span>
              </Label>
              <Input
                id="temp-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                 placeholder="留空则自动生成，如 临时题集_2026-08-19_20题"
              />
            </div>
           </div>
         </Tabs>
        </DialogBody>

         <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            取消
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button onClick={handleGenerate} disabled={!canSubmit} className="gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                   立即开始练习
                </Button>
              </span>
            </TooltipTrigger>
            {!canSubmit && disabledReason && (
              <TooltipContent side="top">{disabledReason}</TooltipContent>
            )}
          </Tooltip>
        </DialogFooter>
      </DialogContent>
      <PracticeModeDialog
        open={modeDialogOpen}
        onOpenChange={setModeDialogOpen}
        onSelect={handleModeSelect}
        defaultMode={defaultMode}
        bankName={generatedBankRef.current?.bankName}
        questionCount={generatedBankRef.current?.questionCount}
      />
    </Dialog>
  );
};

function BankSourcePanel({
  sources,
  selectedIds,
  loadingVirtual,
  publicBanksLoading,
  bankSourceType,
  searchQuery,
  allVisibleSelected,
  availableCount,
  totalAvailable,
  onToggle,
  onAllToggle,
  onSourceTypeChange,
  onSearchChange,
}: {
  sources: Array<{
    id: string;
    name: string;
    questionCount: number;
    virtual: 'favorite' | 'wrongbook' | null;
    isPublic: boolean;
  }>;
  selectedIds: string[];
  loadingVirtual: boolean;
  publicBanksLoading: boolean;
  bankSourceType: 'mine' | 'public' | 'all';
  searchQuery: string;
  allVisibleSelected: boolean;
  availableCount: number;
  totalAvailable: number;
  onToggle: (id: string, checked: boolean) => void;
  onAllToggle: (checked: boolean) => void;
  onSourceTypeChange: (val: 'mine' | 'public' | 'all') => void;
  onSearchChange: (val: string) => void;
}) {
  const isLoading = loadingVirtual || publicBanksLoading;
  const showEmpty = !isLoading && sources.length === 0;
  const isSearchEmpty = !isLoading && searchQuery.trim() && sources.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">选择题源</Label>
        <button
          type="button"
          onClick={() => onAllToggle(!allVisibleSelected)}
          className="text-xs text-primary hover:underline"
        >
          {allVisibleSelected ? '取消全选' : '全选'}
        </button>
      </div>

      <Tabs
        value={bankSourceType}
        onValueChange={(v) => onSourceTypeChange(v as 'mine' | 'public' | 'all')}
      >
        <TabsList className="grid w-full grid-cols-3">
           <TabsTrigger value="mine">我的题集</TabsTrigger>
           <TabsTrigger value="public">公共题集</TabsTrigger>
           <TabsTrigger value="all">全部题集</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
           placeholder="搜索题集名称..."
          className="h-9 rounded-lg border border-border pl-9 pr-9 text-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
        ) : isSearchEmpty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
             没有匹配的题集
          </p>
        ) : showEmpty ? (
           <p className="py-8 text-center text-sm text-muted-foreground">暂无可用题集</p>
        ) : (
          sources.map((source) => {
            const isVirtual = source.virtual !== null;
            return (
              <div
                key={source.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/40"
              >
                <Checkbox
                  id={`bank-${source.id}`}
                  checked={selectedIds.includes(source.id)}
                  disabled={source.questionCount === 0}
                  onCheckedChange={(checked) =>
                    onToggle(source.id, Boolean(checked))
                  }
                />
                <label
                  htmlFor={`bank-${source.id}`}
                  className="flex flex-1 cursor-pointer items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 truncate">
                    {source.virtual === 'favorite' && (
                      <Star className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    {source.virtual === 'wrongbook' && (
                      <BookX className="h-3.5 w-3.5 text-destructive" />
                    )}
                    {source.name}
                    {isVirtual && (
                      <span className="text-[10px] text-muted-foreground">(虚拟)</span>
                    )}
                    {!isVirtual && source.isPublic && (
                      <span className="text-[10px] rounded-full bg-blue-50 px-1.5 py-0.5 font-medium text-blue-600">
                        公共
                      </span>
                    )}
                  </span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {source.questionCount} 道
                  </span>
                </label>
              </div>
            );
          })
        )}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          已选 {selectedIds.length} 个题源，共 {totalAvailable} 道题可用
        </p>
      )}
    </div>
  );
}

function TagSourcePanel({
  allTags,
  selectedIds,
  loading,
  availableCount,
  totalAvailable,
  onToggle,
  onAllToggle,
}: {
  allTags: QuestionTagItem[];
  selectedIds: string[];
  loading: boolean;
  availableCount: number;
  totalAvailable: number;
  onToggle: (id: string, checked: boolean) => void;
  onAllToggle: (checked: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">选择标签</Label>
        <button
          type="button"
          onClick={() => onAllToggle(selectedIds.length !== availableCount)}
          className="text-xs text-primary hover:underline"
        >
          {selectedIds.length === availableCount ? '取消全选' : '全选'}
        </button>
      </div>
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
        ) : allTags.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            暂无可用标签
          </p>
        ) : (
          allTags.map((tag) => {
            const count = tag.questionCount ?? 0;
            const colorCfg = getTagColor(tag.color);
            const isPublic = tag.labelType === 'public';
            const TypeIcon = isPublic ? Globe : Lock;
            return (
              <div
                key={tag.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/40"
              >
                <Checkbox
                  id={`tag-src-${tag.id}`}
                  checked={selectedIds.includes(tag.id)}
                  disabled={count === 0}
                  onCheckedChange={(checked) =>
                    onToggle(tag.id, Boolean(checked))
                  }
                />
                <label
                  htmlFor={`tag-src-${tag.id}`}
                  className="flex flex-1 cursor-pointer items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 truncate">
                    <TagIcon className={`h-3.5 w-3.5 ${colorCfg.text}`} />
                    <TypeIcon
                      className={`h-3 w-3 flex-shrink-0 ${
                        isPublic ? 'text-blue-500' : 'text-muted-foreground'
                      }`}
                    />
                    {tag.name}
                  </span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {count} 道
                  </span>
                </label>
              </div>
            );
          })
        )}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          已选 {selectedIds.length} 个标签，共约 {totalAvailable} 道题（可能有重叠）
        </p>
      )}
    </div>
  );
}

export default RandomDrawDialog;
