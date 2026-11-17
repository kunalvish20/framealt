'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isConfigured, supabaseBrowser } from '@/lib/supabase-browser';
import { clearClientCaches } from '@/lib/client-cache.mjs';

type AuthState = { session: Session | null; loading: boolean; error: string; retry: () => void };
const AuthContext = createContext<AuthState | null>(null);
let validation: { token: string; request: ReturnType<ReturnType<typeof supabaseBrowser>['auth']['getUser']> } | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const current = useRef<Session | null>(null);

  useEffect(() => {
    if (!isConfigured()) { setLoading(false); return; }
    let active = true;
    const sb = supabaseBrowser();
    const apply = (next: Session | null) => {
      if (!active) return;
      if (current.current?.user.id !== next?.user.id) clearClientCaches();
      current.current = next;
      setSession(next);
      setLoading(false);
      setError('');
    };
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, next) => apply(next));
    // One root-level discovery. Route gates never repeat this work.
    void sb.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) throw sessionError;
      // A newer auth event must not be overwritten by an older discovery response.
      if (!current.current || current.current.access_token === data.session?.access_token) apply(data.session);
      const token = data.session?.access_token;
      if (!token) return;
      // Presentation can use the persisted session immediately. Privileged APIs still
      // verify getUser(jwt) per request and database reads still enforce RLS.
      if (validation?.token !== token) validation = { token, request: sb.auth.getUser(token) };
      return validation.request.then(({ error: validationError }) => {
        if (!active || current.current?.access_token !== token) return;
        if (validationError && (validationError.status === 401 || validationError.status === 403)) {
          apply(null);
          clearClientCaches();
          void sb.auth.signOut({ scope: 'local' });
        }
      });
    }).catch(() => {
      if (active && !current.current) { setLoading(false); setError('Unable to check your session. Check your connection and try again.'); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [attempt]);

  return <AuthContext.Provider value={{ session, loading, error, retry: () => setAttempt(value => value + 1) }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
