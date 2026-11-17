'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Download, FileAudio, Film, Loader2 } from 'lucide-react';
import VideoScrubber from '@/components/VideoScrubber';
import { useSignedMedia } from '@/hooks/useSignedMedia';
import { fmtBytes, fmtTime } from '@/lib/utils';
import { validReviewMarks, type DrawTool, type ReviewMark } from '@/lib/annotation';
import type { Comment } from '@/lib/types';

const MarkupLayer = dynamic(() => import('@/components/MarkupLayer'), { ssr: false });
type Props = {
  versionId: string | null;
  name?: string;
  kind?: string;
  size?: number;
  source?: string;
  shareToken?: string;
  playerRef: React.RefObject<HTMLVideoElement | null>;
  draftMarks: ReviewMark[];
  onMarksChange: (marks: ReviewMark[]) => void;
  tool: DrawTool | null;
  focusedComment?: Comment;
  onPositionChange: (seconds: number) => void;
};

export default function ReviewPlayer({ versionId, name, kind, size, source, shareToken, playerRef, draftMarks, onMarksChange, tool, focusedComment, onPositionChange }: Props) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const [natural, setNatural] = useState({ width: 16, height: 9 });
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const media = useSignedMedia(versionId, mediaRef, shareToken);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setTime(0); setNatural({ width: 16, height: 9 }); }, [versionId]);
  const syncTime = useCallback((next: number) => { setTime(next); onPositionChange(next); }, [onPositionChange]);
  const bindVideo = useCallback((element: HTMLVideoElement | null) => { playerRef.current = element; mediaRef.current = element; }, [playerRef]);
  const ratio = natural.width / natural.height;
  const width = Math.min(bounds.width || 1, (bounds.height || 1) * ratio);
  const height = width / ratio;
  const savedMarks = focusedComment && Math.abs(focusedComment.time_seconds - time) < 1.5 && validReviewMarks(focusedComment.annotation) ? focusedComment.annotation : [];

  return <>
    <div className="preview-stage ff-preview-stage" ref={stage} aria-busy={!!versionId && !media.url}>
      {media.url ? kind === 'audio' ? <div className="audio-preview"><FileAudio size={56} strokeWidth={1}/><b>{name}</b><audio key={versionId} ref={element => { mediaRef.current = element; }} src={media.url} controls preload="metadata" onLoadedMetadata={media.restore} onError={media.onError} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onPause={event => onPositionChange(event.currentTarget.currentTime)} onSeeked={event => onPositionChange(event.currentTarget.currentTime)}/></div> : <div className={`ff-media-surface ${kind === 'image' ? 'ff-image-surface' : ''}`} style={{ width, height }}>
        {kind === 'video' ? <video key={versionId} ref={bindVideo} className="review-video" src={media.url} controls playsInline preload="metadata" aria-label={name || 'Review video'} onLoadedMetadata={event => { const element = event.currentTarget; if (element.videoWidth && element.videoHeight) setNatural({ width: element.videoWidth, height: element.videoHeight }); media.restore(); }} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onPause={event => onPositionChange(event.currentTarget.currentTime)} onSeeked={event => onPositionChange(event.currentTarget.currentTime)} onError={media.onError}/> : <img key={versionId} className="review-image" src={media.url} alt={name || 'Review image'} onLoad={event => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={media.onError}/>}
        <MarkupLayer marks={[...savedMarks, ...draftMarks]} onChange={marks => onMarksChange(marks.slice(savedMarks.length))} tool={tool}/>
      </div> : <div className="empty-viewer"><div>{versionId ? <Loader2 size={36} className="rotating"/> : <Film size={52} strokeWidth={1}/>}</div><h3>{versionId ? 'Loading secure media…' : 'No file selected'}</h3><p>{versionId ? 'Preparing your private preview.' : 'Select a file to start reviewing.'}</p></div>}
      {media.error && <div className="media-error" role="alert"><p>{media.error}</p><button className="btn btn-secondary" onClick={media.retry}>Retry media</button></div>}
    </div>
    {kind === 'video' && media.url && <VideoScrubber key={versionId} src={media.url} playerRef={playerRef} currentTime={time} onTimeChange={syncTime}/>}
    <div className="viewer-bottom"><div className="viewer-time"><Clock size={14}/><b>{fmtTime(time)}</b><small>Timeline position</small></div>{versionId && <div className="viewer-bottom-tools"><span className="file-size">{source ? source === 'google_drive' ? 'Google Drive · ' : 'R2 · ' : ''}{fmtBytes(size || 0)}</span>{!shareToken && media.url && <a className="outline-mini" href={media.url} target="_blank" rel="noopener noreferrer"><Download size={14}/> Open file</a>}</div>}</div>
  </>;
}
