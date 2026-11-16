'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let cached: SupabaseClient | null = null;
export function isConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://') && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('YOUR-PROJECT'));
}
export function supabaseBrowser(): SupabaseClient {
  if (!isConfigured()) throw new Error('Supabase is not configured. Follow README.md and fill .env.local.');
  if (!cached) cached = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
  return cached;
}
export async function bearerHeaders(): Promise<Record<string,string>> {
  const { data: { session } } = await supabaseBrowser().auth.getSession();
  if (!session?.access_token) throw new Error('Your session has expired. Please sign in.');
  return { Authorization: `Bearer ${session.access_token}` };
}
export async function authFetch(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(await bearerHeaders()), ...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}
