import { useState, useEffect, useCallback } from 'react';
import {
  Star,
  StarOff,
  FolderPlus,
  Check,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import { Label } from '@client/src/components/ui/label';
import { getTagColor } from '@client/src/components/TagChip';
import { favoriteGroupApi, questionBankApi } from '@client/src/api';
import type { FavoriteGroupItem } from '@shared/api.interface';

interface FavoriteGroupMenuProps {
  questionId: string;
  isFavorited: boolean;
  onToggle?: (favorited: boolean) => void;
  isGuest?: boolean;
  size?: 'sm' | 'md';
}

const FavoriteGroupMenu = ({
  questionId,
  isFavorited,
  onToggle,
  isGuest,
  size = 'md',
}: FavoriteGroupMenuProps) => {
  const [open, setOpen] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [groups, setGroups] = useState<FavoriteGroupItem[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('purple');
  const [creating, setCreating] = useState(false);
  const [currentGroupIds, setCurrentGroupIds] = useState<Set<string>>(new Set());

  const loadGroups = useCallback(async () => {
    try {
      setGroupsLoading(true);
      const res = await favoriteGroupApi.getGroups();
      setGroups(res.items);
    } catch (error) {
      logger.error('加载收藏分组失败', error);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  // 打开时加载分组
  useEffect(() => {
    if (open) {
      void loadGroups();
    }
  }, [open, loadGroups]);

  // 点击星标按钮：未收藏直接收藏；已收藏则打开下拉菜单
  const handleStarClick = async () => {
    if (isGuest) {
      toast.info('登录后可使用收藏功能');
      return;
    }
    if (!isFavorited) {
      // 直接收藏
      try {
        setFavoriting(true);
        await questionBankApi.updateFavorite({
          questionId,
          isFavorited: true,
        });
        onToggle?.(true);
        toast.success('已收藏');
      } catch (error) {
        logger.error('收藏操作失败', error);
        toast.error('操作失败');
      } finally {
        setFavoriting(false);
      }
    } else {
      // 已收藏：打开下拉菜单（由 PopoverTrigger 控制）
      setOpen(true);
    }
  };

  // 取消收藏
  const handleUnfavorite = async () => {
    if (isGuest) return;
    try {
      setSubmitting(true);
      await questionBankApi.updateFavorite({
        questionId,
        isFavorited: false,
      });
      onToggle?.(false);
      toast.success('已取消收藏');
      setOpen(false);
      setCurrentGroupIds(new Set());
    } catch (error) {
      logger.error('取消收藏失败', error);
      toast.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 收藏到指定分组
  const handleFavoriteToGroup = async (groupId: string) => {
    if (isGuest) return;
    setSubmitting(true);
    try {
      // 先确保是收藏状态
      if (!isFavorited) {
        await questionBankApi.updateFavorite({
          questionId,
          isFavorited: true,
        });
        onToggle?.(true);
      }
      // 加入分组
      await favoriteGroupApi.addQuestionsToGroup(groupId, [questionId]);
      setCurrentGroupIds((prev) => new Set(prev).add(groupId));
      toast.success('已收藏到该分组');
      setOpen(false);
    } catch (error) {
      logger.error('收藏到分组失败', error);
      toast.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 从分组移除
  const handleRemoveFromGroup = async (groupId: string) => {
    if (isGuest) return;
    setSubmitting(true);
    try {
      await favoriteGroupApi.removeQuestionFromGroup(groupId, questionId);
      setCurrentGroupIds((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
      toast.success('已从分组移除');
      setOpen(false);
    } catch (error) {
      logger.error('从分组移除失败', error);
      toast.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 新建分组并收藏
  const handleCreateAndFavorite = async () => {
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
      if (!isFavorited) {
        await questionBankApi.updateFavorite({
          questionId,
          isFavorited: true,
        });
        onToggle?.(true);
      }
      await favoriteGroupApi.addQuestionsToGroup(group.id, [questionId]);
      setCurrentGroupIds((prev) => new Set(prev).add(group.id));
      toast.success('已创建分组并收藏');
      setOpen(false);
      setShowNewGroup(false);
      setNewGroupName('');
      await loadGroups();
    } catch (error) {
      logger.error('创建分组并收藏失败', error);
      toast.error('操作失败');
    } finally {
      setCreating(false);
    }
  };

  const starClass = size === 'sm'
    ? 'h-3.5 w-3.5'
    : 'h-5 w-5';
  const btnClass = size === 'sm'
    ? 'h-8 w-8 rounded-lg text-xs'
    : 'h-9 w-9 rounded-xl';

  // 未收藏时，星标按钮直接触发收藏（不打开菜单）
  if (!isFavorited) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled={isGuest || favoriting}
        onClick={handleStarClick}
        className={`${btnClass} shrink-0 transition-all duration-200 hover:scale-105 disabled:hover:scale-100 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10`}
        title="收藏本题"
      >
        {favoriting ? (
          <Loader2 className={`${starClass} animate-spin text-amber-500`} />
        ) : (
          <Star className={starClass} />
        )}
      </Button>
    );
  }

  // 已收藏时，打开下拉菜单
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={isGuest}
          className={`${btnClass} relative shrink-0 transition-all duration-200 hover:scale-105 disabled:hover:scale-100 text-amber-500 hover:bg-amber-500/10`}
          title="收藏管理"
        >
          <Star className={`${starClass} fill-current`} />
          <ChevronDown className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-amber-600/70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" side="right" align="start">
        {groupsLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1">
            {/* 取消收藏 */}
            <button
              type="button"
              onClick={handleUnfavorite}
              disabled={submitting}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <StarOff className="h-4 w-4" />
              取消收藏
            </button>

            {groups.length > 0 && (
              <div className="my-1 border-t border-border/50" />
            )}

            {/* 分组列表 */}
            {groups.map((group) => {
              const colorCfg = getTagColor(group.color);
              const inGroup = currentGroupIds.has(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    if (inGroup) {
                      void handleRemoveFromGroup(group.id);
                    } else {
                      void handleFavoriteToGroup(group.id);
                    }
                  }}
                  disabled={submitting}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorCfg.dot}`}
                  />
                  <span className="flex-1 truncate">{group.name}</span>
                  {inGroup && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              );
            })}

            {/* 新建分组 */}
            {!showNewGroup ? (
              <>
                <div className="my-1 border-t border-border/50" />
                <button
                  type="button"
                  onClick={() => setShowNewGroup(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <FolderPlus className="h-4 w-4" />
                  新建分组
                </button>
              </>
            ) : (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewGroup(false)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  ← 返回
                </button>
                <div className="space-y-1.5">
                  <Label className="text-xs">分组名称</Label>
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="输入分组名称"
                    maxLength={50}
                    className="h-8 text-xs rounded-lg"
                    autoFocus
                  />
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCreateAndFavorite}
                  disabled={creating || !newGroupName.trim()}
                  className="w-full rounded-lg bg-gradient-to-r from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] text-white text-xs"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      创建中
                    </>
                  ) : (
                    '创建并收藏'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default FavoriteGroupMenu;
