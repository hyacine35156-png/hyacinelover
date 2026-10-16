import { useState, useEffect } from 'react';
import { BookOpen, Target, CheckCircle2, Loader2, Trash2, Clock, Trophy, Download, ChevronsUpDown } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import ReactECharts from 'echarts-for-react';
import type { CallbackDataParams } from 'echarts/types/dist/shared';
import type { EChartsOption } from 'echarts';

import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@client/src/components/ui/accordion';

import { practiceRecordApi } from '@client/src/api';
import type {
  PracticeStatisticsResponse,
  PracticeRecordItem,
  PracticeRecordDetailAnswer,
  SubQuestion,
} from '@shared/api.interface';

const RecordsPage = () => {
  const [statistics, setStatistics] = useState<PracticeStatisticsResponse | null>(null);
  const [records, setRecords] = useState<PracticeRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMap, setDetailMap] = useState<
    Record<string, PracticeRecordDetailAnswer[]>
  >({});
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportRange, setExportRange] = useState<'today' | 'week' | 'all'>('all');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'excel'>('json');
  const [exportBankId, setExportBankId] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, recordsRes] = await Promise.all([
        practiceRecordApi.getStatistics(),
        practiceRecordApi.getRecords(page, PAGE_SIZE),
      ]);
      setStatistics(statsRes);
      setRecords(recordsRes.items);
      setTotal(recordsRes.total);
    } catch (error) {
      logger.error('加载记录失败', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await practiceRecordApi.exportPracticeRecords(
        exportRange,
        exportFormat,
        exportBankId === 'all' ? undefined : exportBankId,
      );
      toast.success(`已导出${exportFormat.toUpperCase()}文件`);
    } catch (error) {
      logger.error('导出失败', error);
      const msg = (error as Error)?.message || '导出失败';
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (detailMap[id]) return;

    try {
      setDetailLoading(true);
      const res = await practiceRecordApi.getRecordDetail(id);
      setDetailMap((prev) => ({ ...prev, [id]: res.answers }));
    } catch (error) {
      logger.error('加载详情失败', error);
      toast.error('加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      setDeleting(true);
      await practiceRecordApi.deleteRecord(deleteTargetId);
      setRecords((prev) => prev.filter((r) => r.id !== deleteTargetId));
      setDeleteTargetId(null);
      toast.success('已删除，统计数据已更新');
      const statsRes = await practiceRecordApi.getStatistics();
      setStatistics(statsRes);
    } catch (error) {
      logger.error('删除记录失败', error);
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
   };

  const toggleSelect = (id: string) => {
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

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r: PracticeRecordItem) => r.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      setBatchDeleting(true);
      const ids = Array.from(selectedIds);
      await practiceRecordApi.batchDeleteRecords(ids);
      setRecords((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      setBatchDeleteOpen(false);
      setBatchMode(false);
      toast.success(`已删除 ${ids.length} 条记录，统计数据已更新`);
      const statsRes = await practiceRecordApi.getStatistics();
      setStatistics(statsRes);
    } catch (error) {
      logger.error('批量删除失败', error);
      toast.error('批量删除失败');
    } finally {
      setBatchDeleting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}分${sec}秒`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in-up">
       <div>
         <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
           <CheckCircle2 className="h-3.5 w-3.5" />
           学习数据
         </div>
         <h1 className="text-2xl font-bold tracking-tight text-foreground">作答记录</h1>
         <p className="mt-1 text-sm text-muted-foreground">回顾你的学习轨迹，识别薄弱知识点</p>
       </div>

      <StatisticsCards statistics={statistics} />

      <Card className="rounded-xl border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              导出刷题记录
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">时间范围：</span>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(['today', 'week', 'all'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setExportRange(r)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      exportRange === r
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-foreground hover:bg-accent'
                    }`}
                  >
                    {r === 'today' ? '今日' : r === 'week' ? '本周' : '全部'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">题集：</span>
              <Select value={exportBankId} onValueChange={setExportBankId}>
                <SelectTrigger className="w-48 h-9">
                  <SelectValue placeholder="选择题集" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部题集</SelectItem>
                  {statistics?.bankStats.map((bank) => (
                    <SelectItem key={bank.bankId} value={bank.bankId}>
                      {bank.bankName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">格式：</span>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(['json', 'csv', 'excel'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setExportFormat(f)}
                    className={`px-3 py-1.5 text-xs font-medium uppercase transition-colors ${
                      exportFormat === f
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-foreground hover:bg-accent'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exporting ? '导出中…' : '导出记录'}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            导出内容包含每道题的题干、题型、用户选择、正确答案、对错情况、答题时间和所属题集；B1型题的每道子题单独列出。
          </p>
        </CardContent>
      </Card>

       {statistics && statistics.bankStats.length > 0 && (
         <Card className="card-hover rounded-xl border border-border/60 shadow-sm">
           <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">题集正确率排行</CardTitle>
           </CardHeader>
          <CardContent>
            <BankAccuracyChart bankStats={statistics.bankStats} />
          </CardContent>
        </Card>
      )}

        <Card className="rounded-xl border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">历史记录</CardTitle>
              <button
                type="button"
                onClick={() => {
                  setBatchMode(!batchMode);
                  setSelectedIds(new Set());
                }}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {batchMode ? '退出批量管理' : '批量管理'}
              </button>
            </div>
            {batchMode && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-accent/30 px-3 py-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-medium text-foreground hover:text-primary transition-colors"
                >
                  {selectedIds.size === records.length ? '取消全选' : '全选'}
                </button>
                <span className="text-xs text-muted-foreground">
                  已选 <span className="font-semibold text-primary">{selectedIds.size}</span> / {records.length}
                </span>
              </div>
            )}
          </CardHeader>
        <CardContent>
          {records.length === 0 ? (
             <div className="py-16 text-center">
               <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-accent shadow-sm">
                 <BookOpen className="h-8 w-8 text-primary" />
               </div>
               <p className="font-medium text-foreground">还没有作答记录</p>
                <p className="mt-1 text-sm text-muted-foreground">去练习，开启你的学习之旅吧！</p>
             </div>
          ) : (
            <div className="space-y-3">
                {records.map((record) => (
                 <RecordItem
                   key={record.id}
                   record={record}
                   expanded={expandedId === record.id}
                   answers={detailMap[record.id]}
                   detailLoading={detailLoading && expandedId === record.id}
                   onToggle={() => handleExpand(record.id)}
                   onDelete={() => setDeleteTargetId(record.id)}
                   formatTime={formatTime}
                   formatDate={formatDate}
                   batchMode={batchMode}
                   selected={selectedIds.has(record.id)}
                   onSelect={() => toggleSelect(record.id)}
                 />
               ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分页控件 */}
      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-border/60 bg-card px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            上一页
          </button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {Math.ceil(total / PAGE_SIZE)} 页（共 {total} 条）
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(Math.ceil(total / PAGE_SIZE), p + 1))}
            disabled={page >= Math.ceil(total / PAGE_SIZE)}
            className="rounded-lg border border-border/60 bg-card px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      )}

      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除该学习记录？删除后不可恢复，且不计入统计数据
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={batchDeleteOpen}
        onOpenChange={(open) => !open && !batchDeleting && setBatchDeleteOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除所选 {selectedIds.size} 条学习记录？删除后不可恢复，且不计入统计数据
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={batchDeleting || selectedIds.size === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {batchDeleting ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {batchMode && records.length > 0 && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border/60 bg-card/95 px-5 py-3 shadow-lg backdrop-blur"
          style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}
        >
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              已选 <span className="font-semibold text-primary">{selectedIds.size}</span> 条
            </span>
            <button
              type="button"
              onClick={() => setBatchDeleteOpen(true)}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 rounded-full bg-destructive px-4 py-1.5 text-sm font-medium text-destructive-foreground transition-all duration-200 hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              批量删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StatisticsCards = ({
  statistics,
}: {
  statistics: PracticeStatisticsResponse | null;
}) => {
  const statItems = [
    {
       label: '累计作答',
      value: statistics?.totalQuestions ?? 0,
      suffix: '题',
      icon: Target,
      gradient: 'from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)]',
      bgGradient: 'from-primary/15 to-[hsl(290_75%_65%)/15]',
    },
    {
      label: '总正确率',
      value: statistics ? `${(statistics.totalAccuracyRate * 100).toFixed(1)}` : '0',
      suffix: '%',
      icon: Trophy,
      gradient: 'from-[hsl(152_60%_45%)] to-[hsl(170_65%_50%)]',
      bgGradient: 'from-success/15 to-[hsl(170_65%_50%)/15]',
    },
    {
       label: '练习题集',
      value: statistics?.practicedBanks ?? 0,
      suffix: '个',
      icon: BookOpen,
      gradient: 'from-[hsl(215_85%_60%)] to-[hsl(265_85%_65%)]',
      bgGradient: 'from-info/15 to-primary/15',
    },
  ];

  return (
     <div
       className="grid grid-cols-1 gap-4 sm:grid-cols-3"
       data-ai-section-type="card-stat"
     >
       {statItems.map((item) => (
         <Card
           key={item.label}
           className="card-hover rounded-xl border border-border/60 shadow-sm bg-card overflow-hidden relative"
         >
           <div className={`absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-br ${item.bgGradient} opacity-60 blur-2xl -translate-y-8 translate-x-8`} />
           <CardContent className="relative flex items-center gap-4 p-6">
             <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient} shadow-md shadow-primary/20`}>
               <item.icon className="h-7 w-7 text-white" />
             </div>
             <div>
               <p className="text-3xl font-bold tabular-nums gradient-primary-text">
                 {item.value}
                 <span className="ml-1 text-sm font-normal text-muted-foreground">
                   {item.suffix}
                 </span>
               </p>
               <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
             </div>
           </CardContent>
         </Card>
       ))}
     </div>
  );
};

const BankAccuracyChart = ({
  bankStats,
}: {
  bankStats: { bankId: string; bankName: string; accuracyRate: number; totalCount: number }[];
}) => {
  const chartData = [...bankStats].sort((a, b) => a.accuracyRate - b.accuracyRate);

  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'hsl(260 25% 15%)',
      borderColor: 'transparent',
      textStyle: { color: '#fff', fontSize: 12 },
      padding: [8, 12],
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const p = list[0];
        const item = chartData[p.dataIndex as number];
        return `${item.bankName}<br/>正确率：${(item.accuracyRate * 100).toFixed(1)}%<br/>共 ${item.totalCount} 题`;
      },
    },
    grid: { left: '3%', right: '6%', bottom: '3%', top: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: {
        formatter: (value: number) => `${value}%`,
        color: 'hsl(260 15% 50%)',
        fontSize: 11,
      },
      splitLine: {
        lineStyle: { color: 'hsl(260 20% 92%)', type: 'dashed' },
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      data: chartData.map((item) => item.bankName),
      axisLabel: {
        color: 'hsl(260 25% 20%)',
        fontSize: 12,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: chartData.map((item) => +(item.accuracyRate * 100).toFixed(1)),
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: 'hsl(265 85% 75%)' },
              { offset: 1, color: 'hsl(290 75% 65%)' },
            ],
          },
        },
        label: {
          show: true,
          position: 'right',
          formatter: (p: CallbackDataParams) => `${p.value}%`,
          color: 'hsl(260 25% 30%)',
          fontSize: 12,
          fontWeight: 500,
        },
        barWidth: 22,
        emphasis: {
          itemStyle: {
            shadowBlur: 12,
            shadowColor: 'hsl(265 85% 65% / 0.4)',
          },
        },
      },
    ],
  };

  return <ReactECharts option={option} className="h-[300px] w-full" />;
};

