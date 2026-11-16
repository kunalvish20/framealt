import { NextRequest } from 'next/server';
import { fail } from '@/lib/server';
import { resolveShare } from '@/lib/shares';
export const runtime='nodejs';
export async function GET(_req:NextRequest,{params}:{params:Promise<{token:string}>}){
 try{
  const {token}=await params;const {db,link}=await resolveShare(token);
  const {data:project,error}=await db.from('projects').select('id,title,description').eq('id',link.project_id).single();if(error)throw error;
  let query=db.from('assets').select('id,name,kind,mime_type,current_version,created_at').eq('project_id',link.project_id).gt('current_version',0).order('created_at',{ascending:false});
  if(link.asset_id)query=query.eq('id',link.asset_id);
  const {data:assets}=await query;
  const ids=(assets||[]).map(a=>a.id);
  const {data:versions}=ids.length?await db.from('asset_versions').select('id,asset_id,version,status,created_at,size_bytes,mime_type').in('asset_id',ids).eq('status','ready').order('version',{ascending:false}):{data:[]};
  const versionIds=(versions||[]).map(v=>v.id);
  const {data:comments}=versionIds.length?await db.from('comments').select('id,asset_version_id,body,time_seconds,guest_name,created_at,annotation,parent_id,resolved_at').in('asset_version_id',versionIds).order('created_at',{ascending:true}):{data:[]};
  return Response.json({project,assets:assets||[],versions:versions||[],comments:comments||[],canComment:link.can_comment,expiresAt:link.expires_at},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}
}
