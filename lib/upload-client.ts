import { authFetch } from './supabase-browser';
import { MULTIPART_PART_SIZE } from './limits';
async function videoDuration(file:File):Promise<number|undefined>{
 if(!file.type.startsWith('video/'))return undefined;
 return new Promise(resolve=>{const url=URL.createObjectURL(file),video=document.createElement('video');let settled=false;const finish=(value?:number)=>{if(settled)return;settled=true;video.removeAttribute('src');video.load();URL.revokeObjectURL(url);resolve(value)};
 video.preload='metadata';video.onloadedmetadata=()=>finish(Number.isFinite(video.duration)&&video.duration>0?video.duration:undefined);video.onerror=()=>finish();video.src=url;setTimeout(()=>finish(),5000);});
}
export async function uploadMedia(file: File, projectId: string, onProgress: (percent:number)=>void, assetId?: string):Promise<{assetId:string;versionId:string}> {
 const durationSeconds=await videoDuration(file);
 const start=await authFetch('/api/upload/start',{method:'POST',body:JSON.stringify({fileName:file.name,size:file.size,mimeType:file.type||'application/octet-stream',projectId,assetId,durationSeconds})});
 try {
  if(!start.multipart){
   const response=await fetch(start.putUrl,{method:'PUT',headers:{'Content-Type':file.type},body:file});
   if(!response.ok)throw new Error(`R2 upload failed (${response.status}). Check R2 bucket CORS.`);
   onProgress(95);
   await authFetch('/api/upload/complete',{method:'POST',body:JSON.stringify({versionId:start.versionId})});
  }else{
   const total=Math.ceil(file.size/MULTIPART_PART_SIZE),parts:{partNumber:number;etag:string}[]=[];
   // Concurrency 3. Only parts in memory; original large file is never routed through Vercel.
   let index=0,completed=0;const slots=Array.from({length:Math.min(3,total)},async()=>{
    while(true){const partIndex=index++;if(partIndex>=total)break;
     const number=partIndex+1,offset=partIndex*MULTIPART_PART_SIZE;
     const {url}=await authFetch('/api/upload/part',{method:'POST',body:JSON.stringify({versionId:start.versionId,partNumber:number})});
     let result:Response|null=null;
     for(let retry=0;retry<3;retry++){
      try{result=await fetch(url,{method:'PUT',body:file.slice(offset,Math.min(offset+MULTIPART_PART_SIZE,file.size))});if(result.ok)break;}catch{}
      if(retry===2)throw new Error(`Part ${number} failed after retries.`);
     }
     if(!result?.ok)throw new Error(`Part ${number} failed (${result?.status}). Check R2 CORS.`);
     const etag=result.headers.get('ETag');if(!etag)throw new Error('R2 ETag not exposed. Add ETag under ExposeHeaders in bucket CORS.');
     parts.push({partNumber:number,etag});onProgress(Math.round((++completed/total)*95));
    }
   });
   await Promise.all(slots);
   parts.sort((a,b)=>a.partNumber-b.partNumber);
   await authFetch('/api/upload/complete',{method:'POST',body:JSON.stringify({versionId:start.versionId,parts})});
  }
  onProgress(100);return {assetId:start.assetId,versionId:start.versionId};
 } catch(e){await authFetch('/api/upload/abort',{method:'POST',body:JSON.stringify({versionId:start.versionId})}).catch(()=>{});throw e;}
}
