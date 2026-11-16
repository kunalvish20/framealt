'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtTime } from '@/lib/utils';

type Props = {
  src: string;
  playerRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  onTimeChange: (time: number) => void;
};

export default function VideoScrubber({ src, playerRef, currentTime, onTimeChange }: Props) {
  const [duration, setDuration] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const lastPreviewSeek = useRef(0);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const syncDuration = () => setDuration(Number.isFinite(player.duration) ? player.duration : 0);
    syncDuration();
    player.addEventListener('loadedmetadata', syncDuration);
    player.addEventListener('durationchange', syncDuration);
    return () => {
      player.removeEventListener('loadedmetadata', syncDuration);
      player.removeEventListener('durationchange', syncDuration);
    };
  }, [src, playerRef]);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || hoverTime === null) return;
    // A short throttle lets the preview play smoothly while following the pointer.
    const seekPreview = () => {
      if (Math.abs(preview.currentTime - hoverTime) > 0.3) preview.currentTime = hoverTime;
      lastPreviewSeek.current = performance.now();
    };
    const delay = Math.max(0, 90 - (performance.now() - lastPreviewSeek.current));
    const timer = delay ? window.setTimeout(seekPreview, delay) : null;
    if (!delay) seekPreview();
    void preview.play().catch(() => {});
    return () => { if (timer !== null) window.clearTimeout(timer); };
  }, [hoverTime]);

  function updateHover(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch' || duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHoverTime(fraction * duration);
  }

  function stopPreview() {
    previewRef.current?.pause();
    setHoverTime(null);
  }

  function seek(time: number) {
    const next = Math.min(duration, Math.max(0, time));
    if (playerRef.current) playerRef.current.currentTime = next;
    onTimeChange(next);
  }

  const progress = duration > 0 ? Math.min(100, Math.max(0, currentTime / duration * 100)) : 0;
  const hoverProgress = hoverTime !== null && duration > 0 ? hoverTime / duration * 100 : 0;

  return <div className="ff-video-timeline" aria-label="Video timeline">
    <div className="ff-video-timeline-track" onPointerEnter={updateHover} onPointerMove={updateHover} onPointerLeave={stopPreview}>
      <div className="ff-video-timeline-rail"><span style={{ width: `${progress}%` }} /></div>
      <input
        type="range" min={0} max={duration || 1} step="0.01" value={Math.min(currentTime, duration || 1)}
        aria-label="Seek video" aria-valuetext={`${fmtTime(currentTime)} of ${fmtTime(duration)}`}
        disabled={duration <= 0}
        onChange={event => seek(Number(event.target.value))}
      />
      {hoverTime !== null && <div className="ff-video-hover-card" style={{ left: `clamp(88px, ${hoverProgress}%, calc(100% - 88px))` }}>
        <video ref={previewRef} src={src} muted playsInline preload="metadata" aria-hidden="true" />
        <span>{fmtTime(hoverTime)}</span>
      </div>}
    </div>
    <div className="ff-video-timeline-times"><span>{fmtTime(currentTime)}</span><span>Hover to preview · drag to seek</span><span>{fmtTime(duration)}</span></div>
  </div>;
}
