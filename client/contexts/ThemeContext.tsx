import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { safeSetItem, safeGetItem } from '@client/src/utils/env';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'hyacine_theme';
const DEFAULT_THEME: Theme = 'light';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return getSystemTheme();
  return theme;
}

function applyThemeToDom(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

interface ThemeProviderProps {
  children: ReactNode;
}

const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = safeGetItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return DEFAULT_THEME;
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveTheme(
      (safeGetItem(STORAGE_KEY) as Theme) || DEFAULT_THEME,
    ),
  );

  // Apply theme whenever it changes
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyThemeToDom(resolved);
    safeSetItem(STORAGE_KEY, theme);
  }, [theme]);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent): void => {
      const resolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyThemeToDom(resolved);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // 监听设置同步事件：从后端拉取到新设置时自动应用
  useEffect(() => {
    const handleSynced = (event: Event): void => {
      const detail = (event as CustomEvent<{ theme?: Theme }>).detail;
      if (detail?.theme && detail.theme !== theme) {
        setThemeState(detail.theme);
      }
    };
    window.addEventListener('settings:synced', handleSynced);
    return () => window.removeEventListener('settings:synced', handleSynced);
  }, [theme]);

  const setTheme = (nextTheme: Theme): void => {
    setThemeState(nextTheme);
    // 触发设置变更事件，由 useSettingsSync 监听并异步推送到后端
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('settings:changed', {
        detail: { theme: nextTheme },
      }));
    }
  };

  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export { ThemeProvider, useTheme };
