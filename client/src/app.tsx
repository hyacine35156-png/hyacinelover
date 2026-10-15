import React, { useEffect, Suspense } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';

import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { FontSizeProvider } from './contexts/FontSizeContext';
import { WallpaperProvider } from './contexts/WallpaperContext';
import { Spinner } from '@client/src/components/ui/spinner';

const NotFound = React.lazy(() => import('./pages/NotFound/NotFound'));
const BanksPage = React.lazy(() => import('./pages/banks'));
const PracticePage = React.lazy(() => import('./pages/practice'));
const StatsPage = React.lazy(() => import('./pages/stats'));
const FavoritesPage = React.lazy(() => import('./pages/favorites'));
const WrongBookPage = React.lazy(() => import('./pages/wrongbook'));
const TemporaryBanksPage = React.lazy(() => import('./pages/temporary-banks'));
const TagsPage = React.lazy(() => import('./pages/tags'));
const TagDetailPage = React.lazy(() => import('./pages/tags/TagDetailPage'));
const SubjectsPage = React.lazy(() => import('./pages/subjects/SubjectsPage'));
const SearchPage = React.lazy(() => import('./pages/search'));
const SettingsPage = React.lazy(() => import('./pages/settings/SettingsPage'));
const DeviceManagePage = React.lazy(() => import('./pages/settings/DeviceManagePage'));
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/auth/RegisterPage'));
const RecordsPage = React.lazy(() => import('./pages/records'));
const AdminFeedbackPage = React.lazy(() => import('./pages/admin/feedback/AdminFeedbackPage'));
const CollaborationManagePage = React.lazy(() => import('./pages/admin/collaboration/CollaborationManagePage'));
const AdminOperationLogPage = React.lazy(() => import('./pages/admin/operation-log/AdminOperationLogPage'));
const AdminSystemLogPage = React.lazy(() => import('./pages/admin/system-log/AdminSystemLogPage'));
const MyFeedbackPage = React.lazy(() => import('./pages/my-feedback/MyFeedbackPage'));
const UserAgreementPage = React.lazy(() => import('./pages/legal/UserAgreementPage'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/legal/PrivacyPolicyPage'));

import { GlobalErrorBoundary } from '@client/src/components/error/GlobalErrorBoundary';
import { setupGlobalErrorListeners } from '@client/src/utils/error-monitor';
import { setupPerformanceMonitor } from '@client/src/utils/performance-monitor';
import { setupApiInterceptors, AUTH_401_EVENT } from '@client/src/utils/api-error';
import { getUrlPrefix, useNavigate } from '@client/src/utils/router';
import { ensureAuthRequestInterceptor } from '@client/src/api/auth';
import { registerServiceWorker, installPwaManifest } from '@client/src/utils/register-sw';
import { startAutoSync, stopAutoSync } from '@client/src/utils/sync-manager';
import { SettingsSyncManager } from '@client/src/hooks/useSettingsSync';
import VersionUpdateBanner from '@client/src/components/version-update-banner/VersionUpdateBanner';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  return children;
};

function detectUrlPrefix(): string {
  return getUrlPrefix();
}

const RoutesFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Spinner />
      <span className="text-sm">加载中...</span>
    </div>
  </div>
);

