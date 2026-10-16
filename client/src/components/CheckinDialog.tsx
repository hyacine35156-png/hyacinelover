import { useEffect, useMemo, useRef, useState } from 'react';
import { Target, Check, Minus, Plus, Calendar } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Switch } from '@client/src/components/ui/switch';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { checkinApi } from '@client/src/api';
import type {
  CheckinStatusResponse,
  CheckinSettingItem,
  CheckinHistoryItem,
} from '@shared/api.interface';

interface CheckinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStatus?: CheckinStatusResponse | null;
  onSaved?: (setting: CheckinSettingItem) => void;
}

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const CheckinDialog = ({
  open,
  onOpenChange,
  initialStatus,
  onSaved,
}: CheckinDialogProps) => {
  const [setting, setSetting] = useState<CheckinSettingItem>({
    isEnabled: false,
    dailyTarget: 10,
  });
  const [todayAnswered, setTodayAnswered] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [totalCheckinDays, setTotalCheckinDays] = useState(0);
  const [history, setHistory] = useState<CheckinHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);

  // Load data when dialog opens
  useEffect(() => {
    if (!open) return;

    const loadData = async (): Promise<void> => {
      setLoading(true);
      try {
        const [settingRes, historyRes] = await Promise.all([
          checkinApi.getSetting(),
          checkinApi.getHistory(30),
        ]);
        setSetting(settingRes);
        setHistory(historyRes.items);
        setStreakDays(historyRes.streakDays);
        setTotalCheckinDays(historyRes.totalCheckinDays);

        // Use initialStatus if provided, otherwise fall back to derived values
        if (initialStatus) {
          setTodayAnswered(initialStatus.todayAnswered);
          setTodayCompleted(initialStatus.todayCompleted);
        } else {
          // Derive today's info from history (today is the last item or empty)
          const todayStr = formatDate(new Date());
          const todayItem = historyRes.items.find(
            (h: CheckinHistoryItem) => h.date === todayStr,
          );
          if (todayItem) {
            setTodayAnswered(todayItem.answered);
            setTodayCompleted(todayItem.completed);
          }
        }
      } catch (error) {
        logger.error('加载打卡数据失败', error);
        toast.error('加载打卡数据失败');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [open, initialStatus]);

  const handleToggleEnabled = (checked: boolean): void => {
    setSetting((prev) => ({ ...prev, isEnabled: checked }));
  };

  const handleTargetChange = (value: number): void => {
    const clamped = Math.max(1, Math.min(200, Math.floor(value) || 1));
    setSetting((prev) => ({ ...prev, dailyTarget: clamped }));
  };

  const handleTargetInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const raw = e.target.value;
    if (raw === '') {
      setSetting((prev) => ({ ...prev, dailyTarget: 1 }));
      return;
    }
    const num = Number(raw);
    if (!Number.isNaN(num)) {
      handleTargetChange(num);
    }
  };

  const startHold = (direction: 1 | -1): void => {
    // Immediate single step
    handleTargetChange(setting.dailyTarget + direction * 5);
    // Then continuous if held
    holdTimerRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        setSetting((prev) => {
          const next = prev.dailyTarget + direction * 5;
          const clamped = Math.max(1, Math.min(200, next));
          return { ...prev, dailyTarget: clamped };
        });
      }, 120);
    }, 400);
  };

  const stopHold = (): void => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const handleSave = async (): Promise<void> => {
    try {
      setSaving(true);
      const result = await checkinApi.updateSetting({
        isEnabled: setting.isEnabled,
        dailyTarget: setting.dailyTarget,
      });
      toast.success('打卡设置已保存');
      onSaved?.(result);
      onOpenChange(false);
    } catch (error) {
      logger.error('保存打卡设置失败', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // Build calendar grid for last 30 days (5-6 rows × 7 cols)
  const calendarWeeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build a map of date -> history item
    const historyMap = new Map<string, CheckinHistoryItem>();
    for (const h of history) {
      historyMap.set(h.date, h);
    }

    // We want to show a calendar that includes the last 30 days.
    // Start from the Sunday of the week containing 30 days ago.
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);

    // Go back to Sunday
    const startDate = new Date(thirtyDaysAgo);
    startDate.setDate(thirtyDaysAgo.getDate() - thirtyDaysAgo.getDay());

    // End on Saturday of this week (or today, but fill out the week)
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - today.getDay()));

    const weeks: Array<Array<{ date: Date; dateStr: string; inRange: boolean; item?: CheckinHistoryItem; isToday: boolean }>> = [];
    let current = new Date(startDate);

    while (current <= endDate) {
      const week: Array<{ date: Date; dateStr: string; inRange: boolean; item?: CheckinHistoryItem; isToday: boolean }> = [];
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(current);
        const dateStr = formatDate(d);
        const inRange = d >= thirtyDaysAgo && d <= today;
        const item = historyMap.get(dateStr);
        const isToday = dateStr === formatDate(today);
        week.push({ date: d, dateStr, inRange, item, isToday });
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }

    return weeks;
  }, [history]);

  const monthLabel = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}年${today.getMonth() + 1}月`;
  }, []);

  const progressPercent = useMemo(() => {
    if (setting.dailyTarget <= 0) return 0;
    return Math.min(100, (todayAnswered / setting.dailyTarget) * 100);
  }, [todayAnswered, setting.dailyTarget]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Target className="h-5 w-5 text-primary" />
            打卡设置
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Enable switch */}
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                  <Target className="h-4 w-4 text-accent-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    开启打卡功能
                  </div>
                  <div className="text-xs text-muted-foreground">
                    每日完成目标题数即打卡成功
                  </div>
                </div>
              </div>
              <Switch
                checked={setting.isEnabled}
                onCheckedChange={handleToggleEnabled}
              />
            </div>

            {/* Daily target */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-medium text-foreground">
                  每日目标题数
                </div>
                <div className="text-xs text-muted-foreground">范围 1-200</div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  onMouseDown={() => startHold(-1)}
                  onMouseUp={stopHold}
                  onMouseLeave={stopHold}
                  onTouchStart={() => startHold(-1)}
                  onTouchEnd={stopHold}
                  disabled={setting.dailyTarget <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={setting.dailyTarget}
                  onChange={handleTargetInputChange}
                  className="h-9 text-center text-base font-semibold tabular-nums"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  onMouseDown={() => startHold(1)}
                  onMouseUp={stopHold}
                  onMouseLeave={stopHold}
                  onTouchStart={() => startHold(1)}
                  onTouchEnd={stopHold}
                  disabled={setting.dailyTarget >= 200}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="ml-1 text-sm text-muted-foreground">题 / 天</span>
              </div>
            </div>

            {/* Today progress */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-medium text-foreground">今日状态</div>
                {todayCompleted ? (
                  <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <Check className="h-3.5 w-3.5" />
                    今日已打卡
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">继续加油</div>
                )}
              </div>
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-pink-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                今日已答 <span className="font-semibold text-foreground">{todayAnswered}</span> / {setting.dailyTarget} 道不同题目
              </div>
            </div>

            {/* Calendar */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  打卡日历
                </div>
                <div className="text-xs text-muted-foreground">最近 30 天</div>
              </div>
              <div className="mb-2 text-center text-sm font-semibold text-foreground">
                {monthLabel}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
                {WEEK_DAYS.map((d: string) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarWeeks.flat().map((cell) => {
                  const hasCheckin = cell.item?.completed;
                  const dayNum = cell.date.getDate();
                  return (
                    <div
                      key={cell.dateStr}
                      className={`relative flex aspect-square items-center justify-center rounded-md text-[11px] tabular-nums transition-all ${
                        !cell.inRange
                          ? 'text-muted-foreground/30'
                          : hasCheckin
                            ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                            : cell.isToday
                              ? 'bg-accent text-accent-foreground font-medium'
                              : 'text-foreground hover:bg-accent/50'
                      }`}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                <div className="text-2xl font-bold gradient-primary-text tabular-nums">
                  {streakDays}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  连续打卡天数
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                <div className="text-2xl font-bold gradient-primary-text tabular-nums">
                  {totalCheckinDays}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  累计打卡天数
                </div>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={saving || loading}
          >
            {saving ? '保存中...' : '保存设置'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CheckinDialog;
