import { useMemo, useState } from 'react';
import {
  BookOpen,
  AlertTriangle,
  Target,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import type {
  KnowledgeMasteryResponse,
  KnowledgeMasteryItem,
} from '@shared/api.interface';

interface KnowledgeTabProps {
  data: KnowledgeMasteryResponse;
}

const MASTERY_CONFIG: Record<
  KnowledgeMasteryItem['masteryLevel'],
  { label: string; color: string; bgClass: string; barClass: string }
> = {
  mastered: {
    label: '熟练',
    color: '#22c55e',
    bgClass: 'bg-[#22c55e]/10 text-[#16a34a]',
    barClass: 'bg-[#22c55e]',
  },
  good: {
    label: '良好',
    color: '#3b82f6',
    bgClass: 'bg-[#3b82f6]/10 text-[#2563eb]',
    barClass: 'bg-[#3b82f6]',
  },
  fair: {
    label: '一般',
    color: '#f59e0b',
    bgClass: 'bg-[#f59e0b]/10 text-[#d97706]',
    barClass: 'bg-[#f59e0b]',
  },
  weak: {
    label: '薄弱',
    color: '#ef4444',
    bgClass: 'bg-[#ef4444]/10 text-[#dc2626]',
    barClass: 'bg-[#ef4444]',
  },
};

const KnowledgeTab = ({ data }: KnowledgeTabProps) => {
  const [selectedItem, setSelectedItem] = useState<KnowledgeMasteryItem | null>(null);

  // 按掌握度从低到高排序（薄弱在前）
  const sortedItems = useMemo(() => {
    const levelOrder: Record<KnowledgeMasteryItem['masteryLevel'], number> = {
      weak: 0,
      fair: 1,
      good: 2,
      mastered: 3,
    };
    return [...data.items].sort((a, b) => {
      const levelDiff = levelOrder[a.masteryLevel] - levelOrder[b.masteryLevel];
      if (levelDiff !== 0) return levelDiff;
      return a.accuracyRate - b.accuracyRate;
    });
  }, [data.items]);

  const masteryStats = useMemo(() => {
    const stats = { mastered: 0, good: 0, fair: 0, weak: 0 };
    data.items.forEach((item) => {
      stats[item.masteryLevel] += 1;
    });
    return stats;
  }, [data.items]);

  if (data.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-[#d946ef]/15">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <p className="font-medium text-foreground">暂无知识点数据</p>
         <p className="mt-1 text-sm text-muted-foreground">开始练习后，系统会自动分析你的知识点掌握情况</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in-up">
      {/* 顶部统计 */}
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        data-ai-section-type="card-stat"
      >
        {(Object.keys(MASTERY_CONFIG) as KnowledgeMasteryItem['masteryLevel'][]).map(
          (level) => {
            const config = MASTERY_CONFIG[level];
            const count = masteryStats[level] || 0;
            return (
              <Card
                key={level}
                className="card-hover rounded-xl border border-border/60 shadow-sm overflow-hidden"
              >
                <div
                  className="h-1 w-full"
                  style={{ background: config.color }}
                />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{config.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bgClass}`}
                    >
                      {count}个
                    </span>
                  </div>
                  <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                    {count}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      知识点
                    </span>
                  </p>
                </CardContent>
              </Card>
            );
          },
        )}
      </div>

      {/* 薄弱知识点提示 */}
      {data.weakCount > 0 && (
        <Card className="rounded-xl border border-[#ef4444]/20 bg-gradient-to-r from-[#ef4444]/5 to-transparent">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ef4444]/10">
                <AlertTriangle className="h-5 w-5 text-[#ef4444]" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  你有 <span className="text-[#ef4444]">{data.weakCount}</span> 个薄弱知识点
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  建议重点练习薄弱知识点，提升整体掌握度
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="shrink-0"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
              }}
            >
              <Target className="h-3.5 w-3.5" />
              重点练习
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 知识点掌握度列表 */}
      <Card className="rounded-xl border border-border/60 shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef]" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            知识点掌握度排行
          </CardTitle>
          <p className="text-xs text-muted-foreground">按掌握度从低到高排序</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedItems.map((item) => {
            const config = MASTERY_CONFIG[item.masteryLevel];
            const percent = Math.round(item.accuracyRate * 100);
            return (
              <button
                key={item.tagId}
                onClick={() => setSelectedItem(item)}
                className="group w-full rounded-xl border border-border/40 p-4 text-left transition-all duration-200 hover:border-primary/30 hover:bg-accent/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <BookOpen
                        className="h-5 w-5"
                        style={{ color: config.color }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.tagName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        共 {item.totalCount} 题 · 正确 {item.correctCount} 题
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bgClass}`}
                        >
                          {config.label}
                        </span>
                        <span
                          className="text-sm font-bold tabular-nums"
                          style={{ color: config.color }}
                        >
                          {percent}%
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${percent}%`, backgroundColor: config.color }}
                  />
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* 知识点详情弹窗 */}
      <Dialog
        open={selectedItem !== null}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>知识点详情</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {selectedItem && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${MASTERY_CONFIG[selectedItem.masteryLevel].color}20`,
                    }}
                  >
                    <BookOpen
                      className="h-6 w-6"
                      style={{ color: MASTERY_CONFIG[selectedItem.masteryLevel].color }}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{selectedItem.tagName}</h3>
                    <p className="text-sm text-muted-foreground">
                      掌握程度：
                      <span
                        className="ml-1 font-medium"
                        style={{
                          color: MASTERY_CONFIG[selectedItem.masteryLevel].color,
                        }}
                      >
                        {MASTERY_CONFIG[selectedItem.masteryLevel].label}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-muted/30 p-3 text-center">
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {selectedItem.totalCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground">总题数</p>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-3 text-center">
                    <p className="text-lg font-bold tabular-nums text-[#22c55e]">
                      {selectedItem.correctCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground">正确数</p>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-3 text-center">
                    <p
                      className="text-lg font-bold tabular-nums"
                      style={{
                        color: MASTERY_CONFIG[selectedItem.masteryLevel].color,
                      }}
                    >
                      {Math.round(selectedItem.accuracyRate * 100)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">正确率</p>
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    掌握度进度
                  </p>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{
                        width: `${Math.round(selectedItem.accuracyRate * 100)}%`,
                        backgroundColor: MASTERY_CONFIG[selectedItem.masteryLevel].color,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setSelectedItem(null)}
            >
              关闭
            </Button>
            <Button>查看错题</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KnowledgeTab;
