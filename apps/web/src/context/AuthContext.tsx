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

const ACCESS_KEY = 'tr_access_token';
const REFRESH_KEY = 'tr_refresh_token';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, nickname: string, password: string) => Promise<void>;
  logout: () => void;
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

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const storedRefresh = refreshToken || localStorage.getItem(REFRESH_KEY);
    if (!storedRefresh) {
      logout();
      return null;
    }

    try {
      const data = await authApi.refresh(storedRefresh);
      localStorage.setItem(ACCESS_KEY, data.accessToken);
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      logout();
      return null;
    }
  }, [logout, refreshToken]);

  const refreshProfile = useCallback(async () => {
    if (!accessToken && !localStorage.getItem(ACCESS_KEY)) {
      setUser(null);
      return null;
    }

    try {
      const profile = await apiRequest<UserProfile>('/users/me');
      setUser(profile);
      return profile;
    } catch {
      logout();
      return null;
    }
  }, [accessToken, logout]);

  useEffect(() => {
    configureApiAuth(
      () => accessToken || localStorage.getItem(ACCESS_KEY),
      refreshAccessToken,
    );
  }, [accessToken, refreshAccessToken]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        const profile = await apiRequest<UserProfile>('/users/me');
        if (!cancelled) {
          setUser(profile);
        }
      } catch {
        if (!cancelled) {
          logout();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [accessToken, logout]);

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
