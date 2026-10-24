import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, tokenStore, type User } from './api';

type AuthResponse = { token: string; user: User };

type SessionValue = {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionValue['status']>('loading');
  const [user, setUser] = useState<User | null>(null);

  const signOut = useCallback(async () => {
    await tokenStore.clear();
    setUser(null);
    setStatus('signed-out');
  }, []);

  // Al abrir la app: si hay token guardado, se valida con /me.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
    });
    (async () => {
      const token = await tokenStore.get();
      if (!token) {
        setStatus('signed-out');
        return;
      }
      try {
        const me = await api<{ user: User }>('/me');
        setUser(me.user);
        setStatus('signed-in');
      } catch {
        // Sin red: se deja entrar con el token guardado; las pantallas mostraran el error.
        setStatus('signed-in');
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const finish = useCallback(async (result: AuthResponse) => {
    await tokenStore.set(result.token);
    setUser(result.user);
    setStatus('signed-in');
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      finish(await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }));
    },
    [finish],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      finish(await api<AuthResponse>('/auth/register', { method: 'POST', body: { email, password, displayName } }));
    },
    [finish],
  );

  const value = useMemo(() => ({ status, user, signIn, signUp, signOut }), [status, user, signIn, signUp, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de SessionProvider');
  return value;
}
