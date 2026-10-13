import React, { useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Home,
  RotateCcw,
  Shield,
  Copy,
  Check,
  MessageSquare,
  Send,
  WifiOff,
} from 'lucide-react';
import {
  classifyError,
  getErrorMeta,
  type ErrorCategory,
} from '@client/src/utils/error';
import { Button } from '@client/src/components/ui/button';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { reportError } from '@client/src/utils/error-monitor';
import { useNavigate } from 'react-router-dom';

interface AppErrorPageProps {
  error: unknown;
  onRetry?: () => void;
  onGoHome?: () => void;
  onClearCache?: () => void;
  onSafeMode?: () => void;
  severity?: 'page' | 'app';
}

function sanitizeErrorMessage(raw: string): string {
  if (!raw) return '';
  const lines = raw.split(/\r?\n/);
  const firstLine =
    lines.find((line: string) => line.trim() && !/^\s*at\s/.test(line)) ?? '';
  let cleaned = firstLine
    .replace(/\/[^\s]+\/[^\s]+/g, '[路径已隐藏]')
    .replace(/[A-Za-z]:\\[^\s]+/g, '[路径已隐藏]')
    .replace(/\bSELECT\b.*?\bFROM\b/gi, '[SQL 语句已隐藏]')
    .replace(/\bINSERT\b.*?\bINTO\b/gi, '[SQL 语句已隐藏]')
    .replace(/\bUPDATE\b.*?\bSET\b/gi, '[SQL 语句已隐藏]')
    .replace(/\bDELETE\b.*?\bFROM\b/gi, '[SQL 语句已隐藏]');
  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 200) + '...';
  }
  return cleaned;
}

function buildFullErrorReport(
  error: unknown,
  info: { category: string; status?: number; code?: string },
): string {
  const timestamp = new Date().toISOString();
  const path =
    typeof window !== 'undefined' ? window.location.pathname : 'N/A';
  const rawMessage =
    error instanceof Error ? error.message : String(error ?? '');
  const stack = error instanceof Error ? error.stack : undefined;
  const lines: string[] = [
    `时间：${timestamp}`,
    `路径：${path}`,
    `错误类别：${info.category}`,
  ];
  if (info.status) lines.push(`状态码：${info.status}`);
  if (info.code) lines.push(`错误码：${info.code}`);
  lines.push(`错误描述：${rawMessage}`);
  if (stack) lines.push(`堆栈信息：${stack}`);
  return lines.join('\n');
}

