import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  savedAccountsStorage,
  tokenStorage,
} from '@client/src/api/auth';
import type { AppUserItem } from '@shared/api.interface';
import type { SavedAccount } from '@client/src/api/auth';
import { safeSetItem, safeRemoveItem, safeGetItem } from '@client/src/utils/env';
import { clearCache } from '@client/src/utils/request-cache';

const GUEST_FLAG_KEY = 'app_guest_mode';

interface AuthContextValue {
  user: AppUserItem | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  isRealUser: boolean;
  login: (username: string, password: string) => Promise<AppUserItem>;
  register: (username: string, password: string) => Promise<AppUserItem>;
  logout: () => Promise<void>;
  clearAuth: () => void;
  loginAsGuest: () => void;
  switchAccount: (username: string) => Promise<void>;
  removeSavedAccount: (username: string) => void;
  getSavedAccounts: () => SavedAccount[];
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<AppUserItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  // 初始化时从 localStorage 读 token，调用 getMe 获取用户信息
  useEffect(() => {
    const initAuth = async (): Promise<void> => {
      const token = tokenStorage.getToken();
      logger.info('[Auth] 初始化认证状态', {
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 8) : '',
        location: typeof window !== 'undefined' ? window.location.pathname : '',
      });
      if (!token) {
        const guestFlag = safeGetItem(GUEST_FLAG_KEY);
        if (guestFlag === '1') {
          setIsGuest(true);
          setUser({
            id: 'guest',
            username: '游客',
            uid: null,
            createdAt: new Date().toISOString(),
          });
        }
        setIsLoading(false);
        return;
      }

      try {
        const me = await getMe();
        logger.info('[Auth] 初始化成功，已登录', { username: me.username });
        setUser(me);
        setIsGuest(false);
        safeRemoveItem(GUEST_FLAG_KEY);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error('[Auth] 初始化认证失败，清除 token', { error: errMsg });
        tokenStorage.clearToken();
        setUser(null);
        setIsGuest(false);
        safeRemoveItem(GUEST_FLAG_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    void initAuth();
  }, []);

  const login = async (
    username: string,
    password: string,
  ): Promise<AppUserItem> => {
    logger.info('[Auth] 开始登录', { username });
    const response = await apiLogin({ username, password });
    logger.info('[Auth] 登录接口返回成功，准备保存 token', {
      tokenLength: response.token.length,
      username: response.user.username,
    });
    tokenStorage.setToken(response.token);
    savedAccountsStorage.saveAccount({
      username: response.user.username,
      token: response.token,
    });
    setUser(response.user);
    setIsGuest(false);
    safeRemoveItem(GUEST_FLAG_KEY);
    logger.info('[Auth] 登录全部流程完成，即将跳转', {
      username: response.user.username,
      tokenLength: response.token.length,
    });
    return response.user;
  };

  const register = async (
    username: string,
    password: string,
  ): Promise<AppUserItem> => {
    const response = await apiRegister({ username, password });
    tokenStorage.setToken(response.token);
    savedAccountsStorage.saveAccount({
      username: response.user.username,
      token: response.token,
    });
    setUser(response.user);
    setIsGuest(false);
    safeRemoveItem(GUEST_FLAG_KEY);
    return response.user;
  };

  const logout = async (): Promise<void> => {
    if (isGuest) {
      logger.info('[Auth] 游客模式退出');
      setUser(null);
      setIsGuest(false);
      return;
    }
    try {
      await apiLogout();
    } catch (error) {
      logger.error('调用退出登录接口失败', error);
    }
    tokenStorage.clearToken();
    clearCache();
    setUser(null);
  };

  const clearAuth = (): void => {
    logger.info('[Auth] 手动清除登录状态');
    tokenStorage.clearToken();
    clearCache();
    safeRemoveItem(GUEST_FLAG_KEY);
    setUser(null);
    setIsGuest(false);
  };

  const loginAsGuest = (): void => {
    logger.info('[Auth] 游客登录');
    safeSetItem(GUEST_FLAG_KEY, '1');
    setIsGuest(true);
    setUser({
      id: 'guest',
      username: '游客',
      uid: null,
      createdAt: new Date().toISOString(),
    });
  };

  const switchAccount = async (username: string): Promise<void> => {
    const accounts = savedAccountsStorage.getSavedAccounts();
    const target = accounts.find(
      (a: SavedAccount): boolean => a.username === username,
    );
    if (!target) {
      throw new Error('账号未在已保存列表中');
    }
    tokenStorage.setToken(target.token);
    try {
      const me = await getMe();
      setUser(me);
      setIsGuest(false);
      safeRemoveItem(GUEST_FLAG_KEY);
    } catch (error) {
      logger.error('切换账号失败，token 失效', error);
      tokenStorage.clearToken();
      savedAccountsStorage.removeSavedAccount(username);
      setUser(null);
      setIsGuest(false);
      safeRemoveItem(GUEST_FLAG_KEY);
      throw error;
    }
  };

  const removeSavedAccount = (username: string): void => {
    savedAccountsStorage.removeSavedAccount(username);
  };

  const getSavedAccounts = (): SavedAccount[] => {
    return savedAccountsStorage.getSavedAccounts();
  };

  const isRealUser = !!user && !isGuest;

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isGuest,
    isRealUser,
    login,
    register,
    logout,
    clearAuth,
    loginAsGuest,
    switchAccount,
    removeSavedAccount,
    getSavedAccounts,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthProvider, useAuth };
