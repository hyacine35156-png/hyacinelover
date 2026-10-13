import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type {
  WrongBookStatsResponse,
  WrongReason,
  QuestionType,
  DifficultyLevel,
} from '@shared/api.interface';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { BarChart3, PieChart, TrendingUp, Lightbulb, Gauge } from 'lucide-react';

interface WrongBookStatsProps {
  stats: WrongBookStatsResponse | null;
  loading: boolean;
}

const WRONG_REASON_LABELS: Record<WrongReason, string> = {
  concept_unclear: '概念不清',
  careless: '粗心大意',
  dont_know: '不会做',
  no_time: '时间不够',
  dispute: '题目争议',
  other: '其他',
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  b1: 'B1型题',
};

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

// 紫色系调色板（hex）
const PURPLE_PALETTE = [
  '#8b5cf6', // 亮紫
  '#a78bfa', // 淡紫
  '#7c3aed', // 深紫
  '#c4b5fd', // 浅紫
  '#6d28d9', // 暗紫
  '#ddd6fe', // 极浅紫
];

function buildPieOption(
  data: { name: string; value: number }[],
  colors?: string[],
): EChartsOption {
  return {
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const p = params as { name: string; value: number; percent: number };
        return `${p.name}<br/>数量：${p.value}<br/>占比：${p.percent}%`;
      },
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      icon: 'circle',
    },
    color: colors || PURPLE_PALETTE,
    series: [
      {
        name: '分布',
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          label: { show: false },
          scale: true,
          scaleSize: 6,
        },
        labelLine: { show: false },
        data,
      },
    ],
  };
}

function buildBarOption(
  categories: string[],
  values: number[],
  isHorizontal = false,
): EChartsOption {
  const gradientColor = {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 1,
    y2: 1,
    colorStops: [
      { offset: 0, color: '#8b5cf6' },
      { offset: 1, color: '#c4b5fd' },
    ],
  };

  if (isHorizontal) {
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: { bottom: 0, show: false },
      grid: { left: '3%', right: '8%', bottom: '20%', top: '3%', containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#6b7280' },
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: '#374151' },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v) => ({ value: v, itemStyle: { color: gradientColor, borderRadius: [0, 6, 6, 0] } })),
          barWidth: '55%',
        },
      ],
    };
  }

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: { bottom: 0, show: false },
    grid: { left: '3%', right: '4%', bottom: '20%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { color: '#6b7280' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280' },
    },
    series: [
      {
        type: 'bar',
        data: values.map((v) => ({ value: v, itemStyle: { color: gradientColor, borderRadius: [6, 6, 0, 0] } })),
        barWidth: '45%',
      },
    ],
  };
}

function buildLineOption(dates: string[], counts: number[]): EChartsOption {
  const areaGradient = {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: 'rgba(139, 92, 246, 0.35)' },
      { offset: 1, color: 'rgba(139, 92, 246, 0.02)' },
    ],
  };

  return {
    tooltip: {
      trigger: 'axis',
    },
    legend: { bottom: 0, show: false },
    grid: { left: '3%', right: '4%', bottom: '20%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLabel: { color: '#6b7280' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280' },
    },
    series: [
      {
        name: '错题数',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#8b5cf6', width: 2 },
        itemStyle: { color: '#8b5cf6' },
        areaStyle: { color: areaGradient },
        data: counts,
      },
    ],
  };
}

const StatCard: React.FC<{
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  loading?: boolean;
}> = ({ title, icon: Icon, children, loading }) => (
  <Card className="rounded-xl border border-border/60 shadow-sm card-hover">
    <CardHeader className="pb-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : (
        children
      )}
    </CardContent>
  </Card>
);

export const WrongBookStats: React.FC<WrongBookStatsProps> = ({ stats, loading }) => {
  const reasonPieOption: EChartsOption = buildPieOption(
    stats?.byReason.map((item) => ({
      name: WRONG_REASON_LABELS[item.reason],
      value: item.count,
    })) || [],
  );

  const typePieOption: EChartsOption = buildPieOption(
    stats?.byType.map((item) => ({
      name: QUESTION_TYPE_LABELS[item.type],
      value: item.count,
    })) || [],
  );

  const difficultyBarOption: EChartsOption = buildBarOption(
    stats?.byDifficulty.map((item) => DIFFICULTY_LABELS[item.difficulty]) || [],
    stats?.byDifficulty.map((item) => item.count) || [],
  );

  const knowledgeBarOption: EChartsOption = buildBarOption(
    (stats?.byKnowledge || []).slice(0, 10).map((item) => item.tagName).reverse(),
    (stats?.byKnowledge || []).slice(0, 10).map((item) => item.count).reverse(),
    true,
  );

  const trendLineOption: EChartsOption = buildLineOption(
    stats?.byDate.map((item) => item.date.slice(5)) || [],
    stats?.byDate.map((item) => item.count) || [],
  );

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <StatCard title="错误原因分布" icon={PieChart} loading={loading}>
        <ReactECharts option={reasonPieOption} theme="ud" className="h-[300px] w-full" />
      </StatCard>

      <StatCard title="题型分布" icon={BarChart3} loading={loading}>
        <ReactECharts option={typePieOption} theme="ud" className="h-[300px] w-full" />
      </StatCard>

      <StatCard title="难度分布" icon={Gauge} loading={loading}>
        <ReactECharts option={difficultyBarOption} theme="ud" className="h-[300px] w-full" />
      </StatCard>

      <StatCard title="知识点分布 Top 10" icon={Lightbulb} loading={loading}>
        <ReactECharts option={knowledgeBarOption} theme="ud" className="h-[300px] w-full" />
      </StatCard>

      <div className="md:col-span-2">
        <StatCard title="近30天错题趋势" icon={TrendingUp} loading={loading}>
          <ReactECharts option={trendLineOption} theme="ud" className="h-[300px] w-full" />
        </StatCard>
      </div>
    </div>
  );
};

export default WrongBookStats;
