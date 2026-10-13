import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { safeSetItem, safeGetItem } from '@client/src/utils/env';
import { isImageDark } from '@client/src/utils/image-brightness';

export type WallpaperType = 'none' | 'custom';
export type WallpaperSize = 'cover' | 'contain' | 'stretch';
export type TextColorMode = 'auto' | 'dark' | 'light';

export interface UserWallpaperItem {
  id: string;
  url: string;
  name: string;
}

const STORAGE_KEY_TYPE = 'hyacine_wallpaper_type';
const STORAGE_KEY_URL = 'hyacine_wallpaper_url';
const STORAGE_KEY_OPACITY = 'hyacine_wallpaper_opacity';
const STORAGE_KEY_SIZE = 'hyacine_wallpaper_size';
const STORAGE_KEY_USER_WALLPAPERS = 'hyacine_user_wallpapers';
const STORAGE_KEY_SHOW_IN_PRACTICE = 'hyacine_wallpaper_show_in_practice';
const STORAGE_KEY_TEXT_COLOR_MODE = 'hyacine_wallpaper_text_color_mode';

const DEFAULT_TYPE: WallpaperType = 'none';
const DEFAULT_OPACITY = 40;
const DEFAULT_SIZE: WallpaperSize = 'cover';

interface WallpaperContextValue {
  wallpaperType: WallpaperType;
  wallpaperUrl: string | null;
  wallpaperOpacity: number;
  wallpaperSize: WallpaperSize;
  userWallpapers: UserWallpaperItem[];
  showInPractice: boolean;
  textColorMode: TextColorMode;
  isDarkWallpaper: boolean;
  setWallpaperType: (type: WallpaperType) => void;
  setWallpaperUrl: (url: string | null) => void;
  setWallpaperOpacity: (opacity: number) => void;
  setWallpaperSize: (size: WallpaperSize) => void;
  setUserWallpapers: (items: UserWallpaperItem[]) => void;
  setShowInPractice: (value: boolean) => void;
  setTextColorMode: (mode: TextColorMode) => void;
  addUserWallpaper: (item: UserWallpaperItem) => void;
  removeUserWallpaper: (id: string) => void;
  clearWallpaper: () => void;
}

const WallpaperContext = createContext<WallpaperContextValue | undefined>(
  undefined,
);

function isValidType(value: string | null): value is WallpaperType {
  return value === 'none' || value === 'custom';
}

function isValidSize(value: string | null): value is WallpaperSize {
  return value === 'cover' || value === 'contain' || value === 'stretch';
}

function getBackgroundSize(size: WallpaperSize): string {
  switch (size) {
    case 'cover': return 'cover';
    case 'contain': return 'contain';
    case 'stretch': return '100% 100%';
  }
}

function applyWallpaperToDom(
  type: WallpaperType,
  url: string | null,
  opacity: number,
  size: WallpaperSize,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (type === 'none' || !url) {
    root.style.removeProperty('--wallpaper-image');
    root.style.removeProperty('--wallpaper-opacity');
    root.style.removeProperty('--wallpaper-size');
    root.setAttribute('data-wallpaper', 'none');
    return;
  }

  root.style.setProperty('--wallpaper-image', `url("${url}")`);
  root.style.setProperty('--wallpaper-opacity', String(opacity / 100));
  root.style.setProperty('--wallpaper-size', getBackgroundSize(size));
  root.setAttribute('data-wallpaper', type);
}

interface WallpaperProviderProps {
  children: ReactNode;
}

