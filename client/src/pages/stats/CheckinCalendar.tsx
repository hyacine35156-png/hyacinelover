import { useMemo } from 'react';
import { Flame, Calendar, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import type { CheckinCalendarResponse } from '@shared/api.interface';

interface CheckinCalendarProps {
  data: CheckinCalendarResponse;
}

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const CheckinCalendar = ({ data }: CheckinCalendarProps) => {
  const calendarGrid = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 29); // 最近30天

    // 补齐前面的空位让第一行对齐周日
    const startDayOfWeek = startDate.getDay();
    const leadingEmpty = startDayOfWeek;

    const days: {
      date: string;
      answered: number;
      completed: boolean;
      isToday: boolean;
      isEmpty: boolean;
      dayLabel: string;
    }[] = [];

    for (let i = 0; i < leadingEmpty; i++) {
      days.push({
        date: '',
        answered: 0,
        completed: false,
        isToday: false,
        isEmpty: true,
        dayLabel: '',
      });
    }

    const calendarMap = new Map(
      data.calendar.map((item) => [item.date, item]),
    );

    for (let i = 0; i < 30; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const item = calendarMap.get(dateStr);
      const isToday = i === 29;

      days.push({
        date: dateStr,
        answered: item?.answered ?? 0,
        completed: item?.completed ?? false,
        isToday,
        isEmpty: false,
        dayLabel: String(d.getDate()),
      });
    }

    return days;
  }, [data.calendar]);

  return (
    <Card className="card-hover rounded-xl border border-border/60 shadow-sm bg-card overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef]" />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5 text-primary" />
          打卡日历
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          className="grid grid-cols-3 gap-3"
          data-ai-section-type="card-stat"
        >
          <div className="rounded-xl bg-gradient-to-br from-primary/15 to-[#d946ef]/15 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Flame className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold tabular-nums gradient-primary-text">
                {data.currentStreak}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">连续打卡天数</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#22c55e]/15 to-[#10b981]/15 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Trophy className="h-5 w-5 text-[#22c55e]" />
              <span className="text-2xl font-bold tabular-nums text-[#22c55e]">
                {data.maxStreak}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">最长连续天数</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#3b82f6]/15 to-[#6366f1]/15 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Calendar className="h-5 w-5 text-[#3b82f6]" />
              <span className="text-2xl font-bold tabular-nums text-[#3b82f6]">
                {data.totalDays}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">累计打卡天数</p>
          </div>
        </div>

        <div>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {WEEK_LABELS.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {calendarGrid.map((day, idx) => (
              <div
                key={idx}
                className={`
                  aspect-square flex items-center justify-center rounded-md text-[10px] font-medium transition-all
                  ${day.isEmpty ? 'invisible' : ''}
                  ${day.completed
                    ? 'bg-gradient-to-br from-primary to-[#d946ef] text-white shadow-sm'
                    : day.answered > 0
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted/50 text-muted-foreground/60'}
                  ${day.isToday ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background' : ''}
                `}
                title={
                  day.isEmpty
                    ? ''
                    : `${day.date} · 作答 ${day.answered} 题${day.completed ? ' · 已完成目标' : ''}`
                }
              >
                {day.dayLabel}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end gap-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-gradient-to-br from-primary to-[#d946ef]" />
              已完成
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-primary/20" />
              部分作答
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-muted/50" />
              未作答
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CheckinCalendar;
