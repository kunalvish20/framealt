'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { Film } from 'lucide-react';
import { isConfigured } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import { WorkspaceSkeleton } from '@/components/ui/LoadingState';

export function AuthGate({ children }: { children: (user: User) => React.ReactNode }) {
  const { session, loading, error, retry } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (isConfigured() && !loading && !session && !error) router.replace('/login');
  }, [loading, session, error, router]);

  if (!isConfigured()) return <div className="setup-page"><Film size={48}/><h1>Connect your services</h1><p>Configure your Supabase credentials in <code>.env.local</code>, run the migrations in the README, then restart the server. R2 is optional for Google Drive-only workflows.</p><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="btn btn-primary">Open Supabase</a></div>;
  if (error) return <div className="setup-page"><h1>Connection interrupted</h1><p role="alert">{error}</p><button className="btn btn-primary" onClick={retry}>Try again</button></div>;
  if (loading || !session) return <WorkspaceSkeleton/>;
  return <>{children(session.user)}</>;
}
