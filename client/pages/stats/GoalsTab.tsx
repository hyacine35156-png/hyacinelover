import { useState } from 'react';
import {
  Target,
  Clock,
  Settings,
  CheckCircle2,
  PartyPopper,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import type {
  LearningGoalsItem,
  UpdateLearningGoalsRequest,
} from '@shared/api.interface';
import { statsApi } from '@client/src/api';

interface GoalsTabProps {
  goals: LearningGoalsItem;
  onUpdate: (goals: LearningGoalsItem) => void;
}

const GoalsTab = ({ goals, onUpdate }: GoalsTabProps) => {
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    dailyTarget: goals.dailyTarget,
    dailyTimeTarget: goals.dailyTimeTarget,
    weeklyTarget: goals.weeklyTarget,
    weeklyTimeTarget: goals.weeklyTimeTarget,
  });

  const openEdit = () => {
    setFormData({
      dailyTarget: goals.dailyTarget,
      dailyTimeTarget: goals.dailyTimeTarget,
      weeklyTarget: goals.weeklyTarget,
      weeklyTimeTarget: goals.weeklyTimeTarget,
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const dto: UpdateLearningGoalsRequest = {
        dailyTarget: Number(formData.dailyTarget) || 0,
        dailyTimeTarget: Number(formData.dailyTimeTarget) || 0,
        weeklyTarget: Number(formData.weeklyTarget) || 0,
        weeklyTimeTarget: Number(formData.weeklyTimeTarget) || 0,
      };
      const result = await statsApi.updateLearningGoals(dto);
      onUpdate(result);
      setEditOpen(false);
      toast.success('目标设置已保存');
    } catch (error) {
      logger.error('保存学习目标失败', error);
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const answeredPercent = Math.min(
    Math.round(goals.todayProgress.answeredPercent),
    100,
  );
  const studyPercent = Math.min(
    Math.round(goals.todayProgress.studyPercent),
    100,
  );
  const weekAnsweredPercent = Math.min(
    Math.round(goals.weekProgress.answeredPercent),
    100,
  );
  const weekStudyPercent = Math.min(
    Math.round(goals.weekProgress.studyPercent),
    100,
  );

  const formatSeconds = (seconds: number): string => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}分钟`;
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}小时${m}分` : `${h}小时`;
  };

  return (
    <div className="space-y-6 fade-in-up">
      {/* 目标设置卡片 */}
      <Card className="card-hover rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef]" />
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Target className="h-5 w-5 text-primary" />
            学习目标设置
          </CardTitle>
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Settings className="h-3.5 w-3.5" />
            编辑目标
          </Button>
        </CardHeader>
        <CardContent>
          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
            data-ai-section-type="card-stat"
          >
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-[#d946ef]/10 p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Target className="h-3.5 w-3.5" />
                <span className="text-xs">每日作答</span>
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {goals.dailyTarget}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">题</span>
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-[#3b82f6]/10 to-[#6366f1]/10 p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">每日时长</span>
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {goals.dailyTimeTarget}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">分钟</span>
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-[#22c55e]/10 to-[#10b981]/10 p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="text-xs">每周作答</span>
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {goals.weeklyTarget}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">题</span>
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-[#f59e0b]/10 to-[#ef4444]/10 p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">每周时长</span>
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {goals.weeklyTimeTarget}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">分钟</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 今日目标 */}
      <Card className="card-hover rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef]" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg font-semibold">
            <span className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              今日目标
            </span>
            {goals.todayProgress.completed && (
              <span className="flex items-center gap-1 rounded-full bg-[#22c55e]/10 px-3 py-1 text-xs font-medium text-[#22c55e]">
                <PartyPopper className="h-3.5 w-3.5" />
                已完成 🎉
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <GoalProgressItem
            icon={Target}
            label="作答题数目标"
            current={goals.todayProgress.answeredCount}
            target={goals.dailyTarget}
            unit="题"
            percent={answeredPercent}
            color="#8b5cf6"
          />
          <GoalProgressItem
            icon={Clock}
            label="学习时长目标"
            current={Math.floor(goals.todayProgress.studySeconds / 60)}
            target={goals.dailyTimeTarget}
            unit="分钟"
            percent={studyPercent}
            color="#22c55e"
          />
        </CardContent>
      </Card>

      {/* 本周目标 */}
      <Card className="card-hover rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[#f59e0b] to-[#ef4444]" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg font-semibold">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#f59e0b]" />
              本周目标
            </span>
            {goals.weekProgress.completed && (
              <span className="flex items-center gap-1 rounded-full bg-[#22c55e]/10 px-3 py-1 text-xs font-medium text-[#22c55e]">
                <PartyPopper className="h-3.5 w-3.5" />
                已完成 🎉
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <GoalProgressItem
            icon={Target}
            label="作答题数目标"
            current={goals.weekProgress.answeredCount}
            target={goals.weeklyTarget}
            unit="题"
            percent={weekAnsweredPercent}
            color="#8b5cf6"
          />
          <GoalProgressItem
            icon={Clock}
            label="学习时长目标"
            current={Math.floor(goals.weekProgress.studySeconds / 60)}
            target={goals.weeklyTimeTarget}
            unit="分钟"
            percent={weekStudyPercent}
            color="#22c55e"
          />
        </CardContent>
      </Card>

      {/* 编辑目标弹窗 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑学习目标</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">每日目标</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">作答题数（题）</label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.dailyTarget}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, dailyTarget: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">学习时长（分钟）</label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.dailyTimeTarget}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dailyTimeTarget: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">每周目标</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">作答题数（题）</label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.weeklyTarget}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        weeklyTarget: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">学习时长（分钟）</label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.weeklyTimeTarget}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        weeklyTimeTarget: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface GoalProgressItemProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  current: number;
  target: number;
  unit: string;
  percent: number;
  color: string;
}

const GoalProgressItem = ({
  icon: Icon,
  label,
  current,
  target,
  unit,
  percent,
  color,
}: GoalProgressItemProps) => {
  const isComplete = percent >= 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold tabular-nums text-foreground">
            {current}
            <span className="text-xs font-normal text-muted-foreground">/{target}{unit}</span>
          </span>
          {isComplete ? (
            <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
          ) : (
            <span
              className="text-xs font-medium tabular-nums"
              style={{ color }}
            >
              {percent}%
            </span>
          )}
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(percent, 100)}%`,
            background: isComplete
              ? 'linear-gradient(90deg, #22c55e, #10b981)'
              : `linear-gradient(90deg, ${color}, ${color}dd)`,
          }}
        />
      </div>
    </div>
  );
};

export default GoalsTab;
