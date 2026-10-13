import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Bookmark,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  Star,
  Loader2,
} from 'lucide-react';
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
  DialogClose,
} from '@client/src/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import { Label } from '@client/src/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import { TAG_COLORS, getTagColor } from '@client/src/components/TagChip';
import { favoriteGroupApi } from '@client/src/api';
import type { FavoriteGroupItem } from '@shared/api.interface';

interface FavoriteGroupSidebarProps {
  groups: FavoriteGroupItem[];
  activeGroupId: string | null; // null = 全部收藏
  totalFavorites: number;
  onSelectGroup: (groupId: string | null) => void;
  onGroupsChange: () => void;
  loading?: boolean;
}

const FavoriteGroupSidebar = ({
  groups,
  activeGroupId,
  totalFavorites,
  onSelectGroup,
  onGroupsChange,
  loading,
}: FavoriteGroupSidebarProps) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('purple');
  const [submitting, setSubmitting] = useState(false);

  const [editingGroup, setEditingGroup] = useState<FavoriteGroupItem | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<FavoriteGroupItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleCreate = async () => {
    const name = formName.trim();
    if (!name) {
      toast.error('请输入分组名称');
      return;
    }
    try {
      setSubmitting(true);
      const newGroup = await favoriteGroupApi.createGroup({
        name,
        color: formColor,
      });
      toast.success('分组创建成功');
      setCreateOpen(false);
      setFormName('');
      setFormColor('purple');
      onGroupsChange();
      onSelectGroup(newGroup.id);
    } catch (error) {
      logger.error('创建分组失败', error);
      toast.error('创建失败，名称可能已存在');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartRename = (group: FavoriteGroupItem) => {
    setRenamingId(group.id);
    setRenameValue(group.name);
  };

  const handleCommitRename = async () => {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    const group = groups.find((g) => g.id === renamingId);
    if (!group || group.name === name) {
      setRenamingId(null);
      return;
    }
    try {
      await favoriteGroupApi.updateGroup(renamingId, { name });
      toast.success('重命名成功');
      onGroupsChange();
    } catch (error) {
      logger.error('重命名失败', error);
      toast.error('重命名失败，名称可能已存在');
    } finally {
      setRenamingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    try {
      setIsDeleting(true);
      await favoriteGroupApi.deleteGroup(deletingGroup.id);
      toast.success('分组已删除');
      if (activeGroupId === deletingGroup.id) {
        onSelectGroup(null);
      }
      onGroupsChange();
      setDeletingGroup(null);
    } catch (error) {
      logger.error('删除分组失败', error);
      toast.error('删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveOrder = async (group: FavoriteGroupItem, direction: 'up' | 'down') => {
    const idx = groups.findIndex((g) => g.id === group.id);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === groups.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const target = groups[targetIdx];

    try {
      // 交换 sortOrder
      await favoriteGroupApi.updateGroup(group.id, { sortOrder: target.sortOrder });
      await favoriteGroupApi.updateGroup(target.id, { sortOrder: group.sortOrder });
      onGroupsChange();
    } catch (error) {
      logger.error('调整排序失败', error);
      toast.error('调整失败');
    }
  };

  return (
    <div className="w-full shrink-0 space-y-2">
      <div className="flex items-center justify-between px-1 pb-2">
        <h3 className="text-sm font-semibold text-foreground">收藏分组</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCreateOpen(true)}
          className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-accent hover:text-primary"
          title="新建分组"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* 全部收藏 */}
      <button
        type="button"
        onClick={() => onSelectGroup(null)}
        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          activeGroupId === null
            ? 'bg-accent text-accent-foreground shadow-sm'
            : 'text-foreground hover:bg-accent/50 hover:text-accent-foreground'
        }`}
      >
        <Star
          className={`h-4 w-4 ${
            activeGroupId === null ? 'fill-current text-amber-500' : 'text-amber-500/70'
          }`}
        />
        <span className="flex-1 text-left">全部收藏</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {totalFavorites}
        </span>
      </button>

      {/* 分组列表 */}
      <div className="space-y-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            暂无自定义分组
          </div>
        ) : (
          groups.map((group, idx) => {
            const colorCfg = getTagColor(group.color);
            const isActive = activeGroupId === group.id;
            const isRenaming = renamingId === group.id;

            return (
              <div
                key={group.id}
                className={`group relative flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all duration-200 ${
                  isActive
                    ? 'bg-accent/60 text-accent-foreground'
                    : 'text-foreground hover:bg-accent/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectGroup(group.id)}
                  className="flex flex-1 items-center gap-2 overflow-hidden text-left"
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorCfg.dot}`}
                  />
                  {isRenaming ? (
                    <Input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleCommitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitRename();
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 text-sm"
                    />
                  ) : (
                    <span className="truncate text-sm font-medium">
                      {group.name}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                    {group.questionCount}
                  </span>
                </button>

                {/* 操作按钮 */}
                {!isRenaming && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                        title="更多操作"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-36 p-1" side="right" align="end">
                      <button
                        type="button"
                        onClick={() => {
                          handleStartRename(group);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        重命名
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveOrder(group, 'up')}
                        disabled={idx === 0}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                        上移
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveOrder(group, 'down')}
                        disabled={idx === groups.length - 1}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                        下移
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingGroup(group)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除分组
                      </button>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 新建分组对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>新建收藏分组</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>分组名称</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例如：易错题、高频考点…"
                maxLength={50}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>分组颜色</Label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setFormColor(c.name)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
                      formColor === c.name
                        ? `${c.dot} ring-2 ring-offset-2 ${c.ring}`
                        : `${c.dot} opacity-50 hover:opacity-100`
                    }`}
                    aria-label={c.name}
                  />
                ))}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">
                取消
              </Button>
            </DialogClose>
            <Button
              variant="default"
              onClick={handleCreate}
              disabled={submitting || !formName.trim()}
              className="rounded-xl bg-gradient-to-r from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] text-white shadow-[0_4px_12px_hsl(265_85%_65%/0.35)] hover:brightness-105"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  创建中
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  创建分组
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog
        open={!!deletingGroup}
        onOpenChange={(open) => !open && setDeletingGroup(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除分组？</AlertDialogTitle>
            <AlertDialogDescription>
              分组「{deletingGroup?.name}」将被删除，分组中的题目仍然保留在收藏夹中，只是不再属于该分组。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  删除中
                </>
              ) : (
                '确认删除'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FavoriteGroupSidebar;
