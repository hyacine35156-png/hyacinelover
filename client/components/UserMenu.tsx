import { useState } from 'react';
import { useNavigate } from '@client/src/utils/router';
import {
  Check,
  LogOut,
  User,
  UserPlus,
  ChevronDown,
  X,
  Trash2,
  Users,
  Settings,
  MessageSquare,
  ShieldCheck,
  FileText,
  Server,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@client/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@client/src/components/ui/dropdown-menu';
import { useAuth } from '@client/src/contexts/AuthContext';
import type { SavedAccount } from '@client/src/api/auth';
import FeedbackDialog from '@client/src/components/FeedbackDialog';

const UserMenu = () => {
  const navigate = useNavigate();
  const {
    user,
    logout,
    clearAuth,
    switchAccount,
    removeSavedAccount,
    getSavedAccounts,
  } = useAuth();
  const isAdmin = user?.role === 'admin';
   const [open, setOpen] = useState<boolean>(false);
   const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
   const [isSwitching, setIsSwitching] = useState<string | null>(null);
   const [feedbackOpen, setFeedbackOpen] = useState<boolean>(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(
    getSavedAccounts(),
  );

  if (!user) return null;

  const refreshSavedAccounts = (): void => {
    setSavedAccounts(getSavedAccounts());
  };

  const handleSwitchUser = (): void => {
    setOpen(false);
    clearAuth();
    toast.info('已切换到登录页');
    navigate('/login', { replace: true });
  };

  const handleLogout = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success('已退出登录');
      navigate('/login', { replace: true });
    } catch (error) {
      logger.error('退出登录失败', error);
      clearAuth();
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSwitchAccount = async (username: string): Promise<void> => {
    if (username === user.username) return;
    setIsSwitching(username);
    setOpen(false);
    refreshSavedAccounts();
    try {
      await switchAccount(username);
      toast.success(`已切换到账号 ${username}`);
    } catch (error) {
      logger.error('切换账号失败', error);
      toast.error(`切换失败：账号 ${username} 已失效，已从列表中移除`);
    } finally {
      setIsSwitching(null);
    }
  };

  const handleRemoveAccount = (
    e: React.MouseEvent<HTMLButtonElement>,
    username: string,
  ): void => {
    e.stopPropagation();
    e.preventDefault();
    removeSavedAccount(username);
    refreshSavedAccounts();
    toast.info(`已移除账号 ${username}`);
  };

  const handleClearAll = (): void => {
    for (const acc of savedAccounts) {
      removeSavedAccount(acc.username);
    }
    refreshSavedAccounts();
    toast.info('已清除全部已保存账号');
  };

   return (
     <>
       <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 px-2 sm:px-2.5"
          data-ai-section-type="button"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
           <span className="hidden max-w-[160px] truncate text-sm font-medium text-foreground sm:block" title={user.username}>
             {user.username}
           </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>
       <DropdownMenuContent align="end" className="w-60">
         <DropdownMenuLabel className="break-all">
           {user.username}
         </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Users className="h-4 w-4" />
            切换账号
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              已保存的账号
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {savedAccounts.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                暂无已保存账号
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {savedAccounts.map((acc: SavedAccount) => {
                  const isCurrent = acc.username === user.username;
                  const switching = isSwitching === acc.username;
                  return (
                    <div
                      key={acc.username}
                      role="button"
                      tabIndex={0}
                      className="group flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                      onClick={() => {
                        void handleSwitchAccount(acc.username);
                      }}
                      onKeyDown={(
                        e: React.KeyboardEvent<HTMLDivElement>,
                      ) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void handleSwitchAccount(acc.username);
                        }
                      }}
                    >
                      <div className="flex h-4 w-4 items-center justify-center">
                        {isCurrent ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : null}
                      </div>
                      <span
                        className={`flex-1 truncate ${
                          isCurrent
                            ? 'font-medium text-primary'
                            : 'text-foreground'
                        }`}
                      >
                        {acc.username}
                      </span>
                      {switching ? (
                        <span className="text-xs text-muted-foreground">
                          切换中...
                        </span>
                      ) : (
                        <button
                          type="button"
                          aria-label={`移除账号 ${acc.username}`}
                          className="flex h-5 w-5 items-center justify-center rounded-sm text-transparent hover:bg-destructive/10 hover:text-destructive group-hover:text-muted-foreground group-hover:opacity-100 focus:text-destructive focus:outline-none"
                          onClick={(
                            e: React.MouseEvent<HTMLButtonElement>,
                          ) => handleRemoveAccount(e, acc.username)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {savedAccounts.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div
                  role="button"
                  tabIndex={0}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:outline-none"
                  onClick={handleClearAll}
                  onKeyDown={(
                    e: React.KeyboardEvent<HTMLDivElement>,
                  ) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleClearAll();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  清除全部
                </div>
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
         <DropdownMenuItem onClick={() => { setOpen(false); navigate('/settings'); }}>
           <Settings className="h-4 w-4" />
           设置
         </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setOpen(false); setFeedbackOpen(true); }}>
            <MessageSquare className="h-4 w-4" />
            意见反馈
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuItem onClick={() => { setOpen(false); navigate('/admin/feedback'); }}>
                <ShieldCheck className="h-4 w-4" />
                反馈管理
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setOpen(false); navigate('/admin/collaboration'); }}>
                <Users className="h-4 w-4" />
                协作管理
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setOpen(false); navigate('/admin/operation-logs'); }}>
                <FileText className="h-4 w-4" />
                操作日志
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setOpen(false); navigate('/admin/system-logs'); }}>
                <Server className="h-4 w-4" />
                系统日志
              </DropdownMenuItem>
            </>
          )}
        <DropdownMenuItem onClick={handleSwitchUser}>
          <UserPlus className="h-4 w-4" />
          切换用户
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoggingOut}
          variant="destructive"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? '退出中...' : '退出登录'}
        </DropdownMenuItem>
       </DropdownMenuContent>
       </DropdownMenu>
       <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
     </>
   );
};

export default UserMenu;