export const AppErrorPage: React.FC<AppErrorPageProps> = ({
  error,
  onRetry,
  onGoHome,
  onClearCache,
  onSafeMode,
  severity = 'page',
}) => {
  const navigate = useNavigate();
  const info = classifyError(error);
  const meta = getErrorMeta(info.category);
  const isApp = severity === 'app';
  const [copied, setCopied] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<
    'idle' | 'submitting' | 'success'
  >('idle');

  const safeMessage = sanitizeErrorMessage(info.message);

  const isOffline =
    info.category === 'network' &&
    typeof navigator !== 'undefined' &&
    navigator.onLine === false;

  const handleCopy = async (): Promise<void> => {
    try {
      const report = buildFullErrorReport(error, info);
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.warn('[AppErrorPage] 复制失败', { err });
    }
  };

  const handleSubmitFeedback = async (): Promise<void> => {
    if (!feedbackText.trim()) return;
    setFeedbackStatus('submitting');
    try {
      const stack = error instanceof Error ? error.stack : undefined;
      const message =
        error instanceof Error ? error.message : String(error ?? '');
      await reportError(
        {
          message: message || 'React组件错误',
          stack,
          type: 'react',
          userFeedback: feedbackText.trim(),
        },
        { force: true },
      );
      setFeedbackStatus('success');
      logger.info('[AppErrorPage] 错误反馈已提交');
    } catch (err) {
      logger.warn('[AppErrorPage] 反馈提交失败', {
        error: err instanceof Error ? err.message : String(err),
      });
      setFeedbackStatus('idle');
    }
  };

  if (isOffline) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4 ${isApp ? 'fixed inset-0 z-[200]' : ''}`}
        role="alert"
      >
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 text-center shadow-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/20 dark:to-red-900/20">
            <WifiOff className="h-10 w-10 text-orange-500" aria-hidden="true" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-foreground">网络连接已断开</h1>
          <p className="mt-3 text-base text-muted-foreground">
            当前处于离线状态，无法加载页面内容。<br />
            请检查您的网络连接后重试。
          </p>
          <div className="mt-8 space-y-3">
            <Button
              onClick={onRetry ?? (() => window.location.reload())}
              className="w-full gap-2"
              size="lg"
            >
              <RefreshCw className="h-4 w-4" />
              重新加载
            </Button>
            <Button
              onClick={onGoHome ?? (() => { navigate('/'); })}
              variant="outline"
              className="w-full gap-2"
              size="lg"
            >
              <Home className="h-4 w-4" />
              返回首页
            </Button>
          </div>
          <div className="mt-8 rounded-xl bg-muted/50 p-4 text-left">
            <h3 className="text-sm font-semibold text-foreground">常见解决办法</h3>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li>• 检查 Wi-Fi 或移动数据是否开启</li>
              <li>• 确认当前网络可以正常访问其他网站</li>
              <li>• 尝试切换网络（如从 Wi-Fi 切换到移动数据）</li>
              <li>• 关闭后重新打开应用</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-background p-4 ${isApp ? 'fixed inset-0 z-[200]' : ''}`}
    >
      <div className="w-full max-w-md bg-card rounded-xl shadow-sm border border-border p-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-5">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {meta.title}
          </h2>
          <p className="text-muted-foreground text-sm mb-1">
            {meta.description}
          </p>
          {info.status && (
            <p className="text-xs text-muted-foreground mb-4">
              错误码：{info.status}
            </p>
          )}
          <div className="w-full bg-accent/40 rounded-lg p-3 mb-5 text-left border border-accent/60">
            <p className="text-xs text-muted-foreground mb-1">错误描述：</p>
            <p className="text-sm text-foreground break-words leading-relaxed">
              {safeMessage || '暂无详细信息'}
            </p>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            💡 建议：{meta.suggestion}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {onRetry && (
            <Button
              onClick={onRetry}
              className="w-full text-white"
              style={{
                background:
                  'linear-gradient(135deg, hsl(265 85% 65%) 0%, hsl(290 75% 65%) 100%)',
                border: 'none',
                boxShadow: '0 4px 12px -2px hsl(265 85% 65% / 0.35)',
              }}
            >
              <RefreshCw className="w-4 h-4" />
              重新加载
            </Button>
          )}
          <div className="flex gap-2">
            {onGoHome && (
              <Button variant="outline" onClick={onGoHome} className="flex-1">
                <Home className="w-4 h-4 mr-2" />
                返回首页
              </Button>
            )}
            {onClearCache && (
              <Button
                variant="outline"
                onClick={onClearCache}
                className="flex-1"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                清除缓存
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={handleCopy} className="w-full">
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2 text-success" />
                <span className="text-success">已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                复制错误信息
              </>
            )}
          </Button>

          {!showFeedback && (
            <Button
              variant="outline"
              onClick={() => setShowFeedback(true)}
              className="w-full"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              反馈此错误
            </Button>
          )}

          {showFeedback && (
            <div className="w-full border border-border rounded-lg p-3 bg-accent/20">
              <p className="text-xs text-muted-foreground mb-2">
                描述一下发生了什么（可选）：
              </p>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="例如：点击某个按钮后出现此错误..."
                className="w-full h-20 p-2 text-sm rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
              />
              <div className="flex gap-2 mt-2">
                {feedbackStatus === 'success' ? (
                  <div className="flex-1 text-center text-sm text-success py-2">
                    ✅ 感谢反馈，我们会尽快处理
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleSubmitFeedback}
                    disabled={feedbackStatus === 'submitting'}
                    className="flex-1 text-white"
                    style={{
                      background:
                        'linear-gradient(135deg, hsl(265 85% 65%) 0%, hsl(290 75% 65%) 100%)',
                      border: 'none',
                    }}
                  >
                    <Send className="w-3 h-3 mr-2" />
                    {feedbackStatus === 'submitting' ? '提交中...' : '提交反馈'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {onSafeMode && (
            <Button
              variant="ghost"
              onClick={onSafeMode}
              className="w-full text-muted-foreground"
            >
              <Shield className="w-4 h-4 mr-2" />
              以安全模式启动（跳过部分功能）
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppErrorPage;
