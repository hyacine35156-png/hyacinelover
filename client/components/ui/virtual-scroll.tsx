import { useRef, useState, useEffect, useMemo, type ReactNode } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';

export interface VirtualScrollProps<T> {
  /** 完整数据列表 */
  items: T[];
  /** 每项固定高度（px） */
  itemHeight: number;
  /** 可视区域高度（px） */
  height: number;
  /** 渲染单条项目的函数 */
  renderItem: (item: T, index: number) => ReactNode;
  /** 上下缓冲区项数（按行计），默认 5 */
  overscan?: number;
  /** 额外的容器类名 */
  className?: string;
  /** 列数（用于网格布局），默认 1 */
  columns?: number;
  /** 行间距（px），默认 0 */
  rowGap?: number;
  /** 列间距（px），默认 0 */
  columnGap?: number;
  /** 列表项的唯一 key 提取函数，默认用 index */
  getItemKey?: (item: T, index: number) => string | number;
}

function VirtualScrollInner<T>({
  items,
  itemHeight,
  height,
  renderItem,
  overscan = 5,
  className = '',
  columns = 1,
  rowGap = 0,
  columnGap = 0,
  getItemKey,
}: VirtualScrollProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const rafRef = useRef<number | null>(null);

  const totalItems = items.length;
  const rowsCount = Math.max(0, Math.ceil(totalItems / columns));
  const rowHeight = itemHeight + rowGap;
  const totalHeight = Math.max(0, rowsCount * rowHeight - rowGap);

  // 计算可见范围（按行）
  const { startRow, endRow, offsetY } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleRows = Math.ceil(height / rowHeight);
    const end = Math.min(rowsCount, start + visibleRows + overscan * 2);
    return {
      startRow: start,
      endRow: end,
      offsetY: start * rowHeight,
    };
  }, [scrollTop, rowHeight, height, overscan, rowsCount]);

  const startIndex = startRow * columns;
  const endIndex = Math.min(totalItems, endRow * columns);

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      setScrollTop(target.scrollTop);
    });
  };

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // ResizeObserver 监听容器高度变化
  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      logger.debug('[VirtualScroll] container resized');
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 当 items/columns 变化时重置滚动位置保护（避免空白）
  useEffect(() => {
    setScrollTop(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [totalItems, columns]);

  const contentStyle =
    columns > 1
      ? ({
          transform: `translateY(${offsetY}px)`,
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          columnGap: `${columnGap}px`,
          rowGap: `${rowGap}px`,
        } as const)
      : ({
          transform: `translateY(${offsetY}px)`,
        } as const);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={contentStyle}>
          {visibleItems.map((item, i) => {
            const realIndex = startIndex + i;
            const key = getItemKey ? getItemKey(item, realIndex) : realIndex;
            return (
              <div
                key={key}
                style={{ height: itemHeight }}
              >
                {renderItem(item, realIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * 通用虚拟滚动组件
 * - 固定高度项
 * - 支持单列 / 多列网格（带 gap）
 * - transform: translateY 定位可见项
 * - 上下 overscan 缓冲避免快速滚动白屏
 * - requestAnimationFrame 节流滚动事件
 */
export function VirtualScroll<T>(props: VirtualScrollProps<T>) {
  return <VirtualScrollInner {...props} />;
}

export default VirtualScroll;
