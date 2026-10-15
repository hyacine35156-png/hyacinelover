import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from '@client/src/utils/router';
import { BookOpen, X, Globe, Lock, Menu, Plus, Upload, ListChecks, CheckSquare, Square, Trash2, Eye, EyeOff, Search, GraduationCap, ChevronDown, ChevronUp } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';

import { questionBankApi, subjectApi, checkinApi } from '@client/src/api';
import type { BankVisibility } from '@client/src/api/questionBank';
import type {
  QuestionBankItem,
  SubjectItem,
  CheckinStatusResponse,
  CheckinSettingItem,
  QuestionBankListResponse,
  BankSortBy,
} from '@shared/api.interface';
import ImportDialog from './ImportDialog';
import AddQuestionDialog from './AddQuestionDialog';
import RandomDrawDialog from './RandomDrawDialog';
import BankCardList from './BankCardList';
import BankSidebar, { type SubjectFilterValue } from './BankSidebar';
import CheckinDialog from '@client/src/components/CheckinDialog';
import { useAuth } from '@client/src/contexts/AuthContext';
import { getDownloadedBanks, openDB } from '@client/src/utils/offline-db';

const SORT_STORAGE_KEY = 'bank_sort_by';

const sortOptions: { value: BankSortBy; label: string }[] = [
  { value: 'created_at_desc', label: '最新创建' },
  { value: 'created_at_asc', label: '最早创建' },
  { value: 'question_count_desc', label: '题目最多' },
  { value: 'question_count_asc', label: '题目最少' },
  { value: 'name_asc', label: '名称 A-Z' },
  { value: 'name_desc', label: '名称 Z-A' },
  { value: 'last_practiced_desc', label: '最近练习' },
];

