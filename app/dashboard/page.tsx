'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Cloud, FolderKanban, FolderOpen, HardDrive, Plus, Search, Users, Video, X, Loader2 } from 'lucide-react';
import { AuthGate } from '@/components/AuthGate';
import AppShell from '@/components/AppShell';
import Dialog from '@/components/ui/Dialog';
import { EmptyState, SkeletonRows } from '@/components/ui/LoadingState';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { presentationCache } from '@/lib/client-cache.mjs';
import { readableError, fmtBytes } from '@/lib/utils';
import type { Project } from '@/lib/types';
import type { User } from '@supabase/supabase-js';

type ProjectRow = Project & { assets: { count: number }[]; project_members: { count: number }[] };
const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function Home() { return <AuthGate>{user => <Dashboard key={user.id} user={user}/>}</AuthGate>; }

function Dashboard({ user }: { user: User }) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [totalSize, setTotalSize] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [saving, setSaving] = useState(false);
  const cacheKey = `projects:${user.id}`;

  const load = useCallback(async (refresh = false) => {
    setError('');
    if (refresh) presentationCache.delete(cacheKey);
    try {
      const rows = await presentationCache.load<ProjectRow[]>(cacheKey, async () => {
        const { data, error: queryError } = await supabaseBrowser().from('projects')
          .select('*,assets(count),project_members(count)').order('updated_at', { ascending: false });
        if (queryError) throw queryError;
        return (data || []) as ProjectRow[];
      });
      setProjects(rows);
    } catch (err) { setError(readableError(err)); }
    finally { setLoading(false); }
  }, [cacheKey]);

  useEffect(() => {
    let active = true;
    void load();
    // Nonessential storage totals never block opening projects. Paginate to avoid
    // silently reporting only Supabase's first 1,000 versions as total usage.
    void presentationCache.load<number>(`storage:${user.id}`, async () => {
      let sum = 0;
      for (let offset = 0; ; offset += 1000) {
        const { data, error: queryError } = await supabaseBrowser().from('asset_versions').select('id,size_bytes')
          .eq('status', 'ready').or('source_provider.eq.mux,source_provider.eq.r2,source_provider.is.null').order('id').range(offset, offset + 999);
        if (queryError) throw queryError;
        sum += (data || []).reduce((total, version) => total + Number(version.size_bytes || 0), 0);
        if (!data || data.length < 1000) break;
      }
      return sum;
    }).then(value => { if (active) setTotalSize(value); }).catch(() => { /* Secondary total remains unavailable, not a false zero. */ });
    return () => { active = false; };
  }, [load, user.id]);

  const filtered = useMemo(() => projects.filter(project => `${project.title} ${project.description}`.toLowerCase().includes(search.toLowerCase())), [projects, search]);
  const totals = useMemo(() => projects.reduce((sum, project) => ({ assets: sum.assets + (project.assets?.[0]?.count || 0), members: sum.members + (project.project_members?.[0]?.count || 0) }), { assets: 0, members: 0 }), [projects]);

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true); setCreateError('');
    try {
      const { data, error: insertError } = await supabaseBrowser().from('projects').insert({ title: title.trim(), description: description.trim(), owner_id: user.id }).select('id').single();
      if (insertError) throw insertError;
      presentationCache.clear();
      router.push(`/project/${data.id}`);
    } catch (err) { setCreateError(readableError(err)); setSaving(false); }
  }

  return <AppShell user={user}>
    <div className="dashboard-page">
      <div className="page-heading"><div><h1 className="page-title">Projects{!loading && <span className="count-heading">{projects.length}</span>}</h1><p className="page-description">Manage your media, feedback, and approvals.</p></div><button className="btn btn-primary" onClick={() => { setCreating(true); setCreateError(''); }}><Plus size={16}/> New project</button></div>
      <div className="index-toolbar"><label className="search-box"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search projects" aria-label="Search projects"/></label><Link href="/drive" className="btn btn-secondary"><Cloud size={16}/> Google Drive</Link></div>
      {error && <div className="message error" role="alert">{error} <button className="text-link" onClick={() => void load(true)}>Try again</button></div>}
      <div className="project-index">
        <div className="project-index-head" aria-hidden="true"><span>Project</span><span>Assets</span><span className="project-member-col">Members</span><span>Updated</span><span/></div>
        {loading ? <SkeletonRows count={5}/> : filtered.length ? filtered.map(project => <Link href={`/project/${project.id}`} className="project-index-row" key={project.id}>
          <div className="project-name-cell"><span className="project-folder-icon"><FolderKanban size={19} strokeWidth={1.6}/></span><div><strong>{project.title}</strong>{project.description && <p>{project.description}</p>}<small className="project-mobile-meta">{project.assets?.[0]?.count ?? '—'} assets / {project.project_members?.[0]?.count ?? '—'} members</small></div></div>
          <span>{project.assets?.[0]?.count ?? '—'}</span><span className="project-member-col">{project.project_members?.[0]?.count ?? '—'}</span><span>{dateFormat.format(new Date(project.updated_at))}</span><ArrowRight size={15}/>
        </Link>) : search ? <EmptyState icon={Search} title="No matching projects" action={<button className="btn btn-secondary" onClick={() => setSearch('')}>Clear search</button>}>Try a different project name or description.</EmptyState> : <EmptyState icon={FolderOpen} title="Create your first project" action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16}/> New project</button>}>Organize your media and invite collaborators to review it.</EmptyState>}
      </div>
      <div className="project-totals" aria-live="polite"><span><FolderKanban size={13}/><b>{loading ? '—' : projects.length}</b> projects</span><span><Video size={13}/><b>{loading ? '—' : totals.assets}</b> media assets</span><span><Users size={13}/><b>{loading ? '—' : totals.members}</b> memberships</span><span><HardDrive size={13}/><b>{totalSize === null ? '—' : fmtBytes(totalSize)}</b> uploaded files</span></div>
      <div className="index-footer"><Cloud size={14}/> New uploaded videos stream privately from Mux. Linked media stays in Google Drive.</div>
    </div>
    {creating && <Dialog open title="Create a project" onClose={() => setCreating(false)} busy={saving}><form onSubmit={event => void createProject(event)}><div className="modal-top"><span className="modal-icon"><FolderKanban size={20}/></span><button type="button" disabled={saving} className="icon-btn" onClick={() => setCreating(false)} aria-label="Close create project"><X size={19}/></button></div><h2>Create a project</h2><p className="page-description">A space for your files and collaborators.</p><label>Project name<input autoFocus required maxLength={140} value={title} onChange={event => setTitle(event.target.value)} placeholder="Project name"/></label><label>Description (optional)<textarea maxLength={3000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Add a short description" rows={3}/></label>{createError && <div className="message error" role="alert">{createError}</div>}<div className="modal-actions"><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setCreating(false)}>Cancel</button><button disabled={!title.trim() || saving} className="btn btn-primary">{saving ? <Loader2 size={16} className="rotating"/> : <Plus size={16}/>} {saving ? 'Creating…' : 'Create project'}</button></div></form></Dialog>}
  </AppShell>;
}
