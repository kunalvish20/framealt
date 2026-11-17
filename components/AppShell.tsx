'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Film, FolderKanban, LogOut, Cloud, ChevronRight, Menu, X, Loader2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { clearClientCaches } from '@/lib/client-cache.mjs';
import { initials, readableError } from '@/lib/utils';
import Dialog from '@/components/ui/Dialog';
import type { User } from '@supabase/supabase-js';

export default function AppShell({ children, user, topAction }: { children: React.ReactNode; user: User; topAction?: React.ReactNode }) {
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const name = (user.user_metadata?.display_name as string) || user.email?.split('@')[0] || 'Member';
  const inProjects = path === '/dashboard' || path.startsWith('/project/');

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError('');
    try {
      const { error: authError } = await supabaseBrowser().auth.signOut();
      if (authError) throw authError;
      clearClientCaches();
      // AuthGate handles the single signed-out redirect for all protected routes.
    } catch (err) { setError(readableError(err)); setSigningOut(false); }
  }

  function navigation() {
    return <>
      <Link href="/dashboard" className="brand" onClick={() => setDrawer(false)}><span className="brand-symbol"><Film size={18}/></span><span>FreeFrame</span></Link>
      <div className="workspace-identity">Workspace<strong>{name}</strong></div>
      <nav className="workspace-navigation" aria-label="Workspace navigation">
        <Link href="/dashboard" className={`nav-item ${inProjects ? 'active' : ''}`} aria-current={inProjects ? 'page' : undefined} onClick={() => setDrawer(false)}><FolderKanban size={17}/> Projects{inProjects && <span className="nav-active-dot"/>}</Link>
        <Link href="/drive" className={`nav-item ${path === '/drive' ? 'active' : ''}`} aria-current={path === '/drive' ? 'page' : undefined} onClick={() => setDrawer(false)}><Cloud size={17}/> Google Drive{path === '/drive' && <span className="nav-active-dot"/>}</Link>
      </nav>
      <div className="sidebar-bottom">{error && <div className="sidebar-error" role="alert">{error}</div>}<div className="profile"><div className="profile-avatar">{initials(name)}</div><div className="profile-text"><b>{name}</b><small title={user.email}>{user.email}</small></div><button className="icon-btn" onClick={() => void signOut()} disabled={signingOut} aria-label="Sign out" title="Sign out">{signingOut ? <Loader2 size={16} className="rotating"/> : <LogOut size={16}/>}</button></div></div>
    </>;
  }

  return <div className="app-layout">
    <a href="#workspace-content" className="skip-link">Skip to content</a>
    <aside className="sidebar">{navigation()}</aside>
    <main className="main-area" id="workspace-content" tabIndex={-1}>
      <header className="topbar"><div className="topbar-leading"><button className="icon-btn mobile-menu-toggle" onClick={() => setDrawer(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="crumb"><span>Workspace</span><ChevronRight size={12}/><strong>{path === '/drive' ? 'Google Drive' : path === '/dashboard' ? 'Projects' : 'Project files'}</strong></div></div><div className="topbar-actions">{topAction}</div></header>
      {children}
    </main>
    {drawer && <Dialog open title="Workspace navigation" onClose={() => setDrawer(false)} className="navigation-drawer"><div className="modal-top"><strong>Navigation</strong><button className="icon-btn" onClick={() => setDrawer(false)} aria-label="Close navigation"><X size={20}/></button></div><div className="sidebar">{navigation()}</div></Dialog>}
  </div>;
}
