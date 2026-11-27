'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import {ArrowLeft,Check,CheckSquare,ChevronDown,ChevronRight,Cloud,FileAudio,FileImage,FileVideo,Folder,FolderOpen,Grid2X2,Image as ImageIcon,Layers3,Link2,List,Loader2,MoreHorizontal,MoveRight,Plus,Search,Shield,SlidersHorizontal,SortDesc,Trash2,Upload,Users,Video,X} from 'lucide-react';
import type {User} from '@supabase/supabase-js';
import {AuthGate} from '@/components/AuthGate';
import AppShell from '@/components/AppShell';
import FileCover from '@/components/FileCover';
import Dialog from '@/components/ui/Dialog';
import { SkeletonRows } from '@/components/ui/LoadingState';
import { projectVersions,projectApprovals } from '@/lib/project-data';
import { presentationCache } from '@/lib/client-cache.mjs';
import {authFetch,supabaseBrowser} from '@/lib/supabase-browser';
import {readableError,fmtBytes} from '@/lib/utils';
import {dismissUploadsForAsset,queueMuxUploads,useUploads} from '@/lib/upload-manager';
import {WORKFLOW_STATUSES,statusTone} from '@/lib/workflow-status';
import {buildLibraryIndex} from '@/lib/library-index.mjs';
import {useDismissibleMenu} from '@/hooks/useDismissibleMenu';
import type {Asset,Version,Project,Role} from '@/lib/types';

