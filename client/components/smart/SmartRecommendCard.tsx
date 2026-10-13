import { useState, useEffect } from 'react';
import { useNavigate } from '@client/src/utils/router';
import { Sparkles, TrendingUp, Clock, Brain, ChevronRight } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { smartPracticeApi } from '@client/src/api';
import type { SmartRecommendResponse } from '@shared/api.interface';
import { useAuth } from '@client/src/contexts/AuthContext';

export const SmartRecommendCard = () => {
  const { isGuest } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<SmartRecommendResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        const res = await smartPracticeApi.getRecommend(20);
        setData(res);
      } catch (error) {
        logger.error('加载智能推荐失败', error);
        toast.error('智能推荐加载失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [isGuest]);

  if (isGuest) return null;
  if (loading || !data) return null;
  if (data.totalCount === 0) return null;

  const stats = [
    { label: '高频错题', count: data.highFreqCount, icon: TrendingUp, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: '近7天错', count: data.recentWrongCount, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
    { label: '薄弱知识', count: data.weakKnowledgeCount, icon: Brain, color: 'text-info', bg: 'bg-info/10' },
  ];

  const handleClick = () => {
    navigate('/wrongbook');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-ai-section-type="card-menu"
      className="group relative w-full overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-purple-500/[0.05] to-pink-400/[0.08] p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_hsl(265_85%_65%_/_0.15)]"
    >
      {/* 装饰光斑 */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-32 w-32 rounded-full bg-pink-400/15 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-500 shadow-lg shadow-primary/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">智能推荐</p>
              <p className="text-xs text-muted-foreground">
                 基于你的练习数据，精准定位薄弱点
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-primary transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center rounded-xl border border-border bg-white px-2 py-2.5"
            >
              <div className={`mb-1 inline-flex h-7 w-7 items-center justify-center rounded-lg ${s.bg}`}>
                <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              </div>
              <p className="text-base font-bold tabular-nums text-foreground">
                {s.count}
              </p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            共 <span className="font-semibold text-foreground tabular-nums">{data.totalCount}</span> 道题推荐练习
          </span>
          <span className="font-medium text-primary">前往练习 →</span>
        </div>
      </div>
    </button>
  );
};
