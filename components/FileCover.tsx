'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { FileAudio, FileImage, FileVideo } from 'lucide-react';
import { authFetch } from '@/lib/supabase-browser';
import { thumbnailCache } from '@/lib/client-cache.mjs';
import { useAuth } from '@/components/AuthProvider';
import type { Version } from '@/lib/types';

function FileCover({ kind, version }: { kind: string; version: Version | undefined }) {
  const { session } = useAuth();
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [thumbnail, setThumbnail] = useState('');
  const userId = session?.user.id;
  const versionId = version?.id;
  const provider = version?.source_provider;
  const key = `${userId}:${versionId}:${kind}`;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '160px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setThumbnail('');
    if (!visible || !versionId || !userId || (provider !== 'google_drive' && kind !== 'image')) return;
    void thumbnailCache.load<string>(key, async () => {
      if (provider === 'google_drive') {
        const { url } = await authFetch(`/api/media/thumbnail?versionId=${encodeURIComponent(versionId)}`);
        if (url) return url;
      }
      if (kind === 'image') {
        const { url } = await authFetch(`/api/media/read?versionId=${encodeURIComponent(versionId)}`);
        return url || '';
      }
      return '';
    }).then(url => { if (active) setThumbnail(url); }).catch(() => {});
    return () => { active = false; };
  }, [versionId, provider, kind, visible, userId, key]);

  return <span className="ff-asset-cover-visual" ref={ref}>{thumbnail ? <img loading="lazy" decoding="async" src={thumbnail} alt="" onError={() => { thumbnailCache.delete(key); setThumbnail(''); }}/> : <span className="ff-cover-fallback">{kind === 'video' ? <FileVideo size={42} strokeWidth={1.25}/> : kind === 'image' ? <FileImage size={42} strokeWidth={1.25}/> : <FileAudio size={42} strokeWidth={1.25}/>}</span>}</span>;
}
export default memo(FileCover);
