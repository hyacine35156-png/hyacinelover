import { useState, useCallback, useRef, useEffect, useMemo } from "react";
 import { Outlet, useLocation } from "react-router-dom";
import {
   BookOpen,
   Star,
   BookX,
   BarChart3,
   Tag,
   Sparkles,
   Lock,
   Search,
   X,
 } from "lucide-react";
import { logger } from '@lark-apaas/client-toolkit/logger';
import UserMenu from './UserMenu';
import { Link, NavLink, useNavigate } from '@client/src/utils/router';
import Logo from '@client/src/components/ui/logo';
import { Button } from '@client/src/components/ui/button';
import { useAuth } from '@client/src/contexts/AuthContext';
import OfflineBanner from '@client/src/components/OfflineBanner';
import { useWallpaper } from '@client/src/contexts/WallpaperContext';

const GUEST_RESTRICTED_PATHS = [
  "/subjects",
  "/favorites",
  "/wrongbook",
  "/tags",
  "/stats",
];

const SITE_NAME = "Hyacine";

const navItems = [
  { path: "/banks", label: "我的题集", guestVisible: true },
  { path: "/temporary", label: "临时题集", guestVisible: false },
  { path: "/subjects", label: "科目", guestVisible: false },
  { path: "/favorites", label: "收藏", guestVisible: false },
  { path: "/wrongbook", label: "错题本", guestVisible: false },
  { path: "/tags", label: "标签", guestVisible: false },
  { path: "/stats", label: "数据统计", guestVisible: false },
];

