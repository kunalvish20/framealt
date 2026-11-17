'use client';
import { Suspense,useCallback,useEffect,useMemo,useRef,useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import { SkeletonRows } from '@/components/ui/LoadingState';
import { useRouter,useSearchParams } from 'next/navigation';
import { ArrowLeft,ArrowRight,Check,CheckCircle2,ChevronRight,Cloud,CloudOff,ExternalLink,File,FileAudio,FileImage,FileVideo,Folder,HardDrive,Link2,Loader2,RefreshCw,Search,ShieldCheck,Unplug,Video } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { AuthGate } from '@/components/AuthGate';
import { authFetch } from '@/lib/supabase-browser';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { fmtBytes, readableError } from '@/lib/utils';
import type { Project } from '@/lib/types';
import type { User } from '@supabase/supabase-js';

type DriveFile={id:string;name:string;mimeType:string;size?:string;modifiedTime?:string;webViewLink?:string;parents?:string[]};
type DrivePage={files:DriveFile[];nextPageToken:string|null;incompleteSearch?:boolean;folder?:DriveFile|null};
type Connection={connected:boolean;email:string|null};
const folderMime='application/vnd.google-apps.folder';
const kind=(f:DriveFile)=>f.mimeType.startsWith('video/')?'video':f.mimeType.startsWith('image/')?'image':f.mimeType.startsWith('audio/')?'audio':null;
export default function DrivePageRoute(){return <Suspense fallback={<div className="loading-inline">Opening Google Drive…</div>}><AuthGate>{user=><DriveBrowser user={user}/>}</AuthGate></Suspense>;}
function DriveBrowser({user}:{user:User}){
 const router=useRouter(),params=useSearchParams(),selectedProject=params.get('project')||'',targetVersion=params.get('asset')||'';
 const [view,setView]=useState<'all'|'mydrive'|'shared'|'starred'>('all'),[connection,setConnection]=useState<Connection|null>(null),[projects,setProjects]=useState<Project[]>([]),[projectId,setProjectId]=useState(selectedProject),[items,setItems]=useState<DriveFile[]>([]),[folder,setFolder]=useState('root'),[crumbs,setCrumbs]=useState<{id:string;name:string}[]>([{id:'root',name:'All files'}]),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[nextPage,setNextPage]=useState<string|null>(null),[busy,setBusy]=useState(false),[connecting,setConnecting]=useState(false),[paging,setPaging]=useState(false),[linking,setLinking]=useState<Record<string,boolean>>({}),[linked,setLinked]=useState<Record<string,string>>({}),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [confirmDisconnect,setConfirmDisconnect]=useState(false);
 const requestId=useRef(0),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;requestId.current++;};},[]);
 const report=params.get('google');
 const openFile=(f:DriveFile)=>{if(f.webViewLink)window.open(f.webViewLink,'_blank','noopener,noreferrer');else window.open(`https://drive.google.com/file/d/${encodeURIComponent(f.id)}/view`,'_blank','noopener,noreferrer');};
 const refreshConnection=useCallback(async()=>{
  try{const status=await authFetch('/api/integrations/google/connection');if(mounted.current)setConnection(status);}catch(e){if(mounted.current)setError(readableError(e));}
 },[]);
 useEffect(()=>{void refreshConnection();void supabaseBrowser().from('projects').select('id,title,owner_id,description,created_at,updated_at').then(({data,error})=>{if(!error)setProjects((data||[]) as Project[]);});},[refreshConnection]);
 const load=useCallback(async(folderId:string,term:string,pageToken?:string,currentView=view)=>{
  const request=++requestId.current;
  if(pageToken)setPaging(true);else setBusy(true);setError('');
  try{const sp=new URLSearchParams({view:currentView});if(folderId!=='root')sp.set('folder',folderId);if(term)sp.set('search',term);if(pageToken)sp.set('page',pageToken);
   const result=await authFetch(`/api/integrations/google/files?${sp}`) as DrivePage;
   if(request!==requestId.current||!mounted.current)return;
   setItems(old=>pageToken?Array.from(new Map([...old,...result.files].map(file=>[file.id,file])).values()):result.files);setNextPage(result.nextPageToken);
   if(result.incompleteSearch)setNotice('Google reported a partial search. Try another search term.');
  }catch(e){if(request===requestId.current&&mounted.current)setError(readableError(e));}finally{if(request===requestId.current&&mounted.current){setBusy(false);setPaging(false);}}
 },[view]);
 useEffect(()=>{if(connection?.connected)void load(folder,query);else{setItems([]);setNextPage(null);}},[connection?.connected,folder,query,load]);
 async function connect(){setConnecting(true);setError('');try{const {url}=await authFetch('/api/integrations/google/start',{method:'POST'});window.location.assign(url);}catch(e){setError(readableError(e));setConnecting(false);}}
 async function disconnect(){
  setConnecting(true);setError('');try{await authFetch('/api/integrations/google/connection',{method:'DELETE'});setConnection({connected:false,email:null});setNotice('Google Drive disconnected. Your Google Drive files were not deleted.');}catch(e){setError(readableError(e));}finally{setConnecting(false);}}
 function changeView(next:'all'|'mydrive'|'shared'|'starred'){setView(next);setFolder('root');setSearch('');setQuery('');setCrumbs([{id:'root',name:next==='all'?'All files':next==='mydrive'?'My Drive':next==='shared'?'Shared with me':'Starred'}]);}
 function goFolder(f:DriveFile){setSearch('');setQuery('');setFolder(f.id);setCrumbs(old=>[...old,{id:f.id,name:f.name}]);}
 function goCrumb(index:number){setSearch('');setQuery('');const target=crumbs[index];setCrumbs(old=>old.slice(0,index+1));setFolder(target.id);}
 // Google Drive is a file picker, not the review player. For supported media,
 // clicking its filename should attach it to the chosen project and OPEN Review Studio.
 // Keep each linked asset ID so a second click doesn't create another version/asset.
 function linkedKey(f:DriveFile){return `${projectId}:${targetVersion}:${f.id}`;}
 async function link(f:DriveFile){
  if(!projectId){setError('First choose a Review destination project above, then click the video to open Review Studio.');return;}
  const key=linkedKey(f);
  if(linking[key])return;
  if(linked[key]){router.push(`/project/${projectId}/review?asset=${encodeURIComponent(linked[key])}`);return;}
  setLinking(old=>({...old,[key]:true}));setError('');setNotice('');
  try{
   const result=await authFetch('/api/integrations/google/import',{method:'POST',body:JSON.stringify({projectId,fileId:f.id,...(targetVersion?{assetId:targetVersion}:{})})}) as {assetId:string};
   if(!result.assetId)throw new Error('Google Drive file linked, but the review asset ID was not returned. Open it from Projects.');
   setLinked(old=>({...old,[key]:result.assetId}));
   router.push(`/project/${projectId}/review?asset=${encodeURIComponent(result.assetId)}`);
  }catch(e){setError(readableError(e));}finally{setLinking(old=>({...old,[key]:false}));}
 }
 const folderFirst=useMemo(()=>items.slice().sort((a,b)=>Number(b.mimeType===folderMime)-Number(a.mimeType===folderMime)||a.name.localeCompare(b.name)),[items]);
 return <AppShell user={user}><div className="drive-page">
  <div className="drive-heading"><h1>Google Drive</h1><p>Link video, images, and audio to a project. Your original files stay in Drive.</p></div>
  {report==='connected'&&<div className="message success" role="status">Google Drive access granted. Your files are available below.</div>}
  {report==='denied'&&<div className="message error">You did not grant Google Drive access.</div>}
  {['expired','failed','needs-connect'].includes(report||'')&&<div className="message error">Drive authorization was not completed. Click Connect Google Drive to retry. Check your Google OAuth credentials and migration SQL.</div>}
  {error&&<div className="message error" role="alert">{error} {!connection&&<button className="text-link" onClick={()=>void refreshConnection()}>Try again</button>}</div>}
  {notice&&<div className="message success" role="status">{notice}</div>}
  <div className="drive-connection"><div className="drive-connection-left"><span className={`drive-connection-icon ${connection?.connected?'on':''}`}>{connection?.connected?<CheckCircle2 size={25}/>:<Cloud size={25}/>}</span><div><b>{connection?.connected?'Google Drive connected':connection?'Connect your Google account':'Checking Google connection…'}</b><small>{connection?.connected?connection.email:'No file uploads or file copies required'}</small></div></div><div className="drive-connection-buttons">{connection?.connected?<><button className="btn btn-secondary btn-sm" onClick={()=>void load(folder,query)} disabled={busy}><RefreshCw size={15}/> Refresh</button><button className="btn btn-secondary btn-sm" disabled={connecting} onClick={()=>setConfirmDisconnect(true)}><Unplug size={15}/> Disconnect</button></>:<button className="btn btn-primary" onClick={()=>void connect()} disabled={!connection||connecting}>{connecting?<Loader2 size={17} className="rotating"/>:<Link2 size={17}/>} Connect Google Drive</button>}</div></div>
  {connection?.connected&&<><div className="drive-toolbar"><div className="drive-project"><label htmlFor="drive-project">Review destination</label><select id="drive-project" value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Choose a project…</option>{projects.map(p=><option value={p.id} key={p.id}>{p.title}</option>)}</select>{targetVersion&&<small className="drive-version-destination">Linking a new version to the selected asset</small>}</div><div className="drive-search"><Search size={18}/><form onSubmit={e=>{e.preventDefault();setQuery(search.trim());}}><input aria-label="Search Google Drive files" placeholder="Search all files in Google Drive" value={search} onChange={e=>setSearch(e.target.value)}/></form>{query&&<button title="Clear search" onClick={()=>{setQuery('');setSearch('');}}>Clear</button>}</div></div>
  <div className="drive-tabs">{([{id:'all',label:'All files'},{id:'mydrive',label:'My Drive'},{id:'shared',label:'Shared with me'},{id:'starred',label:'Starred'}] as const).map(t=><button key={t.id} className={view===t.id?'active':''} aria-pressed={view===t.id} onClick={()=>changeView(t.id)}>{t.label}</button>)}</div>
  <div className="drive-files-panel"><div className="drive-path"><div className="drive-crumbs">{query?<><Search size={16}/> Results for “{query}”</>:crumbs.map((c,i)=><span key={c.id}><button onClick={()=>goCrumb(i)}>{c.name}</button>{i<crumbs.length-1&&<ChevronRight size={15}/>}</span>)}</div><small>{items.length} loaded</small></div>
  <div className="drive-list-head"><span>Name</span><span>Modified</span><span>Size</span><span>Action</span></div>
  <div className="drive-files" aria-busy={busy} inert={busy}>{busy&&!items.length?<SkeletonRows/>:folderFirst.length?folderFirst.map(f=><div className="drive-file" key={f.id}><div className="drive-file-name"><span className={`drive-file-icon ${f.mimeType===folderMime?'folder':kind(f)||'other'}`}>{f.mimeType===folderMime?<Folder size={21}/>:kind(f)==='video'?<FileVideo size={21}/>:kind(f)==='image'?<FileImage size={21}/>:kind(f)==='audio'?<FileAudio size={21}/>:<File size={21}/>}</span><div><button className="drive-filename" onClick={()=>f.mimeType===folderMime?goFolder(f):kind(f)?void link(f):openFile(f)}>{f.name}</button><small>{f.mimeType===folderMime?'Folder':kind(f)?`${kind(f)!.toUpperCase()} · Ready for review`:'Google Drive file · Open in Drive'}</small></div></div><span className="drive-secondary">{f.modifiedTime?new Date(f.modifiedTime).toLocaleDateString():'—'}</span><span className="drive-secondary">{f.size?fmtBytes(Number(f.size)):'—'}</span><div className="drive-file-actions">{f.mimeType===folderMime?<button className="btn btn-secondary btn-sm" onClick={()=>goFolder(f)}>Open <ArrowRight size={15}/></button>:kind(f)?<button className="btn btn-primary btn-sm" disabled={!projectId||linking[linkedKey(f)]} onClick={()=>void link(f)}>{linked[linkedKey(f)]?<><Video size={15}/> Open review</>:linking[linkedKey(f)]?<><Loader2 size={15} className="rotating"/> Opening</>:<><Video size={15}/> Open in Review Studio</>}</button>:<button className="btn btn-secondary btn-sm" onClick={()=>openFile(f)}>View <ExternalLink size={14}/></button>}</div></div>):<div className="drive-empty"><CloudOff size={34}/><b>No files found</b><p>{query?'Try a different keyword.':'This folder contains no accessible files.'}</p></div>}</div>
  {nextPage&&<div className="drive-next"><button className="btn btn-secondary" disabled={paging} onClick={()=>void load(folder,query,nextPage)}>{paging?'Loading…':'Load more Google Drive files'} <ArrowRight size={16}/></button></div>}</div>
  <div className="drive-foot"><ShieldCheck size={18}/> Your Drive files remain in Google Drive. Only the review metadata (comments, versions, status) is stored in Supabase. Streaming access uses short-lived links from our server. <button onClick={()=>router.push(projectId?`/project/${projectId}`:'/')}>Back to project <ArrowRight size={15}/></button></div></>}
  {connection&&!connection.connected&&<div className="drive-getting-started"><h2>How it works</h2><div><span>1</span><p>Sign in with Google and grant read-only Drive permission.</p></div><div><span>2</span><p>All accessible folders/files appear here. Link any video, image or audio to a FreeFrame project.</p></div><div><span>3</span><p>Review directly from Drive with timestamps, team feedback, approvals and share links.</p></div><p className="drive-limit-note">The initial release supports Google Drive. MEGA and other cloud storage connectors require separate provider APIs and permissions.</p></div>}
 </div>{confirmDisconnect&&<Dialog open title="Disconnect Google Drive" busy={connecting} onClose={()=>setConfirmDisconnect(false)}><h2>Disconnect Google Drive?</h2><p>Already linked review files will stop streaming until you reconnect the same Google account. Your original files will not be deleted.</p>{error&&<div className="message error" role="alert">{error}</div>}<div className="modal-actions"><button className="btn btn-secondary" disabled={connecting} onClick={()=>setConfirmDisconnect(false)}>Cancel</button><button className="btn btn-danger" disabled={connecting} onClick={()=>void disconnect().then(()=>setConfirmDisconnect(false))}>{connecting?'Disconnecting…':'Disconnect'}</button></div></Dialog>}</AppShell>;
}
