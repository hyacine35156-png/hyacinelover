import React from 'react';

const BankCardSkeleton = React.memo(function BankCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="space-y-3 px-5 pb-3 pt-5 sm:space-y-4 sm:px-6 sm:pb-4 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-5 w-2/3 animate-pulse rounded-md bg-muted/70" />
            <div className="flex items-center gap-2">
              <div className="h-4 w-14 animate-pulse rounded-full bg-muted/70" />
            </div>
          </div>
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gradient-to-br from-primary/20 to-[hsl(290_75%_65%)/20] sm:h-11 sm:w-11" />
        </div>
        <div className="space-y-1.5">
          <div className="h-4 w-full animate-pulse rounded bg-muted/60" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted/60" />
        </div>
      </div>
      <div className="flex items-center gap-2 px-5 pt-0 text-xs sm:gap-3 sm:px-6 sm:text-sm">
        <div className="h-5 w-16 animate-pulse rounded-full bg-primary/10" />
        <div className="h-3 w-16 animate-pulse rounded bg-muted/70" />
      </div>
      <div className="flex flex-col items-stretch gap-2.5 px-5 py-4 sm:gap-3 sm:px-6">
        <div className="h-5 w-20 animate-pulse rounded-full bg-muted/70" />
        <div className="h-11 w-full animate-pulse rounded-lg bg-gradient-to-r from-primary/20 to-pink-400/20" />
      </div>
    </div>
  );
});

const BankCardSkeletonGrid = React.memo(function BankCardSkeletonGrid({
  count = 6,
}: {
  count?: number;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
      data-ai-section-type="card-list"
    >
      {Array.from({ length: count }).map((_, i) => (
        <BankCardSkeleton key={i} />
      ))}
    </div>
  );
});

export default BankCardSkeletonGrid;