const QUESTION_TYPE_LABEL: Record<string, string> = {
  single: 'A1型题',
  multiple: 'X型题',
  b1: 'B1型题',
};

const AnswerDetailCard = ({
  answer,
  index,
}: {
  answer: PracticeRecordDetailAnswer;
  index: number;
}) => {
  const isB1 = answer.questionType === 'b1';

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-200 ${
        answer.isCorrect
          ? 'border-success/30 bg-success/5 hover:bg-success/[0.07]'
          : 'border-destructive/30 bg-destructive/5 hover:bg-destructive/[0.07]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
            answer.isCorrect
              ? 'bg-success text-success-foreground'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {answer.isCorrect ? '✓' : '✗'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              第 {index + 1} 题
            </span>
            <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
              {QUESTION_TYPE_LABEL[answer.questionType] ?? '未知题型'}
            </span>
          </div>
          {isB1 ? (
            <B1AnswerContent answer={answer} />
          ) : (
            <StandardAnswerContent answer={answer} />
          )}
        </div>
      </div>
    </div>
  );
};

const StandardAnswerContent = ({
  answer,
}: {
  answer: PracticeRecordDetailAnswer;
}) => {
  return (
    <>
      <p className="mt-1.5 text-sm text-foreground leading-relaxed">{answer.questionContent}</p>
      {answer.options.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {answer.options.map((opt, idx) => {
            const isCorrect = answer.correctAnswers.includes(idx);
            const isUserSelected = answer.userAnswers.includes(idx);
            let optClass =
              'border-border/60 bg-card text-foreground';
            if (isCorrect) {
              optClass = 'border-success/40 bg-success/10 text-success-foreground';
            } else if (isUserSelected) {
              optClass = 'border-destructive/40 bg-destructive/10 text-destructive-foreground';
            }
            return (
              <div
                key={idx}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-all duration-200 ${optClass}`}
              >
                <span className="font-semibold">{opt.label}</span>
                <span className="text-muted-foreground/80">{opt.text}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 space-y-1 text-xs">
        <p className="text-muted-foreground">
          你的答案：
          <span className={`font-medium ${answer.isCorrect ? 'text-success' : 'text-destructive'}`}>
            {answer.userAnswers.length > 0
              ? answer.userAnswers
                  .map((i) => answer.options[i]?.label || '')
                  .join('、')
              : '未作答'}
          </span>
        </p>
        {!answer.isCorrect && (
          <p className="text-muted-foreground">
            正确答案：
            <span className="font-medium text-success">
              {answer.correctAnswers
                .map((i) => answer.options[i]?.label || '')
                .join('、')}
            </span>
          </p>
        )}
      </div>
    </>
  );
};

const B1AnswerContent = ({
  answer,
}: {
  answer: PracticeRecordDetailAnswer;
}) => {
  const subQuestions: SubQuestion[] = answer.subQuestions ?? [];

  return (
    <div className="mt-2 space-y-4">
      {/* 主题干 */}
      <p className="text-sm font-medium text-foreground leading-relaxed">
        {answer.questionContent}
      </p>

      {/* 共用备选答案 */}
      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          共用备选答案
        </p>
        <div className="flex flex-wrap gap-2">
          {answer.options.map((opt, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-foreground transition-all duration-200"
            >
              <span className="font-semibold text-accent-foreground">
                {opt.label}
              </span>
              <span className="text-muted-foreground/80">{opt.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 子问题列表 */}
      <div className="space-y-3">
        {subQuestions.map((sub, subIdx) => {
          const userAnswerIdx = answer.userAnswers[subIdx];
          const userLabel =
            userAnswerIdx !== undefined && userAnswerIdx >= 0
              ? answer.options[userAnswerIdx]?.label ?? ''
              : '';
          const correctLabel = sub.correctAnswer;
          const isSubCorrect = userLabel === correctLabel;

          return (
            <div
              key={subIdx}
              className={`rounded-xl border p-3 transition-all duration-200 ${
                isSubCorrect
                  ? 'border-success/30 bg-success/5'
                  : 'border-destructive/30 bg-destructive/5'
              }`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-sm ${
                    isSubCorrect
                      ? 'bg-success text-success-foreground'
                      : 'bg-destructive text-destructive-foreground'
                  }`}
                >
                  {isSubCorrect ? '✓' : '✗'}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-foreground leading-relaxed">
                    <span className="mr-1 font-semibold text-muted-foreground">
                      ({subIdx + 1})
                    </span>
                    {sub.content}
                  </p>
                  <div className="mt-2 space-y-1 text-xs">
                    <p className="text-muted-foreground">
                      用户选择：
                      <span
                        className={`font-medium ${
                          isSubCorrect ? 'text-success' : 'text-destructive'
                        }`}
                      >
                        {userLabel || '未作答'}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      正确答案：
                      <span className="font-medium text-success">{correctLabel}</span>
                    </p>
                  </div>
                  {sub.analysis && (
                    <div className="mt-2 rounded-lg border border-border/60 bg-accent/20 p-2.5">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                        💡 解析
                      </p>
                      <p className="text-xs leading-relaxed text-foreground">
                        {sub.analysis}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RecordItem = ({
  record,
  expanded,
  answers,
  detailLoading,
  onToggle,
  onDelete,
  formatTime,
  formatDate,
  batchMode,
  selected,
  onSelect,
}: {
  record: PracticeRecordItem;
  expanded: boolean;
  answers?: PracticeRecordDetailAnswer[];
  detailLoading: boolean;
  onToggle: () => void;
  onDelete: () => void;
  formatTime: (s: number) => string;
  formatDate: (iso: string) => string;
  batchMode?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) => {
  const totalCount = record.totalCount;
  const accuracyPercent = totalCount > 0
    ? ((record.correctCount / totalCount) * 100).toFixed(1)
    : '0.0';
  const accuracyNum = Number(accuracyPercent);
  const isLow = accuracyNum < 60;
  const isMedium = accuracyNum >= 60 && accuracyNum < 80;

  const barColor = isLow
    ? 'bg-destructive'
    : isMedium
      ? 'bg-warning'
      : 'bg-gradient-to-r from-success to-[hsl(170_65%_50%)]';

  return (
    <Accordion type="single" collapsible value={expanded ? record.id : ''} onValueChange={() => onToggle()}>
       <AccordionItem
         value={record.id}
         className="rounded-xl border border-border/60 bg-card transition-all duration-200 hover:border-border hover:shadow-sm data-[state=open]:border-primary/30 data-[state=open]:shadow-sm"
       >
        <AccordionTrigger className="py-4 hover:no-underline">
          <div className="flex flex-1 items-center justify-between gap-4 pr-2">
            {batchMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.();
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border transition-all duration-200 hover:border-primary"
                style={{
                  backgroundColor: selected ? 'hsl(265 85% 65%)' : 'transparent',
                  borderColor: selected ? 'hsl(265 85% 65%)' : undefined,
                  color: 'white',
                  fontSize: '12px',
                  lineHeight: 1,
                }}
              >
                {selected ? '✓' : ''}
              </button>
            )}
            <div className="text-left min-w-0 flex-1">
              <p className="font-medium text-foreground truncate">{record.bankName}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDate(record.finishedAt)} · {record.totalCount}题 · {formatTime(record.durationSeconds)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block w-32">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold tabular-nums ${isLow ? 'text-destructive' : 'text-success'}`}>
                    {accuracyPercent}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.max(accuracyNum, 4)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                  对 {record.correctCount} · 错 {record.wrongCount}
                </p>
              </div>
              <div className="sm:hidden text-right">
                <p className={`text-sm font-bold tabular-nums ${isLow ? 'text-destructive' : 'text-success'}`}>
                  {accuracyPercent}%
                </p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  对 {record.correctCount}/{record.totalCount}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                   className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                title="删除记录"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
           {detailLoading && !answers ? (
             <div className="flex items-center justify-center py-6">
               <Loader2 className="h-5 w-5 animate-spin text-primary" />
             </div>
           ) : answers ? (
             <div className="space-y-3 pb-4">
               {answers.map((ans, idx) => (
                 <AnswerDetailCard key={idx} answer={ans} index={idx} />
               ))}
             </div>
           ) : null}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default RecordsPage;
