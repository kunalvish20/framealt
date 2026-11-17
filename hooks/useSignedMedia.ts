'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/supabase-browser';
import { readableError } from '@/lib/utils';

type MediaRef = { current: HTMLMediaElement | null };

/** Signed sources are ephemeral and never persisted or shared between users/tokens. */
export function useSignedMedia(versionId: string | null, mediaRef: MediaRef, shareToken?: string) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const resume = useRef<{ time: number; playing: boolean } | null>(null);
  const renewal = useRef<(() => void) | null>(null);
  const automaticRetries = useRef(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let queuedUrl = '';
    setUrl(''); setError(''); resume.current = null; automaticRetries.current = 0;
    if (!versionId) return;
    function replaceSource(next: string) {
      if (!active) return;
      const element = mediaRef.current;
      if (element) resume.current = { time: element.currentTime, playing: !element.paused };
      setUrl(next);
    }
    function applyQueued() { if (queuedUrl) { const next = queuedUrl; queuedUrl = ''; replaceSource(next); } }
    async function request(force = false) {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const params = new URLSearchParams({ versionId: versionId! });
        if (shareToken) params.set('shareToken', shareToken);
        const data = shareToken ? await fetch(`/api/media/read?${params}`, { cache: 'no-store' }).then(async response => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || 'Unable to load media.');
          return body;
        }) : await authFetch(`/api/media/read?${params}`);
        if (!active) return;
        setError('');
        const element = mediaRef.current;
        if (!force && element && !element.paused && element.readyState >= 2) queuedUrl = data.url;
        else replaceSource(data.url);
        clearTimeout(timer);
        timer = setTimeout(() => void request(), Math.max(30, Number(data.expiresIn || 1800) - 60) * 1000);
      } catch (err) { if (active) setError(readableError(err)); }
      finally { inFlight = false; }
    }
    renewal.current = () => { if (automaticRetries.current++ < 1) void request(true); else setError('This media could not be played. Retry, or check that its codec is supported by your browser.'); };
    void request(true);
    const onPause = () => applyQueued();
    // The media element is mounted after the first URL. Capture pause events at
    // document level because HTMLMediaElement pause does not bubble.
    const pause = (event: Event) => { if (event.target === mediaRef.current) onPause(); };
    document.addEventListener('pause', pause, true);
    return () => { active = false; clearTimeout(timer); renewal.current = null; document.removeEventListener('pause', pause, true); };
  }, [versionId, shareToken, mediaRef, attempt]);

  const restore = useCallback(() => {
    const element = mediaRef.current;
    const previous = resume.current;
    if (!element || !previous) return;
    resume.current = null;
    element.currentTime = Number.isFinite(element.duration) ? Math.min(previous.time, element.duration) : previous.time;
    if (previous.playing) void element.play().catch(() => {});
  }, [mediaRef]);
  return { url, error, restore, retry: () => setAttempt(value => value + 1), onError: () => renewal.current?.() };
}
