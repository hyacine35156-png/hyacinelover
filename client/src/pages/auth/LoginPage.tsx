import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Link, useNavigate } from '@client/src/utils/router';

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
import { APP_VERSION } from '@client/src/utils/version';
import { extractErrorMessage } from '@client/src/utils/error';
import { Image } from '@client/src/components/ui/image';
import Logo from '@client/src/components/ui/logo';
import { ChevronDown, ChevronUp, Megaphone } from 'lucide-react';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginAsGuest } = useAuth();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>(
    {},
  );

  const rawFrom = 
    (location.state as { from?: string } | null)?.from || '/banks';
  const from = rawFrom.startsWith('/app/')
    ? rawFrom.replace(/^\/app\/[^/]+/, '') || '/banks'
    : rawFrom;

  const validate = (): boolean => {
    const nextErrors: { username?: string; password?: string } = {};

    if (!username.trim()) {
      nextErrors.username = '请输入用户名或UID';
    }
    if (!password) {
      nextErrors.password = '请输入密码';
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
      await login(username.trim(), password);
      toast.success('登录成功');
      navigate(from, { replace: true });
    } catch (error) {
      logger.error('登录失败', error);
      toast.error(extractErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const [showAnnouncement, setShowAnnouncement] = useState(false);

  const handleToggleAnnouncement = (): void => {
    setShowAnnouncement((prev) => !prev);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* 点阵背景（最下层） */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, hsl(265 85% 65% / 0.15) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* 装饰光晕 */}
      <div className="pointer-events-none absolute top-[-10%] left-[-5%] h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-5%] h-[500px] w-[500px] rounded-full bg-[hsl(290_75%_65%)/20] blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/40 blur-[100px]" />

      <Card className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-xl border border-border/60 shadow-lg transition-all duration-300 hover:shadow-xl">
        {/* 顶部装饰条 */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-[hsl(290_75%_65%)] to-primary" />
        <CardHeader className="pb-6 text-center pt-8">
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl" />
              <Logo
                className="relative h-16 w-16 rounded-2xl shadow-lg ring-4 ring-primary/20"
              />
              <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-success ring-2 ring-card" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            欢迎回来
          </CardTitle>
          <CardDescription className="text-muted-foreground">
             登录你的账号，继续练习之旅
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                用户名 / UID
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
                placeholder="请输入用户名或UID"
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
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={isLoading}
                className="h-11 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_4px_hsl(265_85%_65%_/_0.1)]"
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
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
                   登录中...
                 </>
               ) : (
                 '登录'
               )}
             </Button>
           </form>

           <div className="mt-6 flex items-center gap-3">
             <div className="h-px flex-1 bg-border/70" />
             <span className="text-xs text-muted-foreground">或</span>
             <div className="h-px flex-1 bg-border/70" />
           </div>

           <Button
             type="button"
             variant="outline"
             size="lg"
             className="mt-4 h-11 w-full font-medium"
             onClick={() => {
               loginAsGuest();
               toast.success('已进入游客模式');
               navigate(from, { replace: true });
             }}
           >
             游客体验
           </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
             还没有账号？
             <Link
               to="/register"
               className="ml-1 font-medium text-primary hover:underline hover:text-primary/80 transition-colors"
             >
               去注册
             </Link>
           </p>

           <p className="mt-4 text-center text-xs text-muted-foreground/70">
             登录即代表您已阅读并同意
             <Link
               to="/user-agreement"
               className="mx-1 text-primary hover:underline"
             >
               用户协议
             </Link>
             和
             <Link
               to="/privacy-policy"
               className="mx-1 text-primary hover:underline"
             >
               隐私说明
             </Link>
           </p>

             <p className="mt-2 text-center text-xs text-muted-foreground/70">
               {APP_VERSION}
             </p>

            <div className="mt-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.06] to-pink-400/[0.04] overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={handleToggleAnnouncement}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-all duration-200 hover:from-primary/[0.1] hover:to-pink-400/[0.07]"
                aria-expanded={showAnnouncement}
                aria-controls="login-announcement"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15">
                    <Megaphone className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">公告</span>
                  <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                    1 条
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="hidden sm:inline">{showAnnouncement ? '收起' : '展开'}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-300 ${
                      showAnnouncement ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </div>
              </button>
              <div
                id="login-announcement"
                className={`grid transition-all duration-300 ease-out ${
                  showAnnouncement
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-primary/10 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                    目前反馈功能暂时不可用，如有疑问请联系
                    <UniversalLink
                      to="mailto:1691917356@qq.com"
                      className="ml-1 font-medium text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      作者
                    </UniversalLink>
                  </div>
                </div>
              </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
