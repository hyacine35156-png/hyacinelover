import { Settings, ShieldCheck, MessageCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '@client/src/contexts/AuthContext';
import { Link } from 'react-router-dom';
import AppearanceSection from './AppearanceSection';
import PracticeSettingsSection from './PracticeSettingsSection';
import WallpaperSection from './WallpaperSection';
import VoiceSection from './VoiceSection';
import AccountSecuritySection from './AccountSecuritySection';
import SyncSection from './SyncSection';
import OfflineSection from './OfflineSection';
import { ShortcutsSection, AboutSection } from './AboutSection';

const SettingsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="mx-auto w-full max-w-2xl fade-in-up">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            设置
          </h1>
<p className="text-sm text-muted-foreground wallpaper-text-muted">
             个性化你的练习体验
          </p>
        </div>
      </div>

      {/* 设置分区 */}
      <div className="space-y-4">
        <AppearanceSection />
        <PracticeSettingsSection />
        <WallpaperSection />
        <VoiceSection />
        <AccountSecuritySection />
        <SyncSection />
        <OfflineSection />
        <ShortcutsSection />
        <AboutSection />
        <FeedbackEntrySection isAdmin={isAdmin} />
      </div>
    </div>
  );
};

export default SettingsPage;

const FeedbackEntrySection = ({ isAdmin }: { isAdmin: boolean }) => {
  return (
    <div className="space-y-3">
      {isAdmin && (
        <Link
          to="/admin/feedback"
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md sm:p-6"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">反馈管理</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              查看和处理所有用户反馈
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
        </Link>
      )}
      <Link
        to="/settings/my-feedback"
        className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md sm:p-6"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">我的反馈</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            查看我提交的反馈和处理进度
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
      </Link>
    </div>
  );
};
