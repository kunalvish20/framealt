'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import {ArrowLeft,Check,CheckSquare,ChevronDown,ChevronRight,Cloud,FileAudio,FileImage,FileVideo,Folder,FolderOpen,Grid2X2,Image as ImageIcon,Layers3,Link2,List,Loader2,MoreHorizontal,MoveRight,Plus,Search,Shield,SlidersHorizontal,SortDesc,Trash2,Upload,Users,Video,X} from 'lucide-react';
import type {User} from '@supabase/supabase-js';
import {AuthGate} from '@/components/AuthGate';
import AppShell from '@/components/AppShell';
import FileCover from '@/components/FileCover';
import {authFetch,supabaseBrowser} from '@/lib/supabase-browser';
import {readableError,fmtBytes} from '@/lib/utils';
import {uploadMedia} from '@/lib/upload-client';
import {WORKFLOW_STATUSES,statusTone} from '@/lib/workflow-status';
import type {Asset,Version,Project,Role} from '@/lib/types';

type FolderRow={id:string;project_id:string;parent_id:string|null;name:string;created_at:string};
type Order='recent'|'name'|'oldest';
export default function ProjectFilesPage(){return <AuthGate>{user=><Files user={user}/>}</AuthGate>}
function Files({user}:{user:User}){
 const {id}=useParams<{id:string}>();const router=useRouter();const fileRef=useRef<HTMLInputElement>(null);
 const [project,setProject]=useState<Project|null>(null),[role,setRole]=useState<Role>('viewer');
 const [folders,setFolders]=useState<FolderRow[]>([]),[assets,setAssets]=useState<Asset[]>([]),[versions,setVersions]=useState<Version[]>([]),[approvals,setApprovals]=useState<{asset_version_id:string;status:string}[]>([]);
 const [folderId,setFolderId]=useState<string|null>(null),[search,setSearch]=useState(''),[statusSearch,setStatusSearch]=useState(''),[statusFilter,setStatusFilter]=useState<string|null>(null),[statusMenu,setStatusMenu]=useState<string|null>(null),[customStatus,setCustomStatus]=useState(''),[statusBusy,setStatusBusy]=useState<string|null>(null),[sort,setSort]=useState<Order>('recent'),[list,setList]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[uploadPct,setUploadPct]=useState(0);
 const [modal,setModal]=useState<'create'|'rename'|'move'|'delete'|null>(null),[folderName,setFolderName]=useState('');
 const [selected,setSelected]=useState<string|null>(null),[target,setTarget]=useState<string>('root');
 const canEdit=role==='owner'||role==='editor';
 const refresh=useCallback(async()=>{
  const sb=supabaseBrowser();try{
   const [{data:p,error:pe},{data:m},{data:a,error:ae},{data:v},{data:f,error:fe},{data:ap}]=await Promise.all([
    sb.from('projects').select('*').eq('id',id).single(),sb.from('project_members').select('role').eq('project_id',id).eq('user_id',user.id).maybeSingle(),
    sb.from('assets').select('*').eq('project_id',id),sb.from('asset_versions').select('*').order('version',{ascending:false}),
    sb.from('project_folders').select('*').eq('project_id',id).order('name'),sb.from('approvals').select('asset_version_id,status')
   ]);
   if(pe)throw pe;if(ae)throw ae;if(fe)throw new Error('Run supabase/media-library-migration.sql in Supabase first. '+fe.message);
   setProject(p as Project);setRole((m?.role||'viewer') as Role);setAssets((a||[]) as Asset[]);setVersions((v||[]) as Version[]);setFolders((f||[]) as FolderRow[]);setApprovals((ap||[]) as {asset_version_id:string;status:string}[]);setError('');
  }catch(err){setError(readableError(err));}finally{setLoaded(true);}
 },[id,user.id]);
 useEffect(()=>{void refresh();},[refresh]);
 const crumbs=useMemo(()=>{const out:FolderRow[]=[];let current=folderId;const visited=new Set<string>();while(current&&!visited.has(current)){visited.add(current);const folder=folders.find(f=>f.id===current);if(!folder)break;out.unshift(folder);current=folder.parent_id;}return out;},[folderId,folders]);
 const latest=(asset:Asset)=>versions.find(v=>v.asset_id===asset.id&&v.status==='ready');
 const reviewStatus=(asset:Asset)=>{const version=latest(asset),decisions=approvals.filter(x=>x.asset_version_id===version?.id);return decisions.some(x=>x.status==='changes_requested')?'Changes requested':decisions.some(x=>x.status==='approved')?'Approved':'In review';};
 const assetStatus=(asset:Asset)=>asset.workflow_status||(reviewStatus(asset)==='Approved'?'Approved':reviewStatus(asset)==='Changes requested'?'Attention':'Needs Review');
 const statusOptions=[...WORKFLOW_STATUSES,...new Set(assets.map(a=>a.workflow_status).filter((s):s is string=>!!s&&!WORKFLOW_STATUSES.some(p=>p===s)))];
 const statusCounts=new Map(statusOptions.map(status=>[status,assets.filter(a=>a.current_version>0&&assetStatus(a)===status).length]));
 const visibleFolders=useMemo(()=>statusFilter?[]:folders.filter(f=>search?f.name.toLowerCase().includes(search.toLowerCase()):f.parent_id===folderId),[folders,folderId,search,statusFilter]);
 const visibleAssets=useMemo(()=>assets.filter(a=>{
  if(a.current_version===0)return false;
  if(search&&!a.name.toLowerCase().includes(search.toLowerCase()))return false;
  return statusFilter?assetStatus(a)===statusFilter:search?true:a.folder_id===folderId;
 }).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='oldest'?a.created_at.localeCompare(b.created_at):b.created_at.localeCompare(a.created_at)),[assets,approvals,versions,folderId,search,sort,statusFilter]);
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
 async function uploadFiles(files:FileList|null){if(!files?.length)return;setBusy(true);setMessage('');setError('');try{
  for(const file of Array.from(files)){setMessage(`Uploading ${file.name}…`);await uploadMedia(file,id,setUploadPct);}
  await refresh();setMessage('Upload completed. Move files into any folder using the card menu.');
 }catch(err){setError(readableError(err));}finally{setBusy(false);setUploadPct(0);if(fileRef.current)fileRef.current.value='';}}
 const isFolder=selected?folders.some(f=>f.id===selected):false;
 const destinations=folders.filter(f=>f.id!==selected);
 return <AppShell user={user}><div className="ff-library">
  <input ref={fileRef} hidden type="file" multiple accept="video/*,image/*,audio/*" onChange={e=>void uploadFiles(e.target.files)}/>
  <div className="ff-library-head"><div className="ff-library-path"><button onClick={()=>router.push('/dashboard')}><ArrowLeft size={17}/> Projects</button><ChevronRight size={15}/><strong>{project?.title||'Project'}</strong>{crumbs.map(f=><span key={f.id}><ChevronRight size={15}/><button onClick={()=>setFolderId(f.id)}>{f.name}</button></span>)}</div><div className="ff-head-actions">{role==='owner'&&<button className="ff-toolbar-button" onClick={()=>router.push(`/project/${id}/review`)}><Users size={17}/> Team & sharing</button>}{canEdit&&<><button className="ff-toolbar-button" onClick={()=>router.push(`/drive?project=${id}`)}><Cloud size={17}/> From Google Drive</button><button className="ff-primary" onClick={()=>fileRef.current?.click()} disabled={busy}><Upload size={16}/> Upload</button></>}</div></div>
  <div className="ff-library-toolbar"><div className="ff-toolbar-left"><button className="ff-toolbar-button" onClick={()=>setList(v=>!v)}><SlidersHorizontal size={17}/> Appearance</button><span className="ff-toolbar-description"><Layers3 size={17}/> Versions visible</span><label className="ff-sort"><SortDesc size={17}/> <select value={sort} onChange={e=>setSort(e.target.value as Order)}><option value="recent">Sorted by Date Uploaded</option><option value="name">Sorted by Name</option><option value="oldest">Oldest first</option></select></label></div><div className="ff-toolbar-right"><label className="ff-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files & folders"/></label>{canEdit&&<button className="ff-square" title="New folder" onClick={()=>{setModal('create');setFolderName('');}}><Plus size={19}/></button>}</div></div>
  {error&&<div className="ff-banner-error" role="alert">{error}</div>}{message&&<div className="ff-banner-info">{message}{busy&&uploadPct>0?` ${Math.round(uploadPct)}%`:''}</div>}
  <div className="ff-library-content"><aside className="ff-status-panel" aria-label="Filter files by status"><div className="ff-status-panel-head"><CheckSquare size={17}/><strong>Status</strong></div><label className="ff-status-search"><Search size={17}/><input value={statusSearch} onChange={e=>setStatusSearch(e.target.value)} placeholder="Search statuses" aria-label="Search statuses"/></label><div className="ff-status-list"><button className={`ff-status-row ff-status-all ${statusFilter===null?'active':''}`} aria-pressed={statusFilter===null} onClick={()=>setStatusFilter(null)}><span>All statuses</span><small>{assets.filter(a=>a.current_version>0).length}</small></button>{statusOptions.filter(status=>status.toLowerCase().includes(statusSearch.trim().toLowerCase())).map(status=><button key={status} className={`ff-status-row ${statusFilter===status?'active':''}`} aria-pressed={statusFilter===status} onClick={()=>{setStatusFilter(status);setFolderId(null);}}><span className={`ff-status-chip tone-${statusTone(status)}`}>{status}</span><small>{statusCounts.get(status)||0}</small></button>)}{!statusOptions.some(status=>status.toLowerCase().includes(statusSearch.trim().toLowerCase()))&&<p className="ff-status-no-match">No matching statuses</p>}</div><p className="ff-status-panel-note">Choose a status to filter files. Editors can change a file's status from its card.</p></aside>
  <div className="ff-library-body"><header className="ff-library-section"><div><button className="ff-back" onClick={()=>{setFolderId(null);setStatusFilter(null);}} disabled={!folderId&&!statusFilter}>All files</button><ChevronRight size={14}/>{statusFilter?<b>{statusFilter}</b>:folderId?<b>{folders.find(f=>f.id===folderId)?.name}</b>:<b>Root</b>}</div><span>{visibleFolders.length} Folders · {visibleAssets.length} Files · {fmtBytes(sizeSum)}</span></header>
   {!loaded?<div className="ff-lib-empty"><Loader2 className="rotating"/> Loading project files…</div>:<>
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
    {!!visibleAssets.length&&<><div className="ff-section-subtitle">Media <span>{visibleAssets.length} assets</span></div><div className={list?'ff-file-grid ff-list-mode':'ff-file-grid'}>{visibleAssets.map(a=>{const version=latest(a),count=versions.filter(v=>v.asset_id===a.id&&v.status==='ready').length;const decision=reviewStatus(a),status=assetStatus(a);return <article key={a.id} className="ff-file-card" style={{zIndex:statusMenu===a.id?5:undefined}}><button className="ff-video-cover" onClick={()=>openAsset(a)} title={`Open ${a.name}`}><FileCover kind={a.kind} version={version}/><span className="ff-source-label">{version?.source_provider==='google_drive'?<Cloud size={13}/>:<Upload size={13}/>} {version?.source_provider==='google_drive'?'DRIVE':'UPLOAD'}</span><b className="ff-version-badge">V{a.current_version}</b><span className="ff-file-cover-note">{version?.duration_seconds&&Number.isFinite(version.duration_seconds)?`${String(Math.floor(version.duration_seconds/60)).padStart(2,'0')}:${String(Math.floor(version.duration_seconds%60)).padStart(2,'0')}`:`${a.kind.toUpperCase()} · ${fmtBytes(version?.size_bytes||0)}`}</span></button><div className="ff-file-card-info"><div className="ff-file-name-row"><button onClick={()=>openAsset(a)} title={a.name}>{a.name}</button>{canEdit&&<div className="ff-card-menu"><button aria-label={`Move ${a.name}`} onClick={()=>setSelected(selected===a.id?null:a.id)}><MoreHorizontal size={18}/></button>{selected===a.id&&<div className="ff-popmenu"><button onClick={()=>openModal('rename',a.id)}>Rename</button><button onClick={()=>{setSelected(a.id);setTarget('root');setModal('move')}}>Move to folder</button><button onClick={()=>openAsset(a)}>Open review</button></div>}</div>}</div><p>V{a.current_version} latest · {count} version{count===1?'':'s'}</p><div className="ff-card-status-wrap">{canEdit?<button className="ff-status-button" aria-expanded={statusMenu===a.id} aria-label={`Change status for ${a.name}`} onClick={()=>{setStatusMenu(statusMenu===a.id?null:a.id);setSelected(null);setCustomStatus('');}}><span className={`ff-status-chip tone-${statusTone(status)}`}>{status}</span><ChevronDown size={15}/></button>:<div className="ff-status-display"><span className={`ff-status-chip tone-${statusTone(status)}`}>{status}</span></div>}{statusMenu===a.id&&canEdit&&<div className="ff-status-menu"><div className="ff-status-menu-title">Set file status</div><div className="ff-status-menu-list">{statusOptions.map(option=><button key={option} className={status===option?'selected':''} disabled={statusBusy===a.id} onClick={()=>void updateStatus(a.id,option)}><span className={`ff-status-chip tone-${statusTone(option)}`}>{option}</span>{status===option&&<Check size={15}/>}</button>)}</div><div className="ff-status-menu-create"><input value={customStatus} onChange={e=>setCustomStatus(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&customStatus.trim())void updateStatus(a.id,customStatus.trim());}} maxLength={40} placeholder="New custom status" aria-label="New custom status"/><button disabled={!customStatus.trim()||statusBusy===a.id} onClick={()=>void updateStatus(a.id,customStatus.trim())} aria-label="Add custom status"><Plus size={16}/></button></div><button className="ff-status-reset" disabled={statusBusy===a.id} onClick={()=>void updateStatus(a.id,null)}>Use review decision</button></div>}</div>{decision!=='In review'&&<small className="ff-card-review-decision">Review decision: {decision}</small>}</div></article>})}</div></>}
    {!visibleFolders.length&&!visibleAssets.length&&<div className="ff-lib-empty"><FolderOpen size={42}/><h3>{search?'No matching files':statusFilter?`No files marked ${statusFilter}`:'This folder is empty'}</h3><p>{statusFilter?'Choose another status or change a file status from its card.':'Link a video from Google Drive or create a folder to organize your review work.'}</p>{canEdit&&!statusFilter&&<button className="ff-primary" onClick={()=>router.push(`/drive?project=${id}`)}><Cloud size={16}/> Browse Google Drive</button>}</div>}
   </>}
  </div>
  </div>
  <div className="ff-library-foot"><Shield size={15}/> Workspace files and folder metadata are stored in Supabase. Original linked videos stay in Google Drive; review comments belong to each version.</div>
 </div>
 {modal&&<div className="modal-backdrop" onMouseDown={()=>setModal(null)}><div className="modal ff-folder-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-top"><b>{modal==='create'?'New folder':modal==='rename'?isFolder?'Rename folder':'Rename file':modal==='move'?'Move item':'Delete folder'}</b><button className="icon-btn" onClick={()=>setModal(null)}><X size={19}/></button></div>
  {modal==='create'||modal==='rename'?<><label>Folder name<input autoFocus maxLength={120} value={folderName} onChange={e=>setFolderName(e.target.value)} placeholder="e.g. Final videos"/></label><button disabled={busy||!folderName.trim()} className="btn btn-primary wide" onClick={()=>void organize(modal==='create'?'create_folder':isFolder?'rename_folder':'rename_asset',modal==='create'?{name:folderName,parentId:folderId}:{...(isFolder?{folderId:selected}:{assetId:selected}),name:folderName})}>{busy?'Saving…':'Save folder'}</button></>:modal==='move'?<><p>Choose the destination folder. This changes only the FreeFrame organization—not your original Drive file.</p><label>Destination<select value={target} onChange={e=>setTarget(e.target.value)}><option value="root">Project root</option>{destinations.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><button disabled={busy} className="btn btn-primary wide" onClick={()=>void organize(isFolder?'move_folder':'move_asset',isFolder?{folderId:selected,targetFolderId:target==='root'?null:target}:{assetId:selected,targetFolderId:target==='root'?null:target})}>Move item</button></>:<><p>Only empty folders can be deleted. Files are never deleted from Google Drive.</p><button disabled={busy} className="btn btn-danger wide" onClick={()=>void organize('delete_folder',{folderId:selected})}>Delete empty folder</button></>}
  {error&&<div className="message error">{error}</div>}
 </div></div>}
 </AppShell>;
}
