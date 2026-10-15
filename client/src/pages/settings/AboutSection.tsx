import { useState } from 'react';
import { APP_VERSION, APP_VERSION_NOTE } from '@client/src/utils/version';
import { useAuth } from '@client/src/contexts/AuthContext';
import { Keyboard, Info, ChevronDown, Megaphone, FileText, ShieldCheck, Smartphone } from 'lucide-react';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { Link } from 'react-router-dom';

function getClientInfo(): { type: 'web' | 'apk'; version: string } {
  if (typeof navigator === 'undefined') return { type: 'web', version: '网页版' };
  const ua = navigator.userAgent || '';
  const urlParams = new URLSearchParams(window.location.search);
  const apkVersion = urlParams.get('apk_version') || urlParams.get('app_version');
  if (apkVersion) {
    return { type: 'apk', version: apkVersion };
  }
  const match = ua.match(/hyacine\/([\d.]+)/i) || ua.match(/HyacineApp\/([\d.]+)/i);
  if (match) {
    return { type: 'apk', version: match[1] };
  }
  if (/wv\)|WebView|Android.*Version/.test(ua) && /hyacine/i.test(ua)) {
    return { type: 'apk', version: '未知' };
  }
  return { type: 'web', version: '网页版' };
}

const SHORTCUTS = [
  { key: 'Space', description: '显示/切换答案' },
  { key: '← / →', description: '上一题 / 下一题' },
  { key: '1 / 2 / 3 / 4', description: '选择对应选项' },
  { key: 'Enter', description: '确认提交' },
  { key: 'F', description: '收藏/取消收藏' },
  { key: 'R', description: '朗读题目' },
  { key: 'Esc', description: '退出练习' },
];

const ShortcutsSection = () => {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Keyboard className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">快捷键</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              以下快捷键在练习页面生效
            </p>
          </div>
        </div>
        <div className="space-y-1">
          {SHORTCUTS.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
            >
              <span className="text-sm text-foreground">{item.description}</span>
              <kbd className="rounded-md border border-border/60 bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground shadow-sm">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AboutSection = () => {
  const { user } = useAuth();
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">关于应用</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              版本信息与应用详情
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-foreground">应用名称</span>
            <span className="text-sm font-medium text-foreground">hyacine小助手</span>
          </div>
          <div className="border-t border-border/40" />
           <div className="flex items-center justify-between py-2">
             <span className="text-sm text-foreground">客户端版本</span>
             <span className="text-sm font-mono text-muted-foreground">
               {getClientInfo().version}
             </span>
           </div>
           <div className="border-t border-border/40" />
           <div className="flex items-center justify-between py-2">
             <span className="text-sm text-foreground">版本号</span>
             <span className="text-sm font-mono text-muted-foreground">
               {APP_VERSION}
             </span>
           </div>
          <div className="border-t border-border/40" />
          <div className="py-2">
            <div className="mb-1 text-sm text-foreground">版本说明</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {APP_VERSION_NOTE}
            </p>
          </div>
          <div className="border-t border-border/40" />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-foreground">UID</span>
            <span className="text-sm font-mono text-muted-foreground">
              {user?.uid ?? '—'}
            </span>
          </div>
          <div className="border-t border-border/40" />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-foreground"> slogan </span>
            <span className="text-sm text-muted-foreground">
              专注练习 · 高效学习
            </span>
          </div>
           <div className="border-t border-border/40" />
           <Link
             to="/user-agreement"
             className="flex items-center justify-between py-2 text-left transition-colors hover:text-foreground"
           >
             <div className="flex items-center gap-2">
               <FileText className="h-4 w-4 text-primary" />
               <span className="text-sm text-foreground">用户协议</span>
             </div>
             <ChevronDown
               className="h-4 w-4 -rotate-90 text-muted-foreground transition-transform duration-300"
             />
           </Link>
           <div className="border-t border-border/40" />
           <Link
             to="/privacy-policy"
             className="flex items-center justify-between py-2 text-left transition-colors hover:text-foreground"
           >
             <div className="flex items-center gap-2">
               <ShieldCheck className="h-4 w-4 text-primary" />
               <span className="text-sm text-foreground">隐私说明</span>
             </div>
             <ChevronDown
               className="h-4 w-4 -rotate-90 text-muted-foreground transition-transform duration-300"
             />
           </Link>
           <div className="border-t border-border/40" />
           <button
            type="button"
            onClick={() => setShowAnnouncement((prev) => !prev)}
            className="flex w-full items-center justify-between py-2 text-left transition-colors hover:text-foreground"
            aria-expanded={showAnnouncement}
            aria-controls="settings-announcement"
          >
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <span className="text-sm text-foreground">公告</span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
                showAnnouncement ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>
          <div
            id="settings-announcement"
            className={`grid transition-all duration-300 ease-out ${
              showAnnouncement
                ? 'grid-rows-[1fr] opacity-100'
                : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="rounded-lg bg-primary/[0.06] px-3 py-2.5 text-sm text-muted-foreground">
                目前反馈功能暂时不可用，如有疑问请联系
                <UniversalLink
                  to="mailto:1691917356@qq.com"
                  className="ml-1 font-medium text-primary hover:underline"
                >
                  作者
                </UniversalLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { ShortcutsSection, AboutSection };
