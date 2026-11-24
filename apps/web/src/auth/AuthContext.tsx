import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, api } from '../api/client';
import type { Me } from '../api/types';

interface AuthState {
  readonly me: Me | null;
  readonly loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(input: {
    organizationName: string;
    name: string;
    email: string;
    password: string;
    timezone: string;
  }): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe((await api.get<Me>('/api/v1/auth/me')).data);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) console.error(error);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      me,
      loading,
      async login(email, password) {
        await api.post('/api/v1/auth/login', { email, password });
        await refresh();
      },
      async register(input) {
        await api.post('/api/v1/auth/register', input);
        await refresh();
      },
      async logout() {
        await api.post('/api/v1/auth/logout');
        setMe(null);
      },
    }),
    [me, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
