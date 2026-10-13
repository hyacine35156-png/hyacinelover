import { useState } from 'react';
import { Star, FolderPlus, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

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
import { Label } from '@client/src/components/ui/label';
import { getTagColor } from '@client/src/components/TagChip';
import { favoriteGroupApi } from '@client/src/api';
import type { FavoriteGroupItem } from '@shared/api.interface';

interface MoveToGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: FavoriteGroupItem[];
  questionIds: string[];
  fromGroupId?: string | null;
  onMoved?: () => void;
}

const MoveToGroupDialog = ({
  open,
  onOpenChange,
  groups,
  questionIds,
  fromGroupId = null,
  onMoved,
}: MoveToGroupDialogProps) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('purple');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [moving, setMoving] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleMove = async () => {
    if (!selectedGroupId) {
      toast.error('请选择目标分组');
      return;
    }
    try {
      setMoving(true);
      await favoriteGroupApi.moveQuestions({
        fromGroupId: fromGroupId ?? undefined,
        toGroupId: selectedGroupId,
        questionIds,
      });
      toast.success(`已将 ${questionIds.length} 道题移动到目标分组`);
      onOpenChange(false);
      onMoved?.();
    } catch (error) {
      logger.error('移动题目失败', error);
      toast.error('移动失败');
    } finally {
      setMoving(false);
    }
  };

  const handleCreateAndMove = async () => {
    const name = newGroupName.trim();
    if (!name) {
      toast.error('请输入分组名称');
      return;
    }
    try {
      setCreating(true);
      const group = await favoriteGroupApi.createGroup({
        name,
        color: newGroupColor,
      });
      await favoriteGroupApi.moveQuestions({
        fromGroupId: fromGroupId ?? undefined,
        toGroupId: group.id,
        questionIds,
      });
      toast.success(`已创建分组并移动 ${questionIds.length} 道题`);
      onOpenChange(false);
      onMoved?.();
    } catch (error) {
      logger.error('创建分组并移动失败', error);
      toast.error('操作失败');
    } finally {
      setCreating(false);
    }
  };

  const availableGroups = fromGroupId
    ? groups.filter((g) => g.id !== fromGroupId)
    : groups;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setSelectedGroupId(null);
          setShowNewGroup(false);
          setNewGroupName('');
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            移动到分组
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              （共 {questionIds.length} 题）
            </span>
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3 max-h-[60vh] overflow-y-auto">
          {!showNewGroup ? (
            <>
              {availableGroups.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  暂无其他分组
                </div>
              ) : (
                <div className="space-y-1.5">
                  {availableGroups.map((group) => {
                    const colorCfg = getTagColor(group.color);
                    const isSelected = selectedGroupId === group.id;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border/60 hover:border-primary/30 hover:bg-accent/30'
                        }`}
                      >
                        <span
                          className={`h-3 w-3 shrink-0 rounded-full ${colorCfg.dot}`}
                        />
                        <span className="flex-1 text-sm font-medium text-foreground">
                          {group.name}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {group.questionCount} 题
                        </span>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowNewGroup(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border/60 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 hover:text-accent-foreground"
              >
                <FolderPlus className="h-4 w-4" />
                新建分组
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowNewGroup(false)}
                className="text-xs font-medium text-primary hover:underline"
              >
                ← 选择已有分组
              </button>
              <div className="space-y-2">
                <Label>分组名称</Label>
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="例如：易错题、高频考点…"
                  maxLength={50}
                  className="rounded-xl"
                />
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            取消
          </Button>
          {!showNewGroup ? (
            <Button
              variant="default"
              onClick={handleMove}
              disabled={moving || !selectedGroupId}
              className="rounded-xl bg-gradient-to-r from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] text-white shadow-[0_4px_12px_hsl(265_85%_65%/0.35)] hover:brightness-105"
            >
              {moving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  移动中
                </>
              ) : (
                <>
                  <Star className="h-4 w-4" />
                  移动
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="default"
              onClick={handleCreateAndMove}
              disabled={creating || !newGroupName.trim()}
              className="rounded-xl bg-gradient-to-r from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] text-white shadow-[0_4px_12px_hsl(265_85%_65%/0.35)] hover:brightness-105"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  创建中
                </>
              ) : (
                '创建并移动'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MoveToGroupDialog;
