import { useMemo, useState, useEffect, useRef, type RefObject } from 'react';
import { BookOpen, Sparkles, type LucideIcon } from 'lucide-react';

import type { QuestionBankItem } from '@shared/api.interface';
import BankCard from './BankCard';
import BankCardSkeleton from './BankCardSkeleton';
import { VirtualScroll } from '@client/src/components/ui/virtual-scroll';

interface BankCardListProps {
  banks: QuestionBankItem[];
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: LucideIcon;
  onDelete: (id: string) => void;
  onPractice: (id: string) => void;
  onRefresh: () => void;
  selectable?: boolean;
  selectedIds?: string[];
  batchMode?: boolean;
  onToggleSelect?: (id: string) => void;
  subjectColors?: Record<string, string>;
  isMine?: boolean;
}

/** 超过此数量启用虚拟滚动 */
const VIRTUAL_THRESHOLD = 50;
/** 单张卡片高度（含卡片自身 + 底部外边距），px */
const CARD_HEIGHT = 240;
/** 行间距，px（与 grid gap 一致） */
const ROW_GAP = 20;

function useContainerHeight(
  ref: RefObject<HTMLDivElement | null>,
  fallback: number = 600,
): number {
  const [height, setHeight] = useState<number>(fallback);

  useEffect(() => {
    if (!ref.current) return;
    if (typeof ResizeObserver === 'undefined') {
      setHeight(ref.current.clientHeight || fallback);
      return;
    }

    const updateHeight = (el: HTMLElement) => {
      const h = el.clientHeight;
      if (h > 0) setHeight(h);
    };

    updateHeight(ref.current);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateHeight(entry.target as HTMLElement);
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, fallback]);

  return height;
}

function useColumnCount(
  ref: RefObject<HTMLDivElement | null>,
): number {
  const [columns, setColumns] = useState<number>(3);

  useEffect(() => {
    if (!ref.current) return;

    const computeColumns = (width: number): number => {
      if (width >= 1280) return 3; // xl
      if (width >= 640) return 2;  // sm
      return 1;
    };

    const update = () => {
      if (!ref.current) return;
      setColumns(computeColumns(ref.current.clientWidth));
    };

    update();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return columns;
}

const BankCardList = ({
  banks,
  loading,
  emptyTitle,
  emptyDescription,
  emptyIcon: EmptyIcon,
  onDelete,
  onPractice,
  onRefresh,
  selectable = false,
  selectedIds = [],
  batchMode = false,
  onToggleSelect,
  subjectColors,
  isMine = true,
}: BankCardListProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerHeight = useContainerHeight(containerRef, 600);
  const columns = useColumnCount(containerRef);

  const useVirtual = useMemo(() => {
    return !loading && banks.length > VIRTUAL_THRESHOLD;
  }, [banks.length, loading]);

  if (loading) {
    return <BankCardSkeleton count={6} />;
  }

  if (banks.length === 0) {
    return (
      <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border/80 bg-gradient-to-b from-card to-muted/30 py-20 text-center shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-md">
        {/* 装饰性背景波纹 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-1/2 h-32 w-64 -translate-x-1/2 opacity-50"
        >
          <svg viewBox="0 0 256 128" className="h-full w-full" fill="none">
            <path
              d="M0 80 Q64 40 128 64 Q192 88 256 48"
              stroke="hsl(265 85% 65%)"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.3"
            />
            <path
              d="M0 100 Q64 60 128 84 Q192 108 256 68"
              stroke="hsl(290 75% 65%)"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.2"
            />
          </svg>
        </div>

        {/* 多层图标容器 */}
        <div className="relative mb-5">
          {/* 外层光晕圆环 */}
          <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-primary/[0.08] to-[hsl(290_75%_65%)/0.08] blur-sm" />
          {/* 中层圆环 */}
          <div className="absolute -inset-2 rounded-full border border-primary/10" />
          {/* 主图标容器 */}
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 to-pink-400/10 shadow-inner">
            <EmptyIcon className="h-10 w-10 text-primary/80" />
            {/* 点缀小图标 */}
            <Sparkles className="absolute -right-1 -top-1 h-5 w-5 text-[hsl(290_75%_65%)/0.7]" />
            <BookOpen className="absolute -bottom-1 -left-1 h-4 w-4 text-primary/50" />
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground">{emptyTitle}</h3>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">{emptyDescription}</p>
      </div>
    );
  }

  // 数量少时走普通渲染，保持原有体验
  if (!useVirtual) {
    return (
      <div
        ref={containerRef}
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
        data-ai-section-type="card-list"
      >
        {banks.map((bank) => (
          <BankCard
            key={bank.id}
            bank={bank}
            selectable={selectable}
            selected={selectedIds.includes(bank.id)}
            batchMode={batchMode}
            onToggleSelect={onToggleSelect}
            onDelete={onDelete}
            onPractice={onPractice}
            onRefresh={onRefresh}
            subjectColors={subjectColors}
            isMine={isMine}
          />
        ))}
      </div>
    );
  }

  // 数量多时走虚拟滚动
  return (
    <div
      ref={containerRef}
      className="h-[70vh] min-h-[500px]"
      data-ai-section-type="card-list"
    >
      <VirtualScroll
        items={banks}
        itemHeight={CARD_HEIGHT}
        height={containerHeight}
        columns={columns}
        rowGap={ROW_GAP}
        columnGap={ROW_GAP}
        overscan={3}
        getItemKey={(item) => item.id}
        renderItem={(bank) => (
          <BankCard
            bank={bank}
            selectable={selectable}
            selected={selectedIds.includes(bank.id)}
            batchMode={batchMode}
            onToggleSelect={onToggleSelect}
            onDelete={onDelete}
            onPractice={onPractice}
            onRefresh={onRefresh}
            subjectColors={subjectColors}
            isMine={isMine}
          />
        )}
      />
    </div>
  );
};

export default BankCardList;
