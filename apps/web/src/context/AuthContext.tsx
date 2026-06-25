import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, configureApiAuth } from '../api/client';
import type { UserProfile } from '../api/types';
import { apiRequest } from '../api/client';
import { isAccessTokenExpired } from '../utils/jwt';

const ACCESS_KEY = 'tr_access_token';
const REFRESH_KEY = 'tr_refresh_token';
const SESSION_REFRESH_INTERVAL_MS = 10 * 60_000;
const SESSION_REFRESH_SKEW_MS = 5 * 60_000;

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, nickname: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  accessToken: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(
    () => localStorage.getItem(ACCESS_KEY),
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(
    () => localStorage.getItem(REFRESH_KEY),
  );
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const persistTokens = useCallback((access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    setAccessToken(access);
    setRefreshToken(refresh);
  }, []);

  const logout = useCallback(async () => {
    const storedRefresh = refreshToken || localStorage.getItem(REFRESH_KEY);
    if (storedRefresh) {
      try {
        await authApi.logout(storedRefresh);
      } catch {
        // Local logout still proceeds if server is unreachable.
      }
    }
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, [refreshToken]);

  const refreshAccessToken = useCallback(async () => {
    const storedRefresh = refreshToken || localStorage.getItem(REFRESH_KEY);
    if (!storedRefresh) {
      await logout();
      return null;
    }

    try {
      const data = await authApi.refresh(storedRefresh);
      localStorage.setItem(ACCESS_KEY, data.accessToken);
      setAccessToken(data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem(REFRESH_KEY, data.refreshToken);
        setRefreshToken(data.refreshToken);
      }
      return data.accessToken;
    } catch {
      await logout();
      return null;
    }
  }, [logout, refreshToken]);

  const ensureValidAccessToken = useCallback(async () => {
    const storedAccess = accessToken || localStorage.getItem(ACCESS_KEY);
    if (storedAccess && !isAccessTokenExpired(storedAccess, SESSION_REFRESH_SKEW_MS)) {
      return storedAccess;
    }
    return refreshAccessToken();
  }, [accessToken, refreshAccessToken]);

  const refreshProfile = useCallback(async () => {
    const token = await ensureValidAccessToken();
    if (!token) {
      setUser(null);
      return null;
    }

    const profile = await apiRequest<UserProfile>('/users/me');
    setUser(profile);
    return profile;
  }, [ensureValidAccessToken]);

  useEffect(() => {
    configureApiAuth(
      () => accessToken || localStorage.getItem(ACCESS_KEY),
      refreshAccessToken,
    );
  }, [accessToken, refreshAccessToken]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const storedAccess = localStorage.getItem(ACCESS_KEY);
      const storedRefresh = localStorage.getItem(REFRESH_KEY);

      if (!storedAccess && !storedRefresh) {
        setLoading(false);
        return;
      }

      try {
        const token = await ensureValidAccessToken();
        if (!token || cancelled) {
          return;
        }

        const profile = await apiRequest<UserProfile>('/users/me');
        if (!cancelled) {
          setUser(profile);
        }
      } catch {
        if (!cancelled) {
          await logout();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [ensureValidAccessToken, logout]);

  useEffect(() => {
    const storedRefresh = refreshToken || localStorage.getItem(REFRESH_KEY);
    if (!storedRefresh) {
      return;
    }

    const refreshSessionIfNeeded = () => {
      const storedAccess = localStorage.getItem(ACCESS_KEY);
      if (isAccessTokenExpired(storedAccess, SESSION_REFRESH_SKEW_MS)) {
        void refreshAccessToken();
      }
    };

    refreshSessionIfNeeded();
    const intervalId = window.setInterval(refreshSessionIfNeeded, SESSION_REFRESH_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSessionIfNeeded();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshToken, refreshAccessToken]);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.login(email, password);
    persistTokens(tokens.accessToken, tokens.refreshToken);
    const profile = await apiRequest<UserProfile>('/users/me', {}, true);
    setUser(profile);
  }, [persistTokens]);

  const register = useCallback(async (email: string, nickname: string, password: string) => {
    const tokens = await authApi.register(email, nickname, password);
    persistTokens(tokens.accessToken, tokens.refreshToken);
    const profile = await apiRequest<UserProfile>('/users/me', {}, true);
    setUser(profile);
  }, [persistTokens]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshProfile,
      accessToken,
    }),
    [user, loading, login, register, logout, refreshProfile, accessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
