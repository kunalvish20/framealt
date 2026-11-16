'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Film, FolderKanban, LogOut, ShieldCheck, HardDrive, Cloud, ChevronDown, Sparkles } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { initials } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';
export default function AppShell({children,user,topAction}:{children:React.ReactNode;user:User;topAction?:React.ReactNode}){
 const router=useRouter(),path=usePathname();
 async function signOut(){await supabaseBrowser().auth.signOut();router.replace('/login');router.refresh();}
 const name=(user.user_metadata?.display_name as string)||user.email?.split('@')[0]||'Member';
 return <div className="app-layout">
   <aside className="sidebar">
    <Link href="/" className="brand"><span className="brand-symbol"><Film size={21} strokeWidth={2.2}/></span><span>FreeFrame<span className="brand-cloud">cloud</span></span></Link>
    <div className="workspace-switch"><span className="workspace-avatar">{initials(name)}</span><div className="work-text"><strong>My Workspace</strong><small>Creative team</small></div><ChevronDown className="workspace-chevron" size={15}/></div>
    <div className="sidebar-label">LIBRARY</div>
    <Link href="/" className={`nav-item ${path==='/'?'active':''}`}><FolderKanban size={18}/> Projects</Link>
    <Link href="/drive" className={`nav-item ${path==='/drive'?'active':''}`}><Cloud size={18}/> Google Drive</Link>
    <div className="sidebar-label extra-space">WORKSPACE STATUS</div>
    <div className="nav-item muted-nav" title="Optional storage for direct uploads"><HardDrive size={18}/> R2 storage</div>
    <div className="nav-item muted-nav" title="Authentication and project data"><ShieldCheck size={18}/> Secure access <span className="connected-dot"/></div>
    <div className="sidebar-bottom"><div className="sidebar-hint"><Sparkles size={17}/><span><strong>Make every frame count.</strong><br/>Review, refine, and approve in one place.</span></div>
     <div className="profile"><div className="profile-avatar">{initials(name)}</div><div className="profile-text"><b>{name}</b><small>{user.email}</small></div><button className="icon-btn" onClick={signOut} title="Sign out"><LogOut size={18}/></button></div>
    </div>
   </aside>
   <main className="main-area"><div className="topbar"><div className="crumb">Workspace <span>/</span> <strong>{path==='/'?'Projects':path==='/drive'?'Google Drive':'Project review'}</strong></div><div className="topbar-actions"><span className="top-pill"><span className="connected-dot"/> Supabase workspace</span>{topAction}</div></div>{children}</main>
  </div>;
}
