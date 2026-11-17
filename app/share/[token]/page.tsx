'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Clock, FileAudio, FileImage, FileVideo, Film, Link2, Loader2, MessageCircle, Play, Send, ShieldCheck, X } from 'lucide-react';
import ReviewPlayer from '@/components/review/ReviewPlayer';
import MarkupToolbar from '@/components/review/MarkupToolbar';
import { validReviewMarks, type DrawTool, type ReviewMark } from '@/lib/annotation';
import { fmtTime, readableError } from '@/lib/utils';
import type { Comment } from '@/lib/types';

type SAsset = { id: string; name: string; kind: string; mime_type: string; current_version: number; created_at: string };
type SVersion = { id: string; asset_id: string; version: number; mime_type: string; size_bytes: number; status: string; created_at: string };
type ShareData = { project: { id: string; title: string; description: string }; assets: SAsset[]; versions: SVersion[]; comments: Comment[]; canComment: boolean; expiresAt: string | null };

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [posting, setPosting] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [time, setTime] = useState(0);
  const [tool, setTool] = useState<DrawTool | null>(null);
  const [marks, setMarks] = useState<ReviewMark[]>([]);
  const [focusedComment, setFocusedComment] = useState<string | null>(null);
  const [panel, setPanel] = useState<'comments' | 'files'>('comments');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const player = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setData(null); setError(''); setMessage(''); setMarks([]);
    void fetch(`/api/public-share/${token}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Link unavailable');
      if (!controller.signal.aborted) { setData(body); setSelected(body.assets[0]?.id || null); }
    }).catch(err => { if (!controller.signal.aborted) setError(readableError(err)); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [token, loadAttempt]);

  const chosen = useMemo(() => data?.assets.find(asset => asset.id === selected) || null, [data?.assets, selected]);
  const options = useMemo(() => data?.versions.filter(version => version.asset_id === selected).sort((a, b) => b.version - a.version) || [], [data?.versions, selected]);
  useEffect(() => { setVersionId(old => old && options.some(version => version.id === old) ? old : options[0]?.id || null); }, [options]);
  useEffect(() => { setTime(0); setMarks([]); setTool(null); setFocusedComment(null); }, [versionId]);
  const version = options.find(option => option.id === versionId);
  const thread = useMemo(() => (data?.comments || []).filter(comment => comment.asset_version_id === versionId).sort((a, b) => a.time_seconds - b.time_seconds), [data?.comments, versionId]);
  const positionChange = useCallback((next: number) => { if (!message.trim() && !marks.length) setTime(next); }, [message, marks.length]);

  function confirmSwitch() { return !message.trim() && !marks.length || window.confirm('Discard your unsaved feedback and switch media?'); }
  function chooseAsset(id: string) { if (!confirmSwitch()) return; setMessage(''); setMarks([]); setSelected(id); setPanel('comments'); }
  function chooseVersion(id: string) { if (!confirmSwitch()) return; setMessage(''); setMarks([]); setVersionId(id); }
  function jump(next: number, commentId: string) { setFocusedComment(commentId); if (player.current) { player.current.currentTime = next; player.current.pause(); } if (!message.trim() && !marks.length) setTime(next); }

  async function post(event: FormEvent) {
    event.preventDefault();
    if (posting || (!message.trim()&&!marks.length) || !name.trim() || !versionId) return;
    setPosting(true); setError('');
    try {
      const response = await fetch(`/api/public-share/${token}/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versionId, guestName: name.trim(), message: message.trim() || 'Visual annotation', timeSeconds: Math.round(time * 1000) / 1000, annotation:marks.length?marks:null }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Comment failed');
      setMessage(''); setMarks([]); setTool(null);
      const updated = await fetch(`/api/public-share/${token}`, { cache: 'no-store' });
      const snapshot = await updated.json();
      if (!updated.ok) throw new Error(snapshot.error || 'Comment saved, but feedback could not refresh. Reopen this review to see it.');
      setData(snapshot);
    } catch (err) { setError(readableError(err)); }
    finally { setPosting(false); }
  }

  return <div className="public-layout ff-share-review">
    <header className="public-header"><Link href="/" className="public-brand"><span className="brand-symbol"><Film size={18}/></span>FreeFrame</Link><div className="public-header-right"><ShieldCheck size={15}/> Shared review</div></header>
    {busy ? <div className="public-loading" role="status"><Loader2 className="rotating" size={28}/><p>Opening your review…</p></div> : data ? <div className="public-content">
      <div className="public-intro"><h1>{data.project.title}</h1>{data.project.description && <p>{data.project.description}</p>}{data.expiresAt && <div className="public-expiry"><Clock size={13}/> Link expires {new Date(data.expiresAt).toLocaleDateString()}</div>}</div>
      <div className="public-workspace ff-public-workspace" data-panel={panel}>
        <div className="review-panel-switch" role="group" aria-label="Review panel"><button aria-pressed={panel === 'comments'} onClick={() => setPanel('comments')}>Comments</button><button aria-pressed={panel === 'files'} onClick={() => setPanel('files')}>Files</button></div>
        <aside className="public-assets"><div className="panel-top"><h3>Shared files <span>{data.assets.length}</span></h3></div>{data.assets.map(asset => <button key={asset.id} className={`asset-item ${selected === asset.id ? 'active' : ''}`} aria-pressed={selected === asset.id} onClick={() => chooseAsset(asset.id)}><div className="asset-icon">{asset.kind === 'video' ? <FileVideo size={19}/> : asset.kind === 'audio' ? <FileAudio size={19}/> : <FileImage size={19}/>}</div><div><b title={asset.name}>{asset.name}</b><small>{asset.kind.toUpperCase()} / v{asset.current_version}</small></div></button>)}</aside>
        <section className="public-viewer" aria-label="Shared media player"><div className="viewer-toolbar"><div className="viewer-title" title={chosen?.name}>{chosen?.name || 'No media'}</div>{options.length > 1 && <select aria-label="Media version" value={versionId || ''} onChange={event => chooseVersion(event.target.value)} className="simple-version-select">{options.map(option => <option value={option.id} key={option.id}>Version {option.version}</option>)}</select>}</div>
          <MarkupToolbar tool={tool} onToolChange={next => { player.current?.pause(); setTool(next); }} count={marks.length} onUndo={() => setMarks(old => old.slice(0, -1))} disabled={!versionId} readOnly={!data.canComment}/>
          <ReviewPlayer versionId={versionId} shareToken={token} kind={chosen?.kind} name={chosen?.name} size={version?.size_bytes} playerRef={player} draftMarks={marks} onMarksChange={setMarks} tool={data.canComment ? tool : null} focusedComment={thread.find(comment => comment.id === focusedComment)} onPositionChange={positionChange}/>
          <div className="public-approval-note"><ShieldCheck size={15}/>{data.canComment ? 'Leave timecoded feedback without creating an account.' : 'View-only review. Commenting is disabled for this link.'}</div>
        </section>
        <aside className="comments-panel public-comments"><div className="panel-top"><h3><MessageCircle size={17}/> Feedback <span>{thread.length}</span></h3></div><div className="comments-list">{thread.length ? thread.map(comment => <div key={comment.id} className="comment"><div className="comment-avatar">{(comment.guest_name || 'T')[0].toUpperCase()}</div><div className="comment-main"><div className="comment-author"><strong>{comment.guest_name || 'Team reviewer'}</strong><small>{new Date(comment.created_at).toLocaleDateString()}</small></div><button className="timecode" onClick={() => jump(comment.time_seconds, comment.id)}><Play size={11} fill="currentColor"/> {fmtTime(comment.time_seconds)} {validReviewMarks(comment.annotation) && comment.annotation.length > 0 ? '/ Markup' : ''}</button><p>{comment.body}</p></div></div>) : <div className="empty-comments"><MessageCircle size={30}/><b>No feedback yet</b><p>Pause the media to comment on a specific moment.</p></div>}</div>
          {data.canComment ? <form className="comment-composer public-compose" onSubmit={event => void post(event)}><div className="composer-label">Comment at <b>{fmtTime(time)}</b></div><input required minLength={2} maxLength={80} autoComplete="name" aria-label="Your name" value={name} onChange={event => setName(event.target.value)} placeholder="Your name" disabled={posting}/><textarea required={!marks.length} maxLength={3000} rows={3} aria-label="Guest feedback" value={message} onChange={event => setMessage(event.target.value)} placeholder="Leave your feedback…" disabled={posting}/><div className="composer-bottom"><span>{marks.length ? `${marks.length} markups attached` : 'Guest feedback'}</span><button disabled={posting || (!message.trim()&&!marks.length) || name.trim().length < 2 || !versionId} className="btn btn-primary btn-sm"><Send size={14}/> {posting ? 'Posting…' : 'Post'}</button></div></form> : <div className="comment-read-only">Comments are read-only for this link.</div>}
        </aside>
      </div>
    </div> : <div className="expired-share"><Link2 size={38}/><h2>Link unavailable</h2><p>{error || 'This share link may have expired or been revoked.'}</p><button className="btn btn-secondary" onClick={() => setLoadAttempt(value => value + 1)}>Try again</button></div>}
    {error && data && <div className="floating-error" role="alert">{error}<button className="icon-btn" onClick={() => setError('')} aria-label="Dismiss error"><X size={15}/></button></div>}
    <footer className="public-footer">Powered by FreeFrame / Private media storage</footer>
  </div>;
}
