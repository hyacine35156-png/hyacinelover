import { useMemo, useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { VirtualScroll } from '@client/src/components/ui/virtual-scroll';

type QuestionType = 'single' | 'multiple' | 'b1';

interface QuestionNavigatorProps {
  total: number;
  currentIndex: number;
  submitted: boolean[];
  correctFlags: boolean[];
  questionTypes: QuestionType[];
  onJump: (index: number) => void;
  hasRecords: boolean;
  onClearRecords: () => void;
}

const getTypeAbbr = (t?: QuestionType): string => {
  if (t === 'single') return 'A1';
  if (t === 'multiple') return 'X';
  if (t === 'b1') return 'B1';
  return '?';
};

const getTypeName = (t?: QuestionType): string => {
  if (t === 'single') return 'A1型题';
  if (t === 'multiple') return 'X型题';
  if (t === 'b1') return 'B1型题';
  return '未知题型';
};

const QuestionNavigator = ({
  total,
  currentIndex,
  submitted,
  correctFlags,
  questionTypes,
  onJump,
  hasRecords,
  onClearRecords,
}: QuestionNavigatorProps) => {
  const [expanded, setExpanded] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [navHeight, setNavHeight] = useState(280);
  const [columns, setColumns] = useState(12);

  useEffect(() => {
    if (!gridContainerRef.current) return;
    const el = gridContainerRef.current;
    const updateLayout = () => {
      const w = el.clientWidth;
      let cols = 6;
      if (w >= 1280) cols = 15;
      else if (w >= 1024) cols = 12;
      else if (w >= 768) cols = 10;
      else if (w >= 640) cols = 8;
      else cols = 6;
      setColumns(cols);
    };
    updateLayout();
    const ro = new ResizeObserver(updateLayout);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded]);

  const answeredCount = useMemo(
    () => submitted.filter(Boolean).length,
    [submitted],
  );

  const navItems = useMemo(
    () => Array.from({ length: total }, (_, i) => i),
    [total],
  );

  const VIRTUAL_THRESHOLD = 60;
  const useVirtual = total > VIRTUAL_THRESHOLD;
  const itemHeight = typeof window !== 'undefined' && window.innerWidth >= 640 ? 48 : 40;
  const gap = typeof window !== 'undefined' && window.innerWidth >= 640 ? 8 : 6;

  if (total <= 0) return null;

  const getButtonClass = (idx: number) => {
    const isCurrent = idx === currentIndex;
    const isSubmitted = submitted[idx];
    const isCorrect = correctFlags[idx];

    let base =
      'group relative flex h-9 w-9 flex-col items-center justify-center rounded-lg transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-primary/30 sm:h-11 sm:w-11 sm:rounded-xl';

    if (isCurrent) {
      base += 'bg-gradient-to-br from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] text-white shadow-[0_0_0_3px_hsl(265_85%_65%/0.15),0_4px_12px_hsl(265_85%_65%/0.35)] scale-105 ';
    } else if (isSubmitted) {
      if (isCorrect) {
        base += 'bg-success/12 text-success ring-1 ring-success/30 hover:bg-success/20 hover:scale-105 ';
      } else {
        base += 'bg-destructive/12 text-destructive ring-1 ring-destructive/30 hover:bg-destructive/20 hover:scale-105 ';
      }
    } else {
      base +=
        'bg-card text-muted-foreground ring-1 ring-border/70 hover:ring-primary/40 hover:text-primary hover:bg-accent/30 hover:scale-105 ';
    }

    return base;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm card-hover">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-accent">
            <GripVertical className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">题目导航</span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            已答 {answeredCount}/{total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClearRecords();
            }}
            disabled={!hasRecords}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-destructive/70 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label="清除答题记录"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>清除</span>
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-all duration-200 group-hover:bg-accent">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 px-5 py-5">
          <div ref={gridContainerRef} className="w-full">
            {useVirtual ? (
              <VirtualScroll
                items={navItems}
                itemHeight={itemHeight}
                height={navHeight}
                columns={columns}
                rowGap={gap}
                columnGap={gap}
                getItemKey={(idx) => idx}
                renderItem={(idx: number) => (
                  <button
                    onClick={() => onJump(idx)}
                    className={getButtonClass(idx)}
                    title={`第 ${idx + 1} 题 · ${getTypeName(questionTypes[idx])} · ${submitted[idx] ? (correctFlags[idx] ? '正确' : '错误') : '未答'}`}
                  >
                    <span className="hidden text-[9px] font-semibold leading-none opacity-80 sm:block">
                      {getTypeAbbr(questionTypes[idx])}
                    </span>
                    <span className="text-xs font-bold leading-tight tabular-nums sm:text-xs">
                      {idx + 1}
                    </span>
                  </button>
                )}
              />
            ) : (
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 sm:gap-2 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15">
                {Array.from({ length: total }, (_, idx) => (
                  <button
                    key={idx}
                    onClick={() => onJump(idx)}
                    className={getButtonClass(idx)}
                    title={`第 ${idx + 1} 题 · ${getTypeName(questionTypes[idx])} · ${submitted[idx] ? (correctFlags[idx] ? '正确' : '错误') : '未答'}`}
                  >
                    <span className="hidden text-[9px] font-semibold leading-none opacity-80 sm:block">
                      {getTypeAbbr(questionTypes[idx])}
                    </span>
                    <span className="text-xs font-bold leading-tight tabular-nums sm:text-xs">
                      {idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 图例 */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-md bg-gradient-to-br from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] shadow-[0_0_0_2px_hsl(265_85%_65%/0.15)]" />
              当前
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-md bg-success/25 ring-1 ring-success/40" />
              答对
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-md bg-destructive/25 ring-1 ring-destructive/40" />
              答错
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-md bg-card ring-1 ring-border/80" />
              未答
            </div>
          </div>

          {/* 跳转输入 */}
          <div className="mt-4 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={total}
              defaultValue={currentIndex + 1}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = Number(
                    (e.target as HTMLInputElement).value,
                  );
                  if (val >= 1 && val <= total) {
                    onJump(val - 1);
                  }
                }
              }}
              className="h-9 w-24 rounded-xl border border-border/70 bg-card px-3 text-sm text-foreground shadow-sm transition-all duration-200 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 tabular-nums"
              placeholder="跳转到"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                const input = (e.currentTarget
                  .previousElementSibling as HTMLInputElement);
                const val = Number(input.value);
                if (val >= 1 && val <= total) {
                  onJump(val - 1);
                }
              }}
              className="h-9 rounded-xl border border-border/70 transition-all duration-200 hover:border-primary/40 hover:bg-accent/40"
            >
              跳转
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionNavigator;
