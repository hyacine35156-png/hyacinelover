import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Shield } from 'lucide-react';
import { runSelfCheck, type SelfCheckResult } from '@client/src/utils/self-check';
import { Button } from '@client/src/components/ui/button';

interface SelfCheckPageProps {
  onPassed: () => void;
  onSafeMode?: () => void;
}

export const SelfCheckPage: React.FC<SelfCheckPageProps> = ({ onPassed, onSafeMode }) => {
  const [result, setResult] = useState<SelfCheckResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runSelfCheck().then((res) => {
      setResult(res);
      setLoading(false);
      if (res.allPassed) {
        setTimeout(onPassed, 300);
      }
    });
  }, [onPassed]);

  const handleRetry = (): void => {
    setLoading(true);
    setResult(null);
    runSelfCheck().then((res) => {
      setResult(res);
      setLoading(false);
      if (res.allPassed) {
        setTimeout(onPassed, 300);
      }
    });
  };

  const handleContinue = (): void => {
    onPassed();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-foreground">正在启动自检...</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const failedItems = result.items.filter((i) => !i.passed);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card rounded-xl shadow-sm border border-border p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            result.allPassed ? 'bg-success/10' : 'bg-destructive/10'
          }`}>
            {result.allPassed ? (
              <CheckCircle2 className="w-8 h-8 text-success" />
            ) : (
              <XCircle className="w-8 h-8 text-destructive" />
            )}
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {result.allPassed ? '自检通过' : '启动检测发现问题'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {result.allPassed
              ? '所有检查项通过，正在进入应用...'
              : `发现 ${failedItems.length} 项异常，请根据以下提示处理`}
          </p>
        </div>

        <div className="space-y-2 mb-6">
          {result.items.map((item) => (
            <div
              key={item.name}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                item.passed
                  ? 'border-success/30 bg-success/5'
                  : 'border-destructive/30 bg-destructive/5'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.passed ? (
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className={`text-xs ${item.passed ? 'text-success' : 'text-destructive'}`}>
                    {item.message}
                  </p>
                </div>
              </div>
              {item.duration !== undefined && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {item.duration}ms
                </span>
              )}
            </div>
          ))}
        </div>

        {!result.allPassed && (
          <div className="flex flex-col gap-2">
            <Button onClick={handleRetry} className="w-full">
              重新检测
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleContinue} className="flex-1">
                继续进入
              </Button>
              {onSafeMode && (
                <Button variant="outline" onClick={onSafeMode} className="flex-1">
                  <Shield className="w-4 h-4 mr-2" />
                  安全模式
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelfCheckPage;