const AppRoutes = () => {
  const publicRoutes = (
    <>
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="user-agreement" element={<UserAgreementPage />} />
      <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
    </>
  );

  const protectedRoutes = (
    <Route
      element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="banks" replace />} />
      <Route path="banks" element={<BanksPage />} />
      <Route path="temporary" element={<TemporaryBanksPage />} />
      <Route path="favorites" element={<FavoritesPage />} />
      <Route path="wrongbook" element={<WrongBookPage />} />
      <Route path="tags" element={<TagsPage />} />
      <Route path="tags/:tagId" element={<TagDetailPage />} />
      <Route path="subjects" element={<SubjectsPage />} />
      <Route path="search" element={<SearchPage />} />
      <Route path="practice/:bankId" element={<PracticePage />} />
      <Route path="stats" element={<StatsPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="settings/devices" element={<DeviceManagePage />} />
      <Route path="settings/my-feedback" element={<MyFeedbackPage />} />
      <Route path="admin/feedback" element={<AdminFeedbackPage />} />
      <Route path="admin/collaboration" element={<CollaborationManagePage />} />
      <Route path="admin/operation-logs" element={<AdminOperationLogPage />} />
      <Route path="admin/system-logs" element={<AdminSystemLogPage />} />
      <Route path="records" element={<RecordsPage />} />
    </Route>
  );

  const routeGroup = (
    <>
      {publicRoutes}
      {protectedRoutes}
      <Route path="*" element={<NotFound />} />
    </>
  );

  const urlPrefix = detectUrlPrefix();
  const prefixPath = urlPrefix ? urlPrefix.replace(/^\//, '') : '';

  if (prefixPath) {
    return (
      <Suspense fallback={<RoutesFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to={`${urlPrefix}/banks`} replace />} />
          <Route path={`${prefixPath}/*`}>{routeGroup}</Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<RoutesFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/banks" replace />} />
        {routeGroup}
      </Routes>
    </Suspense>
  );
};

const Auth401Handler = () => {
  const navigate = useNavigate();
  const { clearAuth, isGuest } = useAuth();

  useEffect(() => {
    const handle401 = (event: Event): void => {
      const detail = (event as CustomEvent<{ from?: string }>).detail;
      logger.warn('[Auth401] 收到 401 事件', {
        from: detail?.from,
        currentPath: window.location.pathname,
        isGuest,
      });
      if (isGuest) {
        logger.info('[Auth401] 游客模式下收到 401，跳过登出跳转');
        return;
      }
      clearAuth();
      const redirect = detail?.from || location.pathname;
      navigate('/login', { replace: true, state: { from: redirect } });
    };
    window.addEventListener(AUTH_401_EVENT, handle401);
    return () => {
      window.removeEventListener(AUTH_401_EVENT, handle401);
    };
  }, [navigate, clearAuth, isGuest]);

  return null;
};

const AutoSyncManager = () => {
  const { isAuthenticated, isGuest } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      startAutoSync();
      logger.info('[App] 自动同步已启动');
    } else {
      stopAutoSync();
    }
    return () => {
      stopAutoSync();
    };
  }, [isAuthenticated, isGuest]);

  return null;
};

const RoutesComponent = () => {
  useEffect(() => {
    setupGlobalErrorListeners();
    setupPerformanceMonitor();
    setupApiInterceptors();
    ensureAuthRequestInterceptor();

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const protocol = typeof window !== 'undefined' ? window.location.protocol : '';
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 150) : '';
    let envType = 'unknown';
    if (hostname.endsWith('feishuapp.com') || hostname.endsWith('feishu.cn')) {
      envType = 'production-feishu';
    } else if (hostname.endsWith('aiforce.run')) {
      envType = 'preview-doubao';
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
      envType = 'local-dev';
    }

    logger.info('[Env] 运行环境诊断', {
      origin,
      hostname,
      protocol,
      envType,
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
      userAgent: ua,
      urlPrefix: getUrlPrefix(),
      hasLocalStorage: typeof window !== 'undefined' ? (() => {
        try { return typeof window.localStorage !== 'undefined'; } catch { return false; }
      })() : false,
      hasSessionStorage: typeof window !== 'undefined' ? (() => {
        try { return typeof window.sessionStorage !== 'undefined'; } catch { return false; }
      })() : false,
    });

    logger.info('[App] 应用初始化完成', {
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
      urlPrefix: getUrlPrefix(),
    });

    installPwaManifest();
    registerServiceWorker();
  }, []);

  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <FontSizeProvider>
          <WallpaperProvider>
            <AuthProvider>
              <VersionUpdateBanner />
              <Auth401Handler />
              <AutoSyncManager />
              <SettingsSyncManager />
              <AppRoutes />
            </AuthProvider>
          </WallpaperProvider>
        </FontSizeProvider>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
};

export default RoutesComponent;
