import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { CallbackDataParams, TopLevelFormatterParams } from 'echarts/types/dist/shared';
import {
  BookOpen,
  CheckCircle2,
  Target,
  Clock,
  TrendingUp,
  Calendar,
  Trophy,
  BarChart3,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from '@client/src/utils/router';
import { formatDecimal, formatAccuracy, formatSeconds } from '@client/src/utils/format';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import type {
  LearningDashboardResponse,
  QuestionType,
} from '@shared/api.interface';
import CheckinCalendar from './CheckinCalendar';
import type { CheckinCalendarResponse } from '@shared/api.interface';

interface DashboardTabProps {
  dashboard: LearningDashboardResponse;
  checkin: CheckinCalendarResponse;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  b1: 'B1型题',
};

const DashboardTab = ({ dashboard, checkin }: DashboardTabProps) => {
  const navigate = useNavigate();
  const [trendRange, setTrendRange] = useState<'7' | '30'>('7');

  const trendData = trendRange === '7' ? dashboard.trend7 : dashboard.trend30;

  const statCards = useMemo(
    () => [
      {
        label: '今日数据',
        icon: Sparkles,
        gradient: 'from-[#8b5cf6] to-[#d946ef]',
        bgGradient: 'from-[#8b5cf6]/15 to-[#d946ef]/15',
        items: [
          { label: '作答题数', value: dashboard.today.answeredCount, suffix: '题' },
          { label: '正确数', value: dashboard.today.correctCount, suffix: '题' },
          { label: '正确率', value: formatAccuracy(dashboard.today.accuracyRate), suffix: '' },
          { label: '学习时长', value: formatSeconds(dashboard.today.studySeconds), suffix: '' },
        ],
      },
      {
        label: '本周数据',
        icon: TrendingUp,
        gradient: 'from-[#22c55e] to-[#10b981]',
        bgGradient: 'from-[#22c55e]/15 to-[#10b981]/15',
        items: [
          { label: '作答题数', value: dashboard.week.answeredCount, suffix: '题' },
          { label: '正确率', value: formatAccuracy(dashboard.week.accuracyRate), suffix: '' },
          { label: '学习时长', value: formatSeconds(dashboard.week.studySeconds), suffix: '' },
          { label: '日均作答', value: formatDecimal(dashboard.week.dailyAvg, 1), suffix: '题' },
        ],
      },
      {
        label: '本月数据',
        icon: Calendar,
        gradient: 'from-[#3b82f6] to-[#6366f1]',
        bgGradient: 'from-[#3b82f6]/15 to-[#6366f1]/15',
        items: [
          { label: '作答题数', value: dashboard.month.answeredCount, suffix: '题' },
          { label: '正确率', value: formatAccuracy(dashboard.month.accuracyRate), suffix: '' },
          { label: '学习时长', value: formatSeconds(dashboard.month.studySeconds), suffix: '' },
          { label: '日均作答', value: formatDecimal(dashboard.month.dailyAvg, 1), suffix: '题' },
        ],
      },
      {
        label: '累计数据',
        icon: Trophy,
        gradient: 'from-[#f59e0b] to-[#ef4444]',
        bgGradient: 'from-[#f59e0b]/15 to-[#ef4444]/15',
        items: [
          { label: '总作答题数', value: dashboard.total.answeredCount, suffix: '题' },
          { label: '正确率', value: formatAccuracy(dashboard.total.accuracyRate), suffix: '' },
          { label: '学习时长', value: formatSeconds(dashboard.total.studySeconds), suffix: '' },
           { label: '练习天数', value: dashboard.total.studyDays, suffix: '天' },
        ],
      },
    ],
    [dashboard],
  );

  const trendOption: EChartsOption = useMemo(() => {
    const dates = trendData.map((item) => item.date.slice(5)); // MM-DD
    const answeredCounts = trendData.map((item) => item.answeredCount);
    const accuracyRates = trendData.map((item) => +(item.accuracyRate * 100).toFixed(1));

    const maxCount = Math.max(...answeredCounts, 1);
    // 柱状图取整到最接近的5的倍数作为上限
    const barMax = Math.ceil(maxCount / 5) * 5;
    const lineMax = 100; // 正确率0-100
    const lineMin = 0;
    // 保持比例一致，零点对齐（此处都是从0开始）
    const barMin = 0;

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'hsl(260 25% 15%)',
        borderColor: 'transparent',
        textStyle: { color: '#fff', fontSize: 12 },
        padding: [8, 12],
        formatter: (params: TopLevelFormatterParams) => {
          const list = Array.isArray(params) ? params : [params];
          const date = list[0]?.name || '';
          const countItem = list.find((p) => p.seriesName === '作答题数');
          const rateItem = list.find((p) => p.seriesName === '正确率');
          const countVal = countItem ? (countItem.value as number) : 0;
          const rateVal = rateItem ? (rateItem.value as number) : 0;
          return `${date}<br/>作答题数：${countVal} 题<br/>正确率：${rateVal.toFixed(1)}%`;
        },
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { fontSize: 12 },
      },
      grid: { left: '3%', right: '4%', bottom: '20%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: true,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisLabel: { color: '#9ca3af', fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          name: '作答题数',
          min: barMin,
          max: barMax,
          nameTextStyle: { color: '#9ca3af', fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
          axisLabel: { color: '#9ca3af', fontSize: 11 },
        },
        {
          type: 'value',
          name: '正确率',
          min: lineMin,
          max: lineMax,
          nameTextStyle: { color: '#9ca3af', fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: '#9ca3af',
            fontSize: 11,
            formatter: (value: number) => `${value}%`,
          },
        },
      ],
      series: [
        {
          name: '作答题数',
          type: 'bar',
          yAxisIndex: 0,
          data: answeredCounts,
          barWidth: '45%',
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#8b5cf6' },
                { offset: 1, color: '#d946ef' },
              ],
            },
          },
        },
        {
          name: '正确率',
          type: 'line',
          yAxisIndex: 1,
          data: accuracyRates,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#22c55e', width: 2 },
          itemStyle: { color: '#22c55e' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(34, 197, 94, 0.2)' },
                { offset: 1, color: 'rgba(34, 197, 94, 0)' },
              ],
            },
          },
        },
      ],
    };
  }, [trendData]);

  const pieOption: EChartsOption = useMemo(() => {
    const pieData = dashboard.typeDistribution.map((item) => ({
      name: QUESTION_TYPE_LABELS[item.type] || item.type,
      value: item.count,
      accuracyRate: item.accuracyRate,
    }));

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'hsl(260 25% 15%)',
        borderColor: 'transparent',
        textStyle: { color: '#fff', fontSize: 12 },
        padding: [8, 12],
        formatter: (params: CallbackDataParams) => {
          const d = params.data as { name: string; value: number; accuracyRate: number };
          const acc = (d.accuracyRate * 100).toFixed(1);
          return `${d.name}<br/>作答题数：${d.value}<br/>正确率：${acc}%<br/>占比：${params.percent}%`;
        },
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { fontSize: 12 },
      },
      color: ['#8b5cf6', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444'],
      series: [
        {
          name: '题型分布',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          label: { show: false },
          emphasis: { label: { show: false } },
          data: pieData,
        },
      ],
    };
  }, [dashboard.typeDistribution]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 fade-in-up">
      {/* 数据卡片 */}
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-ai-section-type="card-stat"
      >
        {statCards.map((card) => (
          <Card
            key={card.label}
            className="card-hover rounded-xl border border-border/60 shadow-sm bg-card overflow-hidden relative"
          >
            <div className="h-1 w-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef]" />
            <div className={`absolute top-2 right-2 w-20 h-20 rounded-full bg-gradient-to-br ${card.bgGradient} opacity-50 blur-2xl`} />
            <CardContent className="relative p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow-sm`}>
                  <card.icon className="h-4.5 w-4.5 text-white" />
                </div>
                <span className="text-sm font-medium text-foreground">{card.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {card.items.map((item) => (
                  <div key={item.label}>
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-foreground">
                      {item.value}
                      {item.suffix && (
                        <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
                          {item.suffix}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 学习趋势图 */}
      <Card className="card-hover rounded-xl border border-border/60 shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef]" />
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" />
            学习趋势
          </CardTitle>
          <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
            <Button
              variant={trendRange === '7' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTrendRange('7')}
              className="h-7 px-3 text-xs"
            >
              近7天
            </Button>
            <Button
              variant={trendRange === '30' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTrendRange('30')}
              className="h-7 px-3 text-xs"
            >
              近30天
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ReactECharts option={trendOption} theme="ud" className="h-[320px] w-full" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 题型分布 */}
        <Card className="card-hover rounded-xl border border-border/60 shadow-sm">
          <div className="h-1 w-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef]" />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Target className="h-5 w-5 text-primary" />
              题型分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.typeDistribution.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                暂无数据
              </div>
            ) : (
              <ReactECharts option={pieOption} theme="ud" className="h-[300px] w-full" />
            )}
          </CardContent>
        </Card>

        {/* 打卡日历 */}
        <CheckinCalendar data={checkin} />
      </div>

      {/* 最近学习记录 */}
      <Card className="rounded-xl border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5 text-primary" />
            最近学习记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.recentRecords.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-[#d946ef]/15">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">还没有学习记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dashboard.recentRecords.map((record) => (
                <button
                  key={record.id}
                  onClick={() => navigate('/records')}
                  className="group flex w-full items-center justify-between rounded-xl border border-border/40 p-3 text-left transition-all duration-200 hover:border-primary/30 hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {record.bankName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {record.totalCount}题 · {formatDate(record.finishedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {formatAccuracy(record.accuracyRate)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        用时 {formatSeconds(record.durationSeconds)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardTab;
