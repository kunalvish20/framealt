'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, ChevronDown, CloudUpload, Loader2, X } from 'lucide-react';
import { dismissUpload, useUploads } from '@/lib/upload-manager';
import { fmtBytes } from '@/lib/utils';

export default function UploadActivity({ userId }: { userId: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const jobs = useUploads().filter(job => job.userId === userId);
  const transferring = jobs.some(job => ['queued', 'preparing', 'uploading'].includes(job.stage));
  const visibleJobs = [...jobs.filter(job => !['ready', 'failed'].includes(job.stage)), ...jobs.filter(job => ['ready', 'failed'].includes(job.stage)).slice(-2)].reverse();

  useEffect(() => {
    if (!transferring) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [transferring]);

  if (!jobs.length) return null;
  return <aside className="upload-activity" aria-label="Mux upload activity">
    <button className="upload-activity-heading" onClick={() => setCollapsed(value => !value)} aria-expanded={!collapsed}><CloudUpload size={18}/><strong>Mux uploads</strong><span>{jobs.filter(job => !['ready', 'failed'].includes(job.stage)).length} active</span><ChevronDown size={16} className={collapsed ? 'collapsed' : ''}/></button>
    {!collapsed&&<><div className="upload-activity-list">{visibleJobs.map(job => <div className="upload-activity-job" key={job.id}>
      <div className="upload-activity-row"><div className="upload-activity-name" title={job.name}>{job.name}</div>{['ready', 'failed'].includes(job.stage)&&<button className="icon-btn" onClick={() => dismissUpload(job.id)} title="Dismiss upload" aria-label={`Dismiss ${job.name}`}><X size={15}/></button>}</div>
      <div className="upload-activity-row"><span className={`upload-activity-state state-${job.stage}`}>{job.stage === 'queued' ? 'Waiting to upload' : job.stage === 'preparing' ? 'Preparing video' : job.stage === 'uploading' ? `${job.percent}% · ${fmtBytes(Math.round(job.size * job.percent / 100))} of ${fmtBytes(job.size)}` : job.stage === 'processing' ? 'Uploaded · Mux is processing' : job.stage === 'ready' ? <><Check size={13}/> Ready to review</> : job.error || 'Upload failed'}</span>{['preparing', 'processing'].includes(job.stage)&&<Loader2 size={14} className="rotating"/>}</div>
      {['uploading', 'processing', 'ready'].includes(job.stage)&&<div className="upload-activity-track" role="progressbar" aria-label={`Upload progress for ${job.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.percent}><div style={{width:`${job.percent}%`}}/></div>}
      <Link href={`/project/${job.projectId}`} className="upload-activity-link">View project</Link>
    </div>)}</div>
    {transferring&&<p>You can navigate within FreeFrame. Keep this browser tab open until upload finishes.</p>}</>}
  </aside>;
}
