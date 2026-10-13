import React from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import AppErrorPage from './AppErrorPage';
import { safeClearStorage, safeSetItem, navigateTo } from '@client/src/utils/env';
import { reportReactError } from '@client/src/utils/error-monitor';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

export class GlobalErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error('[ErrorBoundary] 渲染错误', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    try {
      const existing = localStorage.getItem('__error_log__');
      const logs = existing ? JSON.parse(existing) : [];
      logs.push({
        time: new Date().toISOString(),
        message: error.message,
        path: window.location.pathname,
      });
      if (logs.length > 20) logs.shift();
      localStorage.setItem('__error_log__', JSON.stringify(logs));
    } catch {
      // ignore
    }
    // 上报 React 错误到后端
    try {
      reportReactError(error, { componentStack: errorInfo.componentStack });
    } catch {
      // 上报失败不影响用户体验
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleGoHome = (): void => {
    navigateTo('/');
  };

  handleClearCache = (): void => {
    try {
      safeClearStorage();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  handleSafeMode = (): void => {
    try {
      safeSetItem('__safe_mode__', '1');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <AppErrorPage
          error={this.state.error}
          onRetry={this.handleRetry}
          onGoHome={this.handleGoHome}
          onClearCache={this.handleClearCache}
          onSafeMode={this.handleSafeMode}
          severity="app"
        />
      );
    }
    return this.props.children;
  }
}

export default GlobalErrorBoundary;