const BanksPage = () => {
  const { isGuest, isRealUser } = useAuth();
  const [allBanks, setAllBanks] = useState<QuestionBankItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [currentSubject, setCurrentSubject] =
    useState<SubjectFilterValue>('all');
  const [visibility, setVisibility] = useState<BankVisibility>(
    isGuest ? 'public' : 'all',
  );
  const [zcmuBanks, setZcmuBanks] = useState<QuestionBankItem[]>([]);
  const [zcmuLoading, setZcmuLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moving, setMoving] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [sortBy, setSortBy] = useState<BankSortBy>(() => {
    if (typeof window === 'undefined') return 'created_at_desc';
    try {
      const saved = window.localStorage.getItem(SORT_STORAGE_KEY);
      if (saved && sortOptions.some((o) => o.value === saved)) {
        return saved as BankSortBy;
      }
    } catch {
      // 忽略
    }
    return 'created_at_desc';
  });
  const [batchAction, setBatchAction] = useState<
    'delete' | 'move_subject' | 'set_public' | 'set_private' | null
  >(null);
  const [moveTargetSubject, setMoveTargetSubject] = useState<string>('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [checkinStatus, setCheckinStatus] =
    useState<CheckinStatusResponse | null>(null);
  const [checkinDialogOpen, setCheckinDialogOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [downloadedBankIds, setDownloadedBankIds] = useState<Set<string>>(new Set());
  const [filterCollapsed, setFilterCollapsed] = useState(true);
  const navigate = useNavigate();

  const loadSubjects = useCallback(async () => {
    try {
      setSubjectsLoading(true);
      const res = await subjectApi.listSubjects();
      setSubjects(res.items);
    } catch (error) {
      logger.error('加载科目列表失败', error);
    } finally {
      setSubjectsLoading(false);
    }
  }, [isRealUser]);

  useEffect(() => {
    if (isRealUser) {
      loadSubjects();
    } else {
      setSubjectsLoading(false);
    }
  }, [loadSubjects, isRealUser]);

  const loadBanks = useCallback(async () => {
    const shouldFetch = isGuest || isRealUser;
    if (!shouldFetch) {
      logger.info('[BanksPage] 认证状态未就绪，跳过题集加载', { isGuest, isRealUser });
      return;
    }
    try {
      setLoading(true);
      const res = isGuest
        ? await questionBankApi.getPublicBanks()
        : await questionBankApi.getBanks({ visibility, sortBy });
      const normalBanks = res.items.filter(
        (b: QuestionBankItem) =>
          b.bankType === 'normal' && !b.isTemporary,
      );
      setAllBanks(normalBanks);
    } catch (error) {
      logger.error('加载题集失败', error);
      toast.error('加载题集失败');
    } finally {
      setLoading(false);
    }
  }, [visibility, sortBy, isGuest, isRealUser]);

  const loadZcmuBanks = useCallback(async () => {
    if (!isGuest && !isRealUser) return;
    try {
      setZcmuLoading(true);
      const promises: Promise<QuestionBankListResponse>[] = [];
      if (isRealUser) {
        promises.push(questionBankApi.getBanks({ visibility: 'all', sortBy: 'created_at_desc' }));
      }
      promises.push(questionBankApi.getPublicBanks());
      const results = await Promise.all(promises);
      const seen = new Set<string>();
      const merged: QuestionBankItem[] = [];
      for (const r of results) {
        for (const b of r.items) {
          if (b.bankType !== 'normal' || b.isTemporary) continue;
          if (seen.has(b.id)) continue;
          if (!/(^|[\s_\-])ZCMU/.test(b.name)) continue;
          seen.add(b.id);
          merged.push(b);
        }
      }
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setZcmuBanks(merged);
    } catch (error) {
      logger.error('加载ZCMU失败', error);
    } finally {
      setZcmuLoading(false);
    }
  }, [isGuest, isRealUser]);

  useEffect(() => {
    if (isGuest || isRealUser) {
      loadBanks();
      if (visibility === 'zcmu') loadZcmuBanks();
    }
  }, [loadBanks, loadZcmuBanks, visibility, isGuest, isRealUser]);

  // 监听网络状态 + 已下载题集
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refreshDownloaded = async () => {
      try {
        await openDB();
        const list = await getDownloadedBanks();
        setDownloadedBankIds(new Set(list.map((b) => b.id)));
      } catch (err) {
        logger.error('加载已下载题集失败', err);
      }
    };

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => {
      setIsOffline(true);
      void refreshDownloaded();
    };

    // 初始化
    if (typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }
    void refreshDownloaded();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 定期刷新下载状态（应对其他标签页下载）
    const interval = setInterval(() => {
      void refreshDownloaded();
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const loadCheckinStatus = useCallback(async () => {
    if (isGuest) return;
    try {
      const res = await checkinApi.getStatus();
      setCheckinStatus(res);
    } catch (error) {
      logger.error('加载打卡状态失败', error);
    }
  }, [isGuest]);

  useEffect(() => {
    loadCheckinStatus();
  }, [loadCheckinStatus]);

  const handleCheckinSaved = (_setting: CheckinSettingItem): void => {
    void loadCheckinStatus();
  };

  const handleOpenCheckin = (): void => {
    if (isGuest) {
      toast.info('请登录后使用打卡功能');
      return;
    }
    setCheckinDialogOpen(true);
  };

  const banks = useMemo(() => {
    const source = visibility === 'zcmu' ? zcmuBanks : allBanks;
    let filtered = source;
    if (isOffline && downloadedBankIds.size > 0) {
      filtered = filtered.filter((b) => downloadedBankIds.has(b.id));
    }
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      filtered = filtered.filter((b) =>
        b.name.toLowerCase().includes(kw),
      );
    }
    if (visibility === 'zcmu') return filtered;
    if (currentSubject === 'all') return filtered;
    if (currentSubject === 'uncategorized')
      return filtered.filter((b) => !b.subjectId);
    return filtered.filter((b) => b.subjectId === currentSubject);
  }, [allBanks, zcmuBanks, visibility, currentSubject, isOffline, downloadedBankIds, searchKeyword]);

  const isPublicTab = visibility === 'public';
  const isZcmuTab = visibility === 'zcmu';
  const effectiveLoading = isZcmuTab ? zcmuLoading : loading;

  const totalCount = allBanks.length;
  const uncategorizedCount = allBanks.filter((b) => !b.subjectId).length;

  const subjectsWithCounts = useMemo<SubjectItem[]>(() => {
    const countMap = new Map<string, number>();
    for (const b of allBanks) {
      if (b.subjectId) {
        countMap.set(b.subjectId, (countMap.get(b.subjectId) ?? 0) + 1);
      }
    }
    return subjects.map((s) => ({
      ...s,
      bankCount: countMap.get(s.id) ?? s.bankCount ?? 0,
    }));
  }, [subjects, allBanks]);

  const subjectColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of subjects) {
      map[s.id] = s.color;
    }
    return map;
  }, [subjects]);

  const handleDelete = async (id: string) => {
    try {
      await questionBankApi.deleteBank(id);
      setAllBanks((prev) => prev.filter((b) => b.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      toast.success('删除成功');
    } catch (error) {
      logger.error('删除题集失败', error);
      toast.error('删除失败');
    }
  };

  const handleSortChange = (value: string) => {
    const valid = sortOptions.find((o) => o.value === value);
    if (!valid) return;
    setSortBy(valid.value);
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, valid.value);
    } catch {
      // 忽略
    }
  };

  const handleToggleBatchMode = () => {
    setBatchMode((prev) => !prev);
    setSelectedIds([]);
    setBatchAction(null);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === banks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(banks.map((b) => b.id));
    }
  };

  const handleInvertSelection = () => {
    const current = new Set(selectedIds);
    const inverted = banks.filter((b) => !current.has(b.id)).map((b) => b.id);
    setSelectedIds(inverted);
  };

  const handleCancelBatch = () => {
    setBatchMode(false);
    setSelectedIds([]);
    setBatchAction(null);
  };

  const executeBatchOperation = async () => {
    if (!batchAction || selectedIds.length === 0) return;
    try {
      setBatchLoading(true);
      const subjectId = batchAction === 'move_subject'
        ? (moveTargetSubject === '__uncategorized__' ? null : moveTargetSubject)
        : undefined;
      const result = await questionBankApi.batchOperation({
        bankIds: selectedIds,
        operation: batchAction,
        subjectId: subjectId ?? undefined,
      });
      const actionLabels: Record<string, string> = {
        delete: '删除',
        move_subject: '移动科目',
        set_public: '设为公开',
        set_private: '设为私密',
      };
      if (result.failCount === 0) {
        toast.success(`${actionLabels[batchAction]}成功，共 ${result.successCount} 个题集`);
      } else {
        toast.info(`成功 ${result.successCount} 个，失败 ${result.failCount} 个`);
      }
      setBatchAction(null);
      setSelectedIds([]);
      setBatchMode(false);
      void loadBanks();
      void loadSubjects();
    } catch (error) {
      logger.error('批量操作失败', error);
      toast.error('操作失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleBatchMove = async (targetSubjectId: string) => {
    if (selectedIds.length === 0) return;
    try {
      setMoving(true);
      const targetId =
        targetSubjectId === '__uncategorized__' ? null : targetSubjectId;
      await subjectApi.batchMoveBanks({
        bankIds: selectedIds,
        targetSubjectId: targetId,
      });
      toast.success(`已移动 ${selectedIds.length} 个题集`);
      setSelectedIds([]);
      loadBanks();
      loadSubjects();
    } catch (error) {
      logger.error('批量移动题集失败', error);
      toast.error('移动失败');
    } finally {
      setMoving(false);
    }
  };

  const hasSelection = selectedIds.length > 0;
  const allSelected = banks.length > 0 && selectedIds.length === banks.length;

  const visibilityTabs: { value: BankVisibility; label: string; icon: typeof BookOpen }[] = [
    { value: 'all', label: '全部', icon: BookOpen },
    ...(isGuest ? [] : [{ value: 'private' as const, label: '我的题集', icon: Lock }]),
    { value: 'public', label: '公开题集', icon: Globe },
    { value: 'zcmu', label: 'ZCMU', icon: GraduationCap },
  ];

  const handleVisibilityChange = (v: BankVisibility) => {
    setVisibility(v);
    setSelectedIds([]);
    if (v === 'zcmu') loadZcmuBanks();
  };

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <BankSidebar
            subjects={subjectsWithCounts}
            totalCount={totalCount}
            uncategorizedCount={uncategorizedCount}
            selected={currentSubject}
            onSelect={setCurrentSubject}
            checkinStatus={checkinStatus}
            onOpenCheckin={handleOpenCheckin}
          />
        </div>

        <div className="min-w-0 space-y-6">
          {hasSelection && batchMode && (
            <div className="sticky top-14 z-30 flex items-center justify-between rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] to-pink-400/[0.06] px-5 py-3 shadow-sm backdrop-blur-sm fade-in-up md:top-20">
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
                  {selectedIds.length}
                </span>
                <span className="font-medium text-foreground">已选中</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="gap-1"
                >
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {allSelected ? '全不选' : '全选'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleInvertSelection}
                  className="gap-1"
                >
                  反选
                </Button>
                <Select
                  value={moveTargetSubject}
                  onValueChange={(val) => {
                    setMoveTargetSubject(val);
                    setBatchAction('move_subject');
                  }}
                  disabled={moving}
                >
                  <SelectTrigger size="sm" className="w-44">
                    <SelectValue placeholder="移动到科目" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__uncategorized__">未分类</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBatchAction('set_public')}
                  className="gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                >
                  <Eye className="h-4 w-4" />
                  设为公开
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBatchAction('set_private')}
                  className="gap-1 text-muted-foreground"
                >
                  <EyeOff className="h-4 w-4" />
                  设为私密
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBatchAction('delete')}
                  className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  批量删除
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelBatch}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  取消
                </Button>
              </div>
            </div>
          )}

           <div className="space-y-5">
           <div className="space-y-4">
             <button
               type="button"
               onClick={() => setFilterCollapsed((v) => !v)}
               className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-2.5 text-left transition-colors hover:border-primary/30"
             >
               <div className="flex items-center gap-2">
                 <ListChecks className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">我的题集</span>
                 {filterCollapsed && (
                   <span className="text-xs text-muted-foreground">
                     ({banks.length} 个题集)
                   </span>
                 )}
               </div>
               {filterCollapsed ? (
                 <ChevronDown className="h-4 w-4 text-muted-foreground" />
               ) : (
                 <ChevronUp className="h-4 w-4 text-muted-foreground" />
               )}
             </button>

             {!filterCollapsed && (
              <div className="space-y-4 fade-in-up">
             <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  {/* Mobile hamburger button */}
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
                    aria-label="打开侧边栏"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                  <div className="inline-flex items-center gap-2 rounded-full bg-accent/80 px-3 py-1 text-xs font-medium text-accent-foreground">
                    <BookOpen className="h-3.5 w-3.5" />
                    {isPublicTab ? '发现' : '学习中心'}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight gradient-primary-text sm:text-2xl">
                      <span
                        className="inline-block h-6 w-1 rounded-full sm:h-7"
                        style={{
                          background:
                            'linear-gradient(180deg, hsl(265 85% 65%) 0%, hsl(290 75% 65%) 100%)',
                        }}
                      />
                       {isZcmuTab ? 'ZCMU' : (isPublicTab ? '公开题集广场' : '我的题集')}
                    </h1>
                    <p className="mt-1 text-xs text-muted-foreground sm:mt-1.5 sm:text-sm wallpaper-text-muted">
                        {searchKeyword.trim()
                          ? `搜索到 ${banks.length} 个题集`
                          : (isZcmuTab
                            ? `共 ${banks.length} 个 ZCMU 内容`
                            : (isPublicTab
                              ? `共 ${banks.length} 个公开题集，可复制或直接练习`
                              : `共 ${banks.length} 个题集，持续练习不断进步`))}
                     </p>
                  </div>
                </div>
              </div>
              {!isPublicTab || isGuest ? (
                 <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:min-w-0 md:overflow-visible md:px-0 md:pb-0">
                   <RandomDrawDialog
                     banks={banks}
                     onSuccess={loadBanks}
                     triggerVariant="secondary"
                   />
                   {isGuest ? (
                     <>
                       <Tooltip>
                         <TooltipTrigger asChild>
                           <span>
                             <Button
                               variant="outline"
                               disabled
                               className="opacity-60 cursor-not-allowed"
                             >
                               <Plus className="h-4 w-4" />
                               手动录入
                             </Button>
                           </span>
                         </TooltipTrigger>
                         <TooltipContent>请登录后使用此功能</TooltipContent>
                       </Tooltip>
                       <Tooltip>
                         <TooltipTrigger asChild>
                           <span>
                             <Button
                               variant="outline"
                               disabled
                               className="opacity-60 cursor-not-allowed"
                             >
                               <Upload className="h-4 w-4" />
                               导入文件
                             </Button>
                           </span>
                         </TooltipTrigger>
                         <TooltipContent>请登录后使用此功能</TooltipContent>
                       </Tooltip>
                     </>
                   ) : (
                     <>
                       <AddQuestionDialog banks={banks} onSuccess={loadBanks} />
                       <ImportDialog onSuccess={loadBanks} />
                     </>
                   )}
                 </div>
               ) : null}
            </div>

              <div className="relative w-full md:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="搜索题集..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="h-9 rounded-full border-border/60 bg-card pl-9 pr-9 text-xs shadow-sm sm:text-sm"
                />
                {searchKeyword && (
                  <button
                    type="button"
                    onClick={() => setSearchKeyword('')}
                    className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="清空搜索"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

               <div className="inline-flex items-center gap-1 rounded-xl bg-muted/60 p-1 overflow-x-auto max-w-full">
                 {visibilityTabs.map((tab) => {
                   const isZcmu = tab.value === 'zcmu';
                   const active = visibility === tab.value;
                   return (
                     <button
                       key={tab.value}
                       onClick={() => handleVisibilityChange(tab.value)}
                       className={`inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-200 sm:px-4 sm:text-sm ${
                         active
                           ? isZcmu
                             ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/25'
                             : 'bg-card text-foreground shadow-sm'
                           : isZcmu
                             ? 'text-amber-600 hover:bg-amber-50'
                             : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                       }`}
                     >
                       <tab.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                       {tab.label}
                     </button>
                   );
                 })}
               </div>

               {/* 排序下拉 + 批量管理 */}
               {!isPublicTab && !isGuest && (
                 <div className="flex items-center gap-2">
                   <Select value={sortBy} onValueChange={handleSortChange}>
                     <SelectTrigger
                       size="sm"
                       className="h-9 w-auto min-w-[120px] rounded-full border border-border/60 bg-card px-4 text-xs font-medium shadow-sm hover:border-primary/30"
                     >
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent align="end" className="w-40">
                       {sortOptions.map((opt) => (
                         <SelectItem key={opt.value} value={opt.value}>
                           {opt.label}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={handleToggleBatchMode}
                     className="hidden h-9 rounded-full border-border/60 bg-card px-4 text-xs font-medium text-muted-foreground shadow-sm hover:text-foreground hover:border-primary/30 transition-colors sm:inline-flex"
                   >
                     <ListChecks className="mr-1.5 h-3.5 w-3.5" />
                     {batchMode ? '退出批量' : '批量管理'}
                   </Button>
                 </div>
               )}
             </div>
             )}
           </div>

             <BankCardList
              banks={banks}
              loading={loading || subjectsLoading}
               emptyTitle={isPublicTab || isZcmuTab ? '暂无公开题集' : '还没有题集'}
               emptyDescription={
                 isPublicTab || isZcmuTab
                   ? '还没有用户分享公开题集，敬请期待'
                   : '导入文件或手动录入，创建你的第一个题集'
               }
              emptyIcon={BookOpen}
              onDelete={handleDelete}
              onPractice={(id) => navigate(`/practice/${id}`)}
              onRefresh={loadBanks}
              selectable={batchMode && !isPublicTab && !isZcmuTab && !isGuest}
              selectedIds={isGuest ? [] : selectedIds}
              batchMode={batchMode}
              onToggleSelect={handleToggleSelect}
              subjectColors={subjectColors}
              isMine={!isPublicTab && !isZcmuTab && !isGuest}
            />
          </div>
        </div>

        <CheckinDialog
          open={checkinDialogOpen}
          onOpenChange={setCheckinDialogOpen}
          initialStatus={checkinStatus}
          onSaved={handleCheckinSaved}
        />

        {/* 批量操作确认对话框 */}
        <Dialog
          open={batchAction !== null}
          onOpenChange={(open) => {
            if (!open && !batchLoading) setBatchAction(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {batchAction === 'delete' && '确认批量删除'}
                {batchAction === 'set_public' && '确认设为公开'}
                {batchAction === 'set_private' && '确认设为私密'}
                {batchAction === 'move_subject' && '确认移动科目'}
              </DialogTitle>
              <DialogDescription>
                {batchAction === 'delete' && (
                  <>
                    确定要删除选中的 <span className="font-semibold text-destructive">{selectedIds.length}</span> 个题集吗？
                     删除后将无法恢复，题集内的所有题目和相关作答记录都会被删除。
                  </>
                )}
                {batchAction === 'set_public' && (
                  <>
                    确定要将选中的 <span className="font-semibold text-foreground">{selectedIds.length}</span> 个题集设为公开吗？
                    设为公开后，其他用户可以查看、复制并练习这些题集。
                  </>
                )}
                {batchAction === 'set_private' && (
                  <>
                    确定要将选中的 <span className="font-semibold text-foreground">{selectedIds.length}</span> 个题集设为私密吗？
                    设为私密后，只有你自己可以查看和使用这些题集。
                  </>
                )}
                {batchAction === 'move_subject' && (
                  <>
                    确定要将选中的 <span className="font-semibold text-foreground">{selectedIds.length}</span> 个题集移动到
                    <span className="font-semibold text-primary"> {moveTargetSubject === '__uncategorized__' ? '未分类' : (subjects.find((s) => s.id === moveTargetSubject)?.name ?? '')} </span>
                    吗？
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setBatchAction(null)}
                disabled={batchLoading}
              >
                取消
              </Button>
              <Button
                onClick={executeBatchOperation}
                disabled={batchLoading}
                variant={batchAction === 'delete' ? 'destructive' : 'default'}
                style={batchAction !== 'delete' ? {
                  background: 'linear-gradient(135deg, hsl(265 85% 65%) 0%, hsl(290 75% 65%) 100%)',
                } : {}}
              >
                {batchLoading ? '处理中…' : '确认'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={handleCloseSidebar}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <div className="absolute left-0 top-0 bottom-0 z-50 w-[85vw] max-w-[320px] bg-card shadow-2xl animate-slide-in-left overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <span className="text-sm font-medium text-foreground">科目筛选</span>
              <button
                type="button"
                onClick={handleCloseSidebar}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="关闭侧边栏"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-2">
              <BankSidebar
                subjects={subjectsWithCounts}
                totalCount={totalCount}
                uncategorizedCount={uncategorizedCount}
                selected={currentSubject}
                onSelect={setCurrentSubject}
                checkinStatus={checkinStatus}
                 onOpenCheckin={() => {
                   if (isGuest) {
                     toast.info('请登录后使用打卡功能');
                     handleCloseSidebar();
                     return;
                   }
                   setCheckinDialogOpen(true);
                   handleCloseSidebar();
                 }}
                onCloseSidebar={handleCloseSidebar}
                sticky={false}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BanksPage;