const WallpaperProvider = ({ children }: WallpaperProviderProps) => {
  const [wallpaperType, setWallpaperTypeState] = useState<WallpaperType>(() => {
    const stored = safeGetItem(STORAGE_KEY_TYPE);
    if (isValidType(stored)) return stored;
    if (stored === 'default') {
      safeSetItem(STORAGE_KEY_URL, '');
      safeSetItem(STORAGE_KEY_TYPE, 'none');
    }
    return DEFAULT_TYPE;
  });

  const [wallpaperUrl, setWallpaperUrlState] = useState<string | null>(() => {
    const typeStored = safeGetItem(STORAGE_KEY_TYPE);
    if (typeStored === 'default') return null;
    return safeGetItem(STORAGE_KEY_URL) || null;
  });

  const [wallpaperOpacity, setWallpaperOpacityState] = useState<number>(() => {
    const stored = safeGetItem(STORAGE_KEY_OPACITY);
    const num = Number(stored);
    return !Number.isNaN(num) && num >= 0 && num <= 100 ? num : DEFAULT_OPACITY;
  });

  const [wallpaperSize, setWallpaperSizeState] = useState<WallpaperSize>(() => {
    const stored = safeGetItem(STORAGE_KEY_SIZE);
    return isValidSize(stored) ? stored : DEFAULT_SIZE;
  });

  const [userWallpapers, setUserWallpapersState] = useState<UserWallpaperItem[]>(() => {
    const stored = safeGetItem(STORAGE_KEY_USER_WALLPAPERS);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [showInPractice, setShowInPracticeState] = useState<boolean>(() => {
    const stored = safeGetItem(STORAGE_KEY_SHOW_IN_PRACTICE);
    return stored === '1';
  });

  const [textColorMode, setTextColorModeState] = useState<TextColorMode>(() => {
    const stored = safeGetItem(STORAGE_KEY_TEXT_COLOR_MODE);
    if (stored === 'dark' || stored === 'light') return stored;
    return 'auto';
  });

  const [isDarkWallpaper, setIsDarkWallpaper] = useState<boolean>(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    let effectiveDark = isDarkWallpaper;
    if (textColorMode === 'dark') effectiveDark = false;
    if (textColorMode === 'light') effectiveDark = true;
    if (effectiveDark) {
      root.setAttribute('data-wallpaper-mode', 'dark');
    } else {
      root.setAttribute('data-wallpaper-mode', 'light');
    }
  }, [isDarkWallpaper, textColorMode]);

  useEffect(() => {
    if (wallpaperType === 'none' || !wallpaperUrl) {
      setIsDarkWallpaper(false);
      return;
    }
    let cancelled = false;
    isImageDark(wallpaperUrl).then((dark) => {
      if (!cancelled) setIsDarkWallpaper(dark);
    });
    return () => {
      cancelled = true;
    };
  }, [wallpaperType, wallpaperUrl]);

  useEffect(() => {
    applyWallpaperToDom(wallpaperType, wallpaperUrl, wallpaperOpacity, wallpaperSize);
    safeSetItem(STORAGE_KEY_TYPE, wallpaperType);
    if (wallpaperUrl) {
      safeSetItem(STORAGE_KEY_URL, wallpaperUrl);
    } else {
      safeSetItem(STORAGE_KEY_URL, '');
    }
    safeSetItem(STORAGE_KEY_OPACITY, String(wallpaperOpacity));
    safeSetItem(STORAGE_KEY_SIZE, wallpaperSize);
  }, [wallpaperType, wallpaperUrl, wallpaperOpacity, wallpaperSize, showInPractice]);

  useEffect(() => {
    safeSetItem(STORAGE_KEY_USER_WALLPAPERS, JSON.stringify(userWallpapers));
  }, [userWallpapers]);

  useEffect(() => {
    safeSetItem(STORAGE_KEY_SHOW_IN_PRACTICE, showInPractice ? '1' : '0');
  }, [showInPractice]);

  useEffect(() => {
    safeSetItem(STORAGE_KEY_TEXT_COLOR_MODE, textColorMode);
  }, [textColorMode]);

  useEffect(() => {
    const handleSynced = (event: Event): void => {
      const detail = (
        event as CustomEvent<{
          wallpaperType?: WallpaperType;
          wallpaperUrl?: string | null;
          wallpaperOpacity?: number;
           wallpaperSize?: WallpaperSize;
           userWallpapers?: UserWallpaperItem[];
           showInPractice?: boolean;
           textColorMode?: TextColorMode;
         }>
       ).detail;
      if (detail?.wallpaperType !== undefined && detail.wallpaperType !== wallpaperType) {
        setWallpaperTypeState(detail.wallpaperType);
      }
      if (detail?.wallpaperUrl !== undefined && detail.wallpaperUrl !== wallpaperUrl) {
        setWallpaperUrlState(detail.wallpaperUrl ?? null);
      }
      if (detail?.wallpaperOpacity !== undefined
        && detail.wallpaperOpacity !== wallpaperOpacity) {
        setWallpaperOpacityState(detail.wallpaperOpacity);
      }
      if (detail?.wallpaperSize !== undefined && detail.wallpaperSize !== wallpaperSize) {
        setWallpaperSizeState(detail.wallpaperSize);
      }
      if (detail?.userWallpapers !== undefined) {
        setUserWallpapersState(detail.userWallpapers);
      }
      if (detail?.showInPractice !== undefined
        && detail.showInPractice !== showInPractice) {
        setShowInPracticeState(detail.showInPractice);
      }
      if (detail?.textColorMode !== undefined
        && detail.textColorMode !== textColorMode) {
        setTextColorModeState(detail.textColorMode);
      }
    };
    window.addEventListener('settings:synced', handleSynced);
    return () => window.removeEventListener('settings:synced', handleSynced);
  }, [wallpaperType, wallpaperUrl, wallpaperOpacity, wallpaperSize]);

  const dispatchChanged = (patch: Record<string, unknown>): void => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('settings:changed', { detail: patch }));
    }
  };

  const setWallpaperType = (type: WallpaperType): void => {
    setWallpaperTypeState(type);
    dispatchChanged({ wallpaperType: type });
  };

  const setWallpaperUrl = (url: string | null): void => {
    setWallpaperUrlState(url);
    dispatchChanged({ wallpaperUrl: url });
  };

  const setWallpaperOpacity = (opacity: number): void => {
    setWallpaperOpacityState(opacity);
    dispatchChanged({ wallpaperOpacity: opacity });
  };

  const setWallpaperSize = (size: WallpaperSize): void => {
    setWallpaperSizeState(size);
    dispatchChanged({ wallpaperSize: size });
  };

  const setUserWallpapers = (items: UserWallpaperItem[]): void => {
    setUserWallpapersState(items);
    dispatchChanged({ userWallpapers: items });
  };

  const setShowInPractice = (value: boolean): void => {
    setShowInPracticeState(value);
    dispatchChanged({ showInPractice: value });
  };

  const setTextColorMode = (mode: TextColorMode): void => {
    setTextColorModeState(mode);
    dispatchChanged({ textColorMode: mode });
  };

  const addUserWallpaper = (item: UserWallpaperItem): void => {
    const next = [item, ...userWallpapers];
    setUserWallpapersState(next);
    dispatchChanged({ userWallpapers: next });
  };

  const removeUserWallpaper = (id: string): void => {
    const next = userWallpapers.filter((w: UserWallpaperItem) => w.id !== id);
    setUserWallpapersState(next);
    dispatchChanged({ userWallpapers: next });
    if (wallpaperType === 'custom' && wallpaperUrl
      && userWallpapers.find((w: UserWallpaperItem) => w.id === id)?.url === wallpaperUrl) {
      setWallpaperTypeState('none');
      setWallpaperUrlState(null);
      dispatchChanged({ wallpaperType: 'none', wallpaperUrl: null });
    }
  };

  const clearWallpaper = (): void => {
    setWallpaperTypeState('none');
    setWallpaperUrlState(null);
    dispatchChanged({ wallpaperType: 'none', wallpaperUrl: null });
  };

  const value: WallpaperContextValue = {
    wallpaperType,
    wallpaperUrl,
    wallpaperOpacity,
    wallpaperSize,
    userWallpapers,
    showInPractice,
    textColorMode,
    isDarkWallpaper,
    setWallpaperType,
    setWallpaperUrl,
    setWallpaperOpacity,
    setWallpaperSize,
    setUserWallpapers,
    setShowInPractice,
    setTextColorMode,
    addUserWallpaper,
    removeUserWallpaper,
    clearWallpaper,
  };

  return (
    <WallpaperContext.Provider value={value}>
      {children}
    </WallpaperContext.Provider>
  );
};

const useWallpaper = (): WallpaperContextValue => {
  const context = useContext(WallpaperContext);
  if (context === undefined) {
    throw new Error('useWallpaper must be used within a WallpaperProvider');
  }
  return context;
};

export { WallpaperProvider, useWallpaper };
