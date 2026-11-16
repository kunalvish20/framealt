'use client';
import { useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { isConfigured,supabaseBrowser } from '@/lib/supabase-browser';
import { Film } from 'lucide-react';
export function AuthGate({children}:{children:(user:User)=>React.ReactNode}){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true);const router=useRouter();
 useEffect(()=>{if(!isConfigured())return;let mounted=true;const sb=supabaseBrowser();sb.auth.getUser().then(({data})=>{if(!mounted)return;setUser(data.user);setLoading(false);if(!data.user)router.replace('/login');});const {data:{subscription}}=sb.auth.onAuthStateChange((_evt,session)=>{setUser(session?.user??null);if(!session?.user)router.replace('/login');});return()=>{mounted=false;subscription.unsubscribe();};},[router]);
 if(!isConfigured())return <div className="setup-page"><Film size={48}/><h1>Connect your services</h1><p>Copy <code>.env.example</code> to <code>.env.local</code>, enter Supabase & R2 credentials, run the SQL migration, then restart the server.</p><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="btn btn-primary">Open Supabase</a></div>;
 if(loading||!user)return <div className="loading-screen"><div className="spinner"/><span>Loading workspace…</span></div>;
 return <>{children(user)}</>;
}