type FolderRow={id:string;project_id:string;parent_id:string|null;name:string;created_at:string};
type Order='recent'|'name'|'oldest';
type DeleteTarget={kind:'asset'|'mux_version';id:string;name:string;version?:number};
export default function ProjectFilesPage(){return <AuthGate>{user=><Files user={user}/>}</AuthGate>}
function Files({user}:{user:User}){
 const {id}=useParams<{id:string}>();const router=useRouter();const fileRef=useRef<HTMLInputElement>(null);
 const [project,setProject]=useState<Project|null>(null),[role,setRole]=useState<Role>('viewer');
 const [folders,setFolders]=useState<FolderRow[]>([]),[assets,setAssets]=useState<Asset[]>([]),[versions,setVersions]=useState<Version[]>([]),[approvals,setApprovals]=useState<{asset_version_id:string;status:string}[]>([]);
 const [folderId,setFolderId]=useState<string|null>(null),[search,setSearch]=useState(''),[statusSearch,setStatusSearch]=useState(''),[statusFilter,setStatusFilter]=useState<string|null>(null),[statusMenu,setStatusMenu]=useState<string|null>(null),[customStatus,setCustomStatus]=useState(''),[statusBusy,setStatusBusy]=useState<string|null>(null),[sort,setSort]=useState<Order>('recent'),[list,setList]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[showAllMux,setShowAllMux]=useState(false),[cancelingVersion,setCancelingVersion]=useState<string|null>(null);
 const uploadJobs=useUploads().filter(job=>job.projectId===id&&job.userId===user.id);
 const [modal,setModal]=useState<'create'|'rename'|'move'|'delete'|null>(null),[folderName,setFolderName]=useState('');
 const [selected,setSelected]=useState<string|null>(null),[target,setTarget]=useState<string>('root');
 const [deleteTarget,setDeleteTarget]=useState<DeleteTarget|null>(null),[deleteBusy,setDeleteBusy]=useState(false);
 const canEdit=loaded&&(role==='owner'||role==='editor');
 const closeMenus=useCallback(()=>{setSelected(null);setStatusMenu(null);},[]);
 useDismissibleMenu(!!statusMenu||!!selected&&!modal,closeMenus,'.ff-card-menu,.ff-card-status-wrap');
 const refresh=useCallback(async()=>{
  const sb=supabaseBrowser();try{
   const [{data:p,error:pe},{data:m,error:me},{data:a,error:ae},{data:v,error:ve},{data:f,error:fe},{data:ap,error:ape}]=await Promise.all([
    sb.from('projects').select('*').eq('id',id).single(),sb.from('project_members').select('role').eq('project_id',id).eq('user_id',user.id).maybeSingle(),
    sb.from('assets').select('*').eq('project_id',id),projectVersions(sb,id),
    sb.from('project_folders').select('*').eq('project_id',id).order('name'),projectApprovals(sb,id)
   ]);
   if(pe)throw pe;if(me)throw me;if(ae)throw ae;if(ve)throw ve;if(ape)throw ape;if(fe)throw new Error('Run supabase/media-library-migration.sql in Supabase first. '+fe.message);
   setProject(p as Project);setRole((m?.role||'viewer') as Role);setAssets((a||[]) as Asset[]);setVersions((v||[]) as Version[]);setFolders((f||[]) as FolderRow[]);setApprovals((ap||[]) as {asset_version_id:string;status:string}[]);setError('');
   presentationCache.clear();
  }catch(err){setError(readableError(err));}finally{setLoaded(true);}
 },[id,user.id]);
 useEffect(()=>{void refresh();},[refresh]);
 const settledUploads=uploadJobs.filter(job=>job.stage==='ready'||job.stage==='failed').map(job=>`${job.id}:${job.stage}`).join('|');
 const lastSettled=useRef('');
 useEffect(()=>{if(settledUploads&&settledUploads!==lastSettled.current){lastSettled.current=settledUploads;void refresh();}},[settledUploads,refresh]);
 const muxVersions=useMemo(()=>versions.filter(version=>version.source_provider==='mux').sort((a,b)=>b.created_at.localeCompare(a.created_at)),[versions]);
 const muxReady=muxVersions.filter(version=>version.status==='ready');
 const activeVersionIds=new Set(uploadJobs.map(job=>job.versionId));
 const muxPending=muxVersions.filter(version=>version.status==='uploading'&&!activeVersionIds.has(version.id));
 const pendingVersionIds=muxPending.map(version=>version.id).join('|');
 const muxActiveJobs=uploadJobs.filter(job=>!['ready','failed'].includes(job.stage));
 const muxFailedJobs=uploadJobs.filter(job=>job.stage==='failed');
 const displayedMuxReady=showAllMux?muxReady:muxReady.slice(0,4);
 useEffect(()=>{if(!pendingVersionIds)return;const timer=setInterval(()=>{if(!document.hidden)void refresh();},15000);return()=>clearInterval(timer);},[pendingVersionIds,refresh]);
 const crumbs=useMemo(()=>{const out:FolderRow[]=[];let current=folderId;const visited=new Set<string>();while(current&&!visited.has(current)){visited.add(current);const folder=folders.find(f=>f.id===current);if(!folder)break;out.unshift(folder);current=folder.parent_id;}return out;},[folderId,folders]);
 const index=useMemo(()=>buildLibraryIndex(assets,versions,approvals,WORKFLOW_STATUSES),[assets,versions,approvals]);
 const latest=useCallback((asset:Asset)=>index.latest.get(asset.id),[index]);
 const reviewStatus=useCallback((asset:Asset)=>index.decisions.get(latest(asset)?.id||'')||'In review',[index,latest]);
 const assetStatus=useCallback((asset:Asset)=>index.statuses.get(asset.id)||'Needs Review',[index]);
 const statusOptions=index.options,statusCounts=index.statusCounts;
 const visibleFolders=useMemo(()=>statusFilter?[]:folders.filter(f=>search?f.name.toLowerCase().includes(search.toLowerCase()):f.parent_id===folderId),[folders,folderId,search,statusFilter]);
 const visibleAssets=useMemo(()=>assets.filter(a=>{
  if(a.current_version===0)return false;
  if(search&&!a.name.toLowerCase().includes(search.toLowerCase()))return false;
  return statusFilter?assetStatus(a)===statusFilter:search?true:a.folder_id===folderId;
 }).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='oldest'?a.created_at.localeCompare(b.created_at):b.created_at.localeCompare(a.created_at)),[assets,assetStatus,folderId,search,sort,statusFilter]);
 const folderSummaries=useMemo(()=>{
  const childFolders=new Map<string,FolderRow[]>(),childAssets=new Map<string,Asset[]>();
  for(const folder of folders){if(folder.parent_id)childFolders.set(folder.parent_id,[...(childFolders.get(folder.parent_id)||[]),folder]);}
  for(const asset of assets){if(asset.folder_id)childAssets.set(asset.folder_id,[...(childAssets.get(asset.folder_id)||[]),asset]);}
  const summaries=new Map<string,{count:number;previews:Asset[]}>();
  for(const folder of folders){
   const queue=[folder.id],seen=new Set<string>(queue),previews:Asset[]=[];let count=0;
   for(let index=0;index<queue.length;index++){
    const current=queue[index];
    for(const child of childFolders.get(current)||[]){if(!seen.has(child.id)){seen.add(child.id);queue.push(child.id);count++;}}
    for(const asset of childAssets.get(current)||[]){count++;if(asset.current_version>0&&previews.length<3)previews.push(asset);}
   }
   summaries.set(folder.id,{count,previews});
  }
  return summaries;
 },[folders,assets]);
 const sizeSum=visibleAssets.reduce((sum,a)=>sum+(latest(a)?.size_bytes||0),0);
 async function updateStatus(assetId:string,status:string|null){setStatusBusy(assetId);setError('');try{const result=await authFetch('/api/assets/status',{method:'PATCH',body:JSON.stringify({projectId:id,assetId,status})}) as {status:string|null};setAssets(old=>old.map(a=>a.id===assetId?{...a,workflow_status:result.status}:a));setStatusMenu(null);setCustomStatus('');setMessage(status?`Status set to ${status}.`:'Status reset to review result.');}catch(err){setError(readableError(err));}finally{setStatusBusy(null);}}
 async function organize(action:string,data:Record<string,unknown>){setBusy(true);setError('');try{await authFetch('/api/library/organize',{method:'POST',body:JSON.stringify({projectId:id,action,...data})});await refresh();setModal(null);setSelected(null);setFolderName('');setMessage('Changes saved to your Supabase workspace.');}catch(err){setError(readableError(err));}finally{setBusy(false);}}
 function openModal(kind:'rename'|'delete'|'move',folder:string){setSelected(folder);setModal(kind);setFolderName(folders.find(f=>f.id===folder)?.name||assets.find(a=>a.id===folder)?.name||'');setTarget('root');}
 function openAsset(a:Asset){router.push(`/project/${id}/review?asset=${encodeURIComponent(a.id)}`)}
 function uploadFiles(files:FileList|null){if(!files?.length)return;setMessage('');setError('');const selectedFiles=Array.from(files);
  queueMuxUploads(selectedFiles,id,user.id);
  if(fileRef.current)fileRef.current.value='';
 }
 async function cancelPending(versionId:string){setCancelingVersion(versionId);setError('');try{await authFetch('/api/upload/abort',{method:'POST',body:JSON.stringify({versionId})});await refresh();setMessage('Pending upload cancelled.');}catch(err){setError(readableError(err));}finally{setCancelingVersion(null);}}
 async function deleteSelected(){if(!deleteTarget||deleteBusy)return;setDeleteBusy(true);setError('');try{
  const result=await authFetch(deleteTarget.kind==='asset'?'/api/assets/delete':'/api/assets/version/delete',{method:'POST',body:JSON.stringify(deleteTarget.kind==='asset'?{assetId:deleteTarget.id}:{versionId:deleteTarget.id})}) as {deletedFile?:boolean};
  const deletedVersion=deleteTarget.kind==='mux_version'?versions.find(version=>version.id===deleteTarget.id):null;
  if(deleteTarget.kind==='asset')dismissUploadsForAsset(deleteTarget.id);
  else if(deletedVersion)dismissUploadsForAsset(deletedVersion.asset_id,result.deletedFile?undefined:deletedVersion.id);
  await refresh();setMessage(deleteTarget.kind==='asset'||result.deletedFile?'File and its hosted videos were permanently deleted.':'Mux version and its review data were permanently deleted.');setDeleteTarget(null);setSelected(null);
 }catch(err){setError(readableError(err));}finally{setDeleteBusy(false);}}
 const isFolder=selected?folders.some(f=>f.id===selected):false;
 const destinations=folders.filter(f=>f.id!==selected);
 return <AppShell user={user}><div className="ff-library">
  <input ref={fileRef} hidden type="file" multiple accept="video/*" onChange={e=>void uploadFiles(e.target.files)}/>
  <div className="ff-library-head"><div className="ff-library-path"><button onClick={()=>router.push('/dashboard')}><ArrowLeft size={17}/> Projects</button><ChevronRight size={15}/><strong>{project?.title||'Project'}</strong>{crumbs.map(f=><span key={f.id}><ChevronRight size={15}/><button onClick={()=>setFolderId(f.id)}>{f.name}</button></span>)}</div><div className="ff-head-actions">{role==='owner'&&<button className="ff-toolbar-button" onClick={()=>router.push(`/project/${id}/review?panel=members`)}><Users size={17}/> Team & sharing</button>}{canEdit&&<><button className="ff-toolbar-button" onClick={()=>router.push(`/drive?project=${id}`)}><Cloud size={17}/> From Google Drive</button><button className="ff-primary" onClick={()=>fileRef.current?.click()} disabled={busy}><Upload size={16}/> Upload video</button></>}</div></div>
  <div className="ff-library-toolbar"><div className="ff-toolbar-left"><button className="ff-toolbar-button" onClick={()=>setList(v=>!v)}><SlidersHorizontal size={17}/> Appearance</button><span className="ff-toolbar-description"><Layers3 size={17}/> Versions visible</span><label className="ff-sort"><SortDesc size={17}/> <select value={sort} onChange={e=>setSort(e.target.value as Order)}><option value="recent">Sorted by Date Uploaded</option><option value="name">Sorted by Name</option><option value="oldest">Oldest first</option></select></label></div><div className="ff-toolbar-right"><label className="ff-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files & folders"/></label>{canEdit&&<button className="ff-square" title="New folder" onClick={()=>{setModal('create');setFolderName('');}}><Plus size={19}/></button>}</div></div>
  {error&&<div className="ff-banner-error" role="alert">{error}</div>}{message&&<div className="ff-banner-info">{message}</div>}
  {loaded&&<section className="ff-mux-section" aria-label="Mux uploads"><div className="ff-mux-heading"><div><span className="ff-mux-icon"><Cloud size={18}/></span><div><h2>Mux uploads</h2><p>Track uploads and open videos ready for review.</p></div></div><span className="ff-mux-count">{muxReady.length} ready · {muxActiveJobs.length+muxPending.length} in progress</span></div>
   {muxActiveJobs.map(job=><div className="ff-mux-row" key={job.id}><div className="ff-mux-row-main"><Video size={17}/><div><strong title={job.name}>{job.name}</strong><small>{fmtBytes(job.size)} · {job.stage==='queued'?'Waiting to upload':job.stage==='preparing'?'Preparing video':job.stage==='processing'?'Upload complete; Mux is processing':`${job.percent}% uploaded`}</small></div></div><span className="ff-mux-state pending">{job.stage==='uploading'?`${job.percent}%`:job.stage==='processing'?'Processing':'Waiting'}</span>{job.stage==='uploading'&&<div className="ff-mux-row-track" role="progressbar" aria-label={`Upload progress for ${job.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.percent}><div style={{width:`${job.percent}%`}}/></div>}</div>)}
   {muxPending.map(version=><div className="ff-mux-row" key={version.id}><div className="ff-mux-row-main"><Video size={17}/><div><strong>{assets.find(asset=>asset.id===version.asset_id)?.name||'Video'}</strong><small>V{version.version} · {fmtBytes(version.size_bytes)} · Waiting for Mux</small></div></div><span className="ff-mux-state pending">Pending</span>{canEdit&&version.created_by===user.id&&<button className="ff-mux-open" disabled={cancelingVersion===version.id} onClick={()=>void cancelPending(version.id)}>{cancelingVersion===version.id?'Cancelling…':'Cancel'}</button>}</div>)}
   {muxFailedJobs.map(job=><div className="ff-mux-row" key={job.id}><div className="ff-mux-row-main"><Video size={17}/><div><strong title={job.name}>{job.name}</strong><small>{job.error||'Upload failed'}</small></div></div><span className="ff-mux-state failed">Failed</span></div>)}
   {displayedMuxReady.map(version=>{const asset=assets.find(item=>item.id===version.asset_id);return <div className="ff-mux-row" key={version.id}><div className="ff-mux-row-main"><Video size={17}/><div><strong>{asset?.name||'Video'}</strong><small>V{version.version} · {fmtBytes(version.size_bytes)} · {new Date(version.created_at).toLocaleDateString()}</small></div></div><span className="ff-mux-state ready">Ready</span><button className="ff-mux-open" onClick={()=>router.push(`/project/${id}/review?asset=${version.asset_id}&version=${version.id}`)}>Open review <ChevronRight size={15}/></button>{canEdit&&<div className="ff-card-menu"><button aria-label={`Manage ${asset?.name||'video'} version ${version.version}`} aria-expanded={selected===version.id} onClick={()=>setSelected(selected===version.id?null:version.id)}><MoreHorizontal size={18}/></button>{selected===version.id&&<div className="ff-popmenu"><button onClick={()=>openModal('rename',version.asset_id)}>Rename file</button><button onClick={()=>openModal('move',version.asset_id)}>Move file</button><button className="danger" onClick={()=>{setDeleteTarget({kind:'mux_version',id:version.id,name:asset?.name||'Video',version:version.version});setSelected(null);}}>Delete this version</button><button className="danger" onClick={()=>{setDeleteTarget({kind:'asset',id:version.asset_id,name:asset?.name||'Video'});setSelected(null);}}>Delete entire file</button></div>}</div>}</div>})}
   {!muxActiveJobs.length&&!muxPending.length&&!muxFailedJobs.length&&!muxReady.length&&<div className="ff-mux-empty">No Mux videos yet. Use <strong>Upload video</strong> to add one here.</div>}
   {muxReady.length>4&&<button className="ff-mux-more" onClick={()=>setShowAllMux(value=>!value)}>{showAllMux?'Show fewer videos':`Show all ${muxReady.length} videos`}</button>}
  </section>}
  <div className="ff-library-content"><aside className="ff-status-panel" aria-label="Filter files by status"><div className="ff-status-panel-head"><CheckSquare size={17}/><strong>Workflow status</strong></div><label className="ff-status-search"><Search size={17}/><input value={statusSearch} onChange={e=>setStatusSearch(e.target.value)} placeholder="Search statuses" aria-label="Search statuses"/></label><div className="ff-status-list"><button className={`ff-status-row ff-status-all ${statusFilter===null?'active':''}`} aria-pressed={statusFilter===null} onClick={()=>setStatusFilter(null)}><span>All statuses</span><small>{assets.filter(a=>a.current_version>0).length}</small></button>{statusOptions.filter(status=>status.toLowerCase().includes(statusSearch.trim().toLowerCase())).map(status=><button key={status} className={`ff-status-row ${statusFilter===status?'active':''}`} aria-pressed={statusFilter===status} onClick={()=>{setStatusFilter(status);setFolderId(null);}}><span className={`ff-status-chip tone-${statusTone(status)}`}>{status}</span><small>{statusCounts.get(status)||0}</small></button>)}{!statusOptions.some(status=>status.toLowerCase().includes(statusSearch.trim().toLowerCase()))&&<p className="ff-status-no-match">No matching statuses</p>}</div><p className="ff-status-panel-note">Choose a status to filter files. Editors can change a file's status from its card.</p></aside>
  <div className="ff-library-body"><header className="ff-library-section"><div><button className="ff-back" onClick={()=>{setFolderId(null);setStatusFilter(null);}} disabled={!folderId&&!statusFilter}>All files</button><ChevronRight size={14}/>{statusFilter?<b>{statusFilter}</b>:folderId?<b>{folders.find(f=>f.id===folderId)?.name}</b>:<b>Root</b>}</div><span>{visibleFolders.length} Folders · {visibleAssets.length} Files · {fmtBytes(sizeSum)}</span></header>
   {!loaded?<SkeletonRows count={5}/>:<>
    {!!visibleFolders.length&&<div className={list?'ff-folder-grid ff-list-mode':'ff-folder-grid'}>{visibleFolders.map(f=>{
     const {count,previews}=folderSummaries.get(f.id)??{count:0,previews:[] as Asset[]};
     return <article className="ff-folder-card" key={f.id}>
      <button className={`ff-folder-art ${previews.length?'has-media':'is-empty'}`} onClick={()=>setFolderId(f.id)} aria-label={`Open ${f.name}`}>
       <span className="ff-folder-main">{previews[0]?<FileCover kind={previews[0].kind} version={latest(previews[0])}/>:<Folder size={31}/>}</span>
       <span className="ff-folder-mini">{previews[1]?<FileCover kind={previews[1].kind} version={latest(previews[1])}/>:<Folder size={22}/>}</span>
       <span className="ff-folder-mini">{previews[2]?<FileCover kind={previews[2].kind} version={latest(previews[2])}/>:<Folder size={22}/>}</span>
      </button>
      <div className="ff-card-meta"><div><button className="ff-card-title" onClick={()=>setFolderId(f.id)} title={f.name}>{f.name}</button><p>{count} {count===1?'item':'items'}</p></div>{canEdit&&<div className="ff-card-menu"><button aria-label={`Manage ${f.name}`} onClick={()=>setSelected(selected===f.id?null:f.id)}><MoreHorizontal size={19}/></button>{selected===f.id&&<div className="ff-popmenu"><button onClick={()=>openModal('rename',f.id)}>Rename</button><button onClick={()=>openModal('move',f.id)}>Move folder</button><button onClick={()=>openModal('delete',f.id)}>Delete empty folder</button></div>}</div>}</div>
     </article>})}</div>}
    {!!visibleAssets.length&&<><div className="ff-section-subtitle">Media <span>{visibleAssets.length} assets</span></div><div className={list?'ff-file-grid ff-list-mode':'ff-file-grid'}>{visibleAssets.map(a=>{const version=latest(a),count=index.counts.get(a.id)||0;const decision=reviewStatus(a),status=assetStatus(a);return <article key={a.id} className="ff-file-card" style={{zIndex:statusMenu===a.id?5:undefined}}><button className="ff-video-cover" onClick={()=>openAsset(a)} title={`Open ${a.name}`}><FileCover kind={a.kind} version={version}/><span className="ff-source-label">{version?.source_provider==='google_drive'?<Cloud size={13}/>:<Upload size={13}/>} {version?.source_provider==='google_drive'?'DRIVE':version?.source_provider==='mux'?'MUX':'UPLOAD'}</span><b className="ff-version-badge">V{a.current_version}</b><span className="ff-file-cover-note">{version?.duration_seconds&&Number.isFinite(version.duration_seconds)?`${String(Math.floor(version.duration_seconds/60)).padStart(2,'0')}:${String(Math.floor(version.duration_seconds%60)).padStart(2,'0')}`:`${a.kind.toUpperCase()} · ${fmtBytes(version?.size_bytes||0)}`}</span></button><div className="ff-file-card-info"><div className="ff-file-name-row"><button onClick={()=>openAsset(a)} title={a.name}>{a.name}</button>{canEdit&&<div className="ff-card-menu"><button aria-label={`Move ${a.name}`} onClick={()=>setSelected(selected===a.id?null:a.id)}><MoreHorizontal size={18}/></button>{selected===a.id&&<div className="ff-popmenu"><button onClick={()=>openModal('rename',a.id)}>Rename</button><button onClick={()=>{setSelected(a.id);setTarget('root');setModal('move')}}>Move to folder</button><button onClick={()=>openAsset(a)}>Open review</button><button className="danger" onClick={()=>{setDeleteTarget({kind:'asset',id:a.id,name:a.name});setSelected(null);}}>Delete file</button></div>}</div>}</div><p>V{a.current_version} latest · {count} version{count===1?'':'s'}</p><div className="ff-card-status-wrap">{canEdit?<button className="ff-status-button" aria-expanded={statusMenu===a.id} aria-label={`Change status for ${a.name}`} onClick={()=>{setStatusMenu(statusMenu===a.id?null:a.id);setSelected(null);setCustomStatus('');}}><span className={`ff-status-chip tone-${statusTone(status)}`}>{status}</span><ChevronDown size={15}/></button>:<div className="ff-status-display"><span className={`ff-status-chip tone-${statusTone(status)}`}>{status}</span></div>}{statusMenu===a.id&&canEdit&&<div className="ff-status-menu"><div className="ff-status-menu-title">Set file status</div><div className="ff-status-menu-list">{statusOptions.map(option=><button key={option} className={status===option?'selected':''} disabled={statusBusy===a.id} onClick={()=>void updateStatus(a.id,option)}><span className={`ff-status-chip tone-${statusTone(option)}`}>{option}</span>{status===option&&<Check size={15}/>}</button>)}</div><div className="ff-status-menu-create"><input value={customStatus} onChange={e=>setCustomStatus(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&customStatus.trim())void updateStatus(a.id,customStatus.trim());}} maxLength={40} placeholder="New custom status" aria-label="New custom status"/><button disabled={!customStatus.trim()||statusBusy===a.id} onClick={()=>void updateStatus(a.id,customStatus.trim())} aria-label="Add custom status"><Plus size={16}/></button></div><button className="ff-status-reset" disabled={statusBusy===a.id} onClick={()=>void updateStatus(a.id,null)}>Use review decision</button></div>}</div>{decision!=='In review'&&<small className="ff-card-review-decision">Review decision: {decision}</small>}</div></article>})}</div></>}
    {!visibleFolders.length&&!visibleAssets.length&&<div className="ff-lib-empty"><FolderOpen size={42}/><h3>{search?'No matching files':statusFilter?`No files marked ${statusFilter}`:'This folder is empty'}</h3><p>{statusFilter?'Choose another status or change a file status from its card.':muxActiveJobs.length||muxPending.length?'Your Mux video will appear here when processing finishes.':'Upload a video to Mux or link a file from Google Drive.'}</p>{canEdit&&!statusFilter&&!muxActiveJobs.length&&!muxPending.length&&<button className="ff-primary" onClick={()=>fileRef.current?.click()}><Upload size={16}/> Upload video</button>}</div>}
   </>}
  </div>
  </div>
  <div className="ff-library-foot"><Shield size={15}/> Project metadata and review comments are stored in Supabase. Uploaded videos stream from Mux; linked files stay in Google Drive.</div>
 </div>
 {modal&&<Dialog open title={modal==='create'?'New folder':modal==='rename'?'Rename item':modal==='move'?'Move item':'Delete folder'} busy={busy} onClose={()=>setModal(null)} className="ff-folder-modal"><div className="modal-top"><b>{modal==='create'?'New folder':modal==='rename'?isFolder?'Rename folder':'Rename file':modal==='move'?'Move item':'Delete folder'}</b><button className="icon-btn" onClick={()=>setModal(null)}><X size={19}/></button></div>
  {modal==='create'||modal==='rename'?<><label>{modal==='rename'&&!isFolder?'File name':'Folder name'}<input autoFocus maxLength={120} value={folderName} onChange={e=>setFolderName(e.target.value)} placeholder="e.g. Final videos"/></label><button disabled={busy||!folderName.trim()} className="btn btn-primary wide" onClick={()=>void organize(modal==='create'?'create_folder':isFolder?'rename_folder':'rename_asset',modal==='create'?{name:folderName,parentId:folderId}:{...(isFolder?{folderId:selected}:{assetId:selected}),name:folderName})}>{busy?'Saving…':modal==='rename'?'Save changes':'Create folder'}</button></>:modal==='move'?<><p>Choose the destination folder. This changes only the FreeFrame organization—not your original Drive file.</p><label>Destination<select value={target} onChange={e=>setTarget(e.target.value)}><option value="root">Project root</option>{destinations.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><button disabled={busy} className="btn btn-primary wide" onClick={()=>void organize(isFolder?'move_folder':'move_asset',isFolder?{folderId:selected,targetFolderId:target==='root'?null:target}:{assetId:selected,targetFolderId:target==='root'?null:target})}>Move item</button></>:<><p>Only empty folders can be deleted. Files are never deleted from Google Drive.</p><button disabled={busy} className="btn btn-danger wide" onClick={()=>void organize('delete_folder',{folderId:selected})}>Delete empty folder</button></>}
  {error&&<div className="message error">{error}</div>}
  </Dialog>}
 {deleteTarget&&<Dialog open title={deleteTarget.kind==='asset'?'Delete file':'Delete Mux version'} busy={deleteBusy} onClose={()=>setDeleteTarget(null)}><div className="modal-top"><span className="modal-icon"><Trash2 size={20}/></span><button className="icon-btn" disabled={deleteBusy} onClick={()=>setDeleteTarget(null)} aria-label="Close delete dialog"><X size={19}/></button></div><h2>{deleteTarget.kind==='asset'?'Delete this file and all versions?':`Delete version ${deleteTarget.version}?`}</h2><p><b>{deleteTarget.name}</b>{deleteTarget.kind==='asset'?' and every version will be removed from this project. Hosted Mux and R2 videos will also be permanently deleted. Linked Google Drive originals stay in Drive.':` will be permanently removed from Mux along with this version’s comments and approvals. Other versions remain. If this is the last version, the file is removed too.`}</p>{error&&<div className="message error" role="alert">{error}</div>}<div className="modal-actions"><button className="btn btn-secondary" disabled={deleteBusy} onClick={()=>setDeleteTarget(null)}>Keep file</button><button className="btn btn-danger" disabled={deleteBusy} onClick={()=>void deleteSelected()}>{deleteBusy?'Deleting…':'Delete permanently'}</button></div></Dialog>}
 </AppShell>;
}
