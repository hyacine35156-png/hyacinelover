import { Link, useNavigate } from '@client/src/utils/router';
import { FolderOpen, FolderPlus, Settings, Target, Check, Megaphone, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getTagColor } from '@client/src/components/TagChip';
import type { SubjectItem, CheckinStatusResponse } from '@shared/api.interface';
import { APP_VERSION } from '@client/src/utils/version';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { useAuth } from '@client/src/contexts/AuthContext';

export type SubjectFilterValue = 'all' | 'uncategorized' | string;

interface BankSidebarProps {
  subjects: SubjectItem[];
  totalCount: number;
  uncategorizedCount: number;
  selected: SubjectFilterValue;
  onSelect: (value: SubjectFilterValue) => void;
  checkinStatus: CheckinStatusResponse | null;
  onOpenCheckin: () => void;
  onCloseSidebar?: () => void;
  sticky?: boolean;
}

const BankSidebar = ({
  subjects,
  totalCount,
  uncategorizedCount,
  selected,
  onSelect,
  checkinStatus,
  onOpenCheckin,
  onCloseSidebar,
  sticky = true,
}: BankSidebarProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [subjectsExpanded, setSubjectsExpanded] = useState(true);

  const subjectItems: Array<{
    key: SubjectFilterValue;
    label: string;
    count: number;
    color?: string;
  }> = [
    { key: 'uncategorized', label: '未分类', count: uncategorizedCount },
    ...subjects.map((s) => ({
      key: s.id,
      label: s.name,
      count: s.bankCount ?? 0,
      color: s.color,
    })),
  ];

  return (
    <aside className="shrink-0">
      <div className={`space-y-1 rounded-xl border border-border/60 bg-card p-2 shadow-sm ${sticky ? 'sticky top-20' : ''}`}>
        <button
          type="button"
          onClick={() => {
            onSelect('all');
            onCloseSidebar?.();
          }}
          className={`group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
            selected === 'all'
              ? 'bg-accent/70 text-accent-foreground font-medium'
              : 'text-foreground hover:bg-accent/40'
          }`}
        >
          {selected === 'all' && (
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
          )}
          <FolderOpen className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground" />
          <span className="flex-1 truncate text-left">全部题集</span>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {totalCount}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSubjectsExpanded((prev) => !prev);
            }}
            className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-expanded={subjectsExpanded}
            aria-label={subjectsExpanded ? '收起科目列表' : '展开科目列表'}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                subjectsExpanded ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </button>
        </button>

        <div
          className={`grid transition-all duration-200 ease-out ${
            subjectsExpanded
              ? 'grid-rows-[1fr] opacity-100'
              : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-0.5 pt-0.5">
              {subjectItems.map((item) => {
                const isActive = selected === item.key;
                const colorCfg = item.color ? getTagColor(item.color) : null;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onSelect(item.key);
                      onCloseSidebar?.();
                    }}
                    className={`group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                      isActive
                        ? 'bg-accent/70 text-accent-foreground font-medium'
                        : 'text-foreground hover:bg-accent/40'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                    )}
                    {item.key === 'uncategorized' ? (
                      <FolderPlus className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground" />
                    ) : (
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          colorCfg?.dot ?? 'bg-muted'
                        }`}
                      />
                    )}
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-2 space-y-2 border-t border-border/60 pt-3">
           <Link
             to="/subjects"
             className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground"
           >
             <Settings className="h-4 w-4" />
             <span>管理科目</span>
           </Link>
            <button
              type="button"
              onClick={onOpenCheckin}
              className="flex w-full flex-col gap-1.5 rounded-lg px-3 py-2 text-left transition-all duration-200 hover:bg-accent"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-accent-foreground">
                <Target className="h-4 w-4" />
                <span>打卡设置</span>
              </div>
              {checkinStatus?.isEnabled && (
                <div className="pl-6">
                  {checkinStatus.todayCompleted ? (
                    <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <Check className="h-3 w-3" />
                      <span>今日已打卡</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-pink-400 transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              (checkinStatus.todayAnswered /
                                Math.max(1, checkinStatus.dailyTarget)) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        今日 {checkinStatus.todayAnswered}/
                        {checkinStatus.dailyTarget}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </button>
            <div className="pt-2 text-center space-y-0.5">
               <span
                 className="block text-[11px] font-medium tabular-nums"
                 style={{
                   color: 'hsl(265 40% 55%)',
                   textShadow: '0 1px 2px hsl(0 0% 100% / 0.6)',
                 }}
                 title={APP_VERSION}
               >
                 {APP_VERSION}
               </span>
               {user?.uid && (
                 <span
                   className="block text-[11px] font-medium tabular-nums"
                   style={{
                     color: 'hsl(265 40% 55%)',
                     textShadow: '0 1px 2px hsl(0 0% 100% / 0.6)',
                   }}
                   title={`UID: ${user.uid}`}
                 >
                   UID: {user.uid}
                 </span>
               )}
             </div>

            <div className="mt-2 overflow-hidden rounded-lg border border-primary/15 bg-primary/[0.05]">
              <button
                type="button"
                onClick={() => setShowAnnouncement((prev) => !prev)}
                className="flex w-full items-center justify-between px-2.5 py-1.5 text-left transition-all duration-200 hover:bg-primary/[0.08]"
                aria-expanded={showAnnouncement}
                aria-controls="sidebar-announcement"
              >
                <div className="flex items-center gap-1.5">
                  <Megaphone className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">公告</span>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 ${
                    showAnnouncement ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </button>
              <div
                id="sidebar-announcement"
                className={`grid transition-all duration-300 ease-out ${
                  showAnnouncement
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-2.5 pb-2 pt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    目前反馈功能暂时不可用，如有疑问请联系
                    <UniversalLink
                      to="mailto:1691917356@qq.com"
                      className="ml-0.5 font-medium text-primary hover:underline"
                    >
                      作者
                    </UniversalLink>
                    。题集上传请通过ai工具手动转化成符合条件的json格式。
                  </div>
                </div>
              </div>
            </div>
         </div>
      </div>
    </aside>
  );
};

export default BankSidebar;