const mobileTabItems = [
  { path: "/banks", label: "我的题集", icon: BookOpen, guestVisible: true },
  { path: "/favorites", label: "收藏", icon: Star, guestVisible: false },
  { path: "/wrongbook", label: "错题本", icon: BookX, guestVisible: false },
  { path: "/tags", label: "标签", icon: Tag, guestVisible: false },
  { path: "/stats", label: "数据统计", icon: BarChart3, guestVisible: false },
];

 const Layout = () => {
   const { pathname } = useLocation();
   const navigate = useNavigate();
   const { isGuest } = useAuth();
   const { wallpaperType, wallpaperUrl, showInPractice } = useWallpaper();
   const isPracticePage = pathname.startsWith('/practice');
   const [searchValue, setSearchValue] = useState('');

  const showWallpaper = wallpaperType !== 'none' && wallpaperUrl && (!isPracticePage || showInPractice);

  const isGuestRestricted = useMemo(() => {
    if (!isGuest) return false;
    return GUEST_RESTRICTED_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
  }, [isGuest, pathname]);

  useEffect(() => {
    document.title = SITE_NAME;
  }, []);

  if (isPracticePage) {
    return (
      <div className={`relative min-h-screen ${showWallpaper ? 'bg-transparent' : 'bg-background'}`}>
        {showWallpaper && <div className="wallpaper-layer" aria-hidden="true" />}
        <OfflineBanner />
         <Outlet />
       </div>
    );
  }

  return (
    <div className={`relative min-h-screen ${showWallpaper ? 'bg-transparent' : 'bg-background'}`}>
      {showWallpaper && <div className="wallpaper-layer" aria-hidden="true" />}
      <OfflineBanner />
      {/* 顶部主光晕 */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[360px] overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(265 85% 70% / 0.35) 0%, hsl(290 75% 70% / 0.2) 40%, transparent 70%)',
          }}
        />
      </div>

      {/* 微妙几何装饰 - 左上角弧形 */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 -z-10 h-[400px] w-[400px] opacity-[0.12]"
      >
        <svg viewBox="0 0 400 400" className="h-full w-full" fill="none">
          <path
            d="M0 200 Q100 100 200 100 Q300 100 350 200"
            stroke="hsl(265 85% 65%)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M0 260 Q120 160 240 160 Q340 160 380 260"
            stroke="hsl(290 75% 65%)"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.6"
          />
          <circle cx="80" cy="80" r="3" fill="hsl(265 85% 65%)" />
          <circle cx="160" cy="50" r="2" fill="hsl(290 75% 65%)" />
          <circle cx="320" cy="120" r="2.5" fill="hsl(265 85% 65%)" />
        </svg>
      </div>

      {/* 微妙几何装饰 - 右下角点阵图案 */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 right-0 -z-10 h-[300px] w-[300px] opacity-[0.08]"
      >
        <svg viewBox="0 0 300 300" className="h-full w-full" fill="none">
          <defs>
            <pattern id="dotGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="hsl(265 85% 65%)" />
            </pattern>
          </defs>
          <circle cx="200" cy="200" r="120" fill="url(#dotGrid)" />
          <path
            d="M100 250 Q180 220 250 180"
            stroke="hsl(290 75% 65%)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <header className="sticky top-0 z-40 border-b border-border bg-white rounded-b-2xl shadow-[0_4px_20px_-4px_hsl(260_30%_20%/0.08)]">
        <div className="mx-auto flex h-14 items-center gap-4 px-4 sm:px-6 md:h-16 md:max-w-6xl">
          {/* Left: Logo + site name (desktop) / Centered on mobile */}
          <Link
            to="/banks"
            className="group flex items-center gap-2.5 transition-transform duration-200 active:scale-[0.97] md:mr-2"
            title={SITE_NAME}
          >
            <div className="relative">
              <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-br from-[hsl(265_85%_65%_/_0.35)] to-[hsl(290_75%_65%_/_0.35)] opacity-70 blur transition-opacity duration-300 group-hover:opacity-100" />
              <Logo
                className="relative h-9 w-9 rounded-xl ring-2 ring-white/80 shadow-sm"
              />
              <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-white shadow-sm" />
            </div>
            <span className="text-base font-bold tracking-tight gradient-primary-text md:text-[15px]">
              {SITE_NAME}
            </span>
          </Link>

          {/* Desktop nav tabs (horizontally scrollable on narrower md screens) */}
          <nav className="relative hidden flex-1 items-center justify-center md:flex">
             <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-white/0 to-transparent" />
             <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-white/0 to-transparent" />
              <div className="flex w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-muted p-1 ring-1 ring-border/50 scrollbar-hide">
              {navItems
                .filter((item) => !isGuest || item.guestVisible)
                .map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end
                  className={({ isActive }) =>
                    `relative shrink-0 flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all duration-300 ease-out ${
                      isActive
                        ? "bg-white text-primary shadow-sm ring-1 ring-border/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span>{item.label}</span>
                      {isActive && (
                        <span
                          className="absolute -bottom-px left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full"
                          style={{
                            background: 'linear-gradient(90deg, hsl(265 85% 65%), hsl(290 75% 65%))',
                          }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
           </nav>

           {/* Desktop search box */}
           <div className="relative hidden md:block md:w-56 lg:w-64">
             <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
             <input
               type="text"
               value={searchValue}
               onChange={(e) => setSearchValue(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === 'Enter' && searchValue.trim()) {
                   navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
                 }
               }}
               placeholder="搜索题目..."
                className="h-9 w-full rounded-lg border border-border bg-white pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25 hover:border-border"
             />
             {searchValue && (
               <button
                 type="button"
                 onClick={() => setSearchValue('')}
                 className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                 aria-label="清空搜索"
               >
                 <X className="h-3 w-3" />
               </button>
             )}
           </div>

           <div className="flex-1 md:hidden" />

          {/* Right: UserMenu + version */}
          <div className="flex items-center gap-2">
             {isGuest ? (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 transition-all duration-200 hover:bg-amber-200"
                title="点击登录以同步数据"
              >
                <Sparkles className="h-3.5 w-3.5" />
                游客模式
              </button>
            ) : (
              <UserMenu />
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-20 sm:px-6 md:py-8 md:pb-8">
        <div className="min-h-[calc(100vh-8rem)]">
        {isGuestRestricted ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-border/60 bg-card p-8 text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-foreground">请登录后使用此功能</h3>
                <p className="text-sm text-muted-foreground">
                  登录后即可使用收藏、错题本、标签、作答记录等功能
                </p>
              </div>
              <Button
                onClick={() => navigate('/login')}
                className="mt-2 w-full"
              >
                去登录
              </Button>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
        </div>
      </main>

      {/* Mobile bottom TabBar */}
       <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around items-center h-14 px-2 border-t border-border bg-white rounded-t-2xl shadow-[0_-4px_20px_-4px_hsl(260_30%_20%/0.08)] md:hidden">
        {mobileTabItems
          .filter((item) => !isGuest || item.guestVisible)
          .map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors duration-200 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px]">{item.label}</span>
          </NavLink>
        ))}
       </nav>
     </div>
  );
};

export default Layout;
