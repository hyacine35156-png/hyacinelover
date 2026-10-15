import { useState, type FormEvent, useMemo } from 'react';
import { BookOpen, Check } from 'lucide-react';
import { toast } from 'sonner';
import { extractErrorMessage } from '@client/src/utils/error';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Link, useNavigate } from '@client/src/utils/router';
import { checkPasswordStrength } from '@client/src/utils/password-strength';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import { Label } from '@client/src/components/ui/label';
import { Spinner } from '@client/src/components/ui/spinner';
import { useAuth } from '@client/src/contexts/AuthContext';

interface FormErrors {
  username?: string;
  password?: string;
  confirmPassword?: string;
  agreeTerms?: string;
}

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const passwordStrength = useMemo(
    () => checkPasswordStrength(password),
    [password],
  );

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!username.trim()) {
      nextErrors.username = '请输入用户名';
    } else if (username.trim().length < 3) {
      nextErrors.username = '用户名至少 3 个字符';
    }

    if (!password) {
      nextErrors.password = '请输入密码';
    } else if (password.length < 6) {
      nextErrors.password = '密码至少 6 位';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = '请再次输入密码';
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = '两次输入的密码不一致';
    }

    if (!agreeTerms) {
      nextErrors.agreeTerms = '请阅读并同意用户协议和隐私说明';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    try {
      await register(username.trim(), password);
      toast.success('注册成功');
      navigate('/banks', { replace: true });
    } catch (error) {
      logger.error('注册失败', error);
      toast.error(extractErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* 装饰光晕 */}
      <div className="pointer-events-none absolute top-[-10%] right-[-5%] h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] left-[-5%] h-[500px] w-[500px] rounded-full bg-[hsl(290_75%_65%)/20] blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/40 blur-[100px]" />

      <Card className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-xl border border-border/60 shadow-lg transition-all duration-300 hover:shadow-xl">
        {/* 顶部装饰条 */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-[hsl(290_75%_65%)] to-primary" />
        <CardHeader className="text-center pt-8 pb-6">
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] text-primary-foreground shadow-lg">
                <BookOpen className="h-7 w-7" />
              </div>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            创建账号
          </CardTitle>
          <CardDescription className="text-muted-foreground">
             注册账号，开启高效练习之旅
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                用户名
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setUsername(e.target.value);
                  if (errors.username) {
                    setErrors((prev) => ({ ...prev, username: undefined }));
                  }
                }}
                placeholder="请输入用户名"
                autoComplete="username"
                disabled={isLoading}
                className="h-11 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_4px_hsl(265_85%_65%_/_0.1)]"
              />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                密码
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setPassword(e.target.value);
                  if (errors.password) {
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                placeholder="至少 6 位"
                autoComplete="new-password"
                disabled={isLoading}
                className="h-11 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_4px_hsl(265_85%_65%_/_0.1)]"
              />
              {/* 密码强度指示器 */}
              {password && (
                <div className="mt-1 space-y-1.5">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((index) => {
                      const filled = index < passwordStrength.score;
                      let barColor = 'bg-muted';
                      if (filled) {
                        if (passwordStrength.level === 'weak')
                          barColor = 'bg-destructive';
                        else if (passwordStrength.level === 'medium')
                          barColor = 'bg-warning';
                        else barColor = 'bg-success';
                      }
                      return (
                        <div
                          key={index}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${barColor}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className={`font-medium ${
                        passwordStrength.level === 'weak'
                          ? 'text-destructive'
                          : passwordStrength.level === 'medium'
                            ? 'text-warning'
                            : 'text-success'
                      }`}
                    >
                      密码强度：{passwordStrength.label}
                    </span>
                    {passwordStrength.level === 'weak' && password.length >= 6 && (
                      <span className="text-muted-foreground">
                        建议设置更强的密码（至少8位，包含大小写字母、数字）
                      </span>
                    )}
                  </div>
                </div>
              )}
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                确认密码
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) {
                    setErrors((prev) => ({
                      ...prev,
                      confirmPassword: undefined,
                    }));
                  }
                }}
                placeholder="请再次输入密码"
                autoComplete="new-password"
                disabled={isLoading}
                className="h-11 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_4px_hsl(265_85%_65%_/_0.1)]"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setAgreeTerms((prev) => !prev);
                  if (errors.agreeTerms) {
                    setErrors((prev) => ({ ...prev, agreeTerms: undefined }));
                  }
                }}
                className="flex items-start gap-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <div
                  className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-all duration-200 ${
                    agreeTerms
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background'
                  } ${errors.agreeTerms ? 'border-destructive' : ''}`}
                >
                  {agreeTerms && <Check className="h-3 w-3" />}
                </div>
                <span>
                  我已阅读并同意
                  <Link
                    to="/user-agreement"
                    className="mx-1 text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    用户协议
                  </Link>
                  和
                  <Link
                    to="/privacy-policy"
                    className="mx-1 text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    隐私说明
                  </Link>
                </span>
              </button>
              {errors.agreeTerms && (
                <p className="text-xs text-destructive">
                  {errors.agreeTerms}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="mt-2 h-11 w-full font-medium bg-gradient-to-r from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] text-white shadow-[0_4px_20px_hsl(265_85%_65%_/_0.3)] transition-all duration-200 hover:translate-y-[-1px] hover:shadow-[0_6px_28px_hsl(265_85%_65%_/_0.4)] active:translate-y-0"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Spinner />
                  注册中...
                </>
              ) : (
                '注册'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            已有账号？
            <Link
              to="/login"
              className="ml-1 font-medium text-primary hover:underline hover:text-primary/80 transition-colors"
            >
              去登录
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-muted-foreground/70">
            仅用于学习交流，禁止用于正式考试
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPage;
