'use client';
import {useEffect,useRef,useState} from 'react';
import {FileAudio,FileImage,FileVideo} from 'lucide-react';
import {authFetch} from '@/lib/supabase-browser';
import type {Version} from '@/lib/types';
export default function FileCover({kind,version}:{kind:string;version:Version|undefined}){
 const ref=useRef<HTMLSpanElement>(null);const [visible,setVisible]=useState(false);const [thumbnail,setThumbnail]=useState('');
 useEffect(()=>{const element=ref.current;if(!element)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))setVisible(true)},{rootMargin:'100px'});observer.observe(element);return()=>observer.disconnect()},[]);
 useEffect(()=>{let active=true;setThumbnail('');if(!visible||!version)return;
  void authFetch(`/api/media/thumbnail?versionId=${encodeURIComponent(version.id)}`).then(({url})=>{if(active&&url)setThumbnail(url)}).catch(()=>{});
  // For direct image assets, signed original URL doubles as preview if Drive has no thumbnail.
  if(kind==='image')void authFetch(`/api/media/read?versionId=${encodeURIComponent(version.id)}`).then(({url})=>{if(active)setThumbnail(old=>old||url)}).catch(()=>{});
  return()=>{active=false};
 },[version?.id,kind,visible]);
 return <span className="ff-asset-cover-visual" ref={ref}>
  {thumbnail?<img loading="lazy" src={thumbnail} alt=""/>:<span className="ff-cover-fallback">{kind==='video'?<FileVideo size={49}/>:kind==='image'?<FileImage size={49}/>:<FileAudio size={49}/>}</span>}
 </span>;
}
