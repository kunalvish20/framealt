import { NextRequest } from 'next/server';
import { bad,fail,HttpError,isUuid,json } from '@/lib/server';
import {validReviewMarks} from '@/lib/annotation';
import { resolveShare } from '@/lib/shares';
export const runtime='nodejs';
export async function POST(req:NextRequest,{params}:{params:Promise<{token:string}>}){
 try{
  const {token}=await params;const {db,link}=await resolveShare(token);
  if(!link.can_comment)throw new HttpError(403,'Guest comments are disabled.');
  const body=await json(req);
  bad(isUuid(body.versionId),'Invalid version ID');
  bad(typeof body.guestName==='string'&&body.guestName.trim().length>=2&&body.guestName.trim().length<=80,'Name must be 2–80 characters');
  bad(typeof body.message==='string'&&body.message.trim().length>=1&&body.message.trim().length<=3000,'Comment must be 1–3000 characters');
  bad(body.annotation===undefined||body.annotation===null||validReviewMarks(body.annotation),'Invalid annotations');
  bad(typeof body.timeSeconds==='number'&&Number.isFinite(body.timeSeconds)&&body.timeSeconds>=0&&body.timeSeconds<1e8,'Invalid timestamp');
  const {data:v}=await db.from('asset_versions').select('asset_id,status,assets(project_id)').eq('id',body.versionId).single();
  if(!v||v.status!=='ready'||(v.assets as unknown as {project_id:string}).project_id!==link.project_id||(link.asset_id&&link.asset_id!==v.asset_id))throw new HttpError(404,'Version unavailable');
  // DB-backed throttling is mandatory for public guest-write endpoints.
  const ip=(req.headers.get('x-real-ip')||req.headers.get('cf-connecting-ip')||'unknown').slice(0,64);
  const {data:allowed,error:throttleError}=await db.rpc('throttle_share_comment',{p_share_id:link.id,p_client_ip:ip});
  if(throttleError)throw throttleError;
  if(!allowed)throw new HttpError(429,'Too many comments. Please try again later.');
  const {data,error}=await db.from('comments').insert({project_id:link.project_id,asset_version_id:body.versionId,author_id:null,guest_name:body.guestName.trim(),share_link_id:link.id,body:body.message.trim(),time_seconds:body.timeSeconds,annotation:body.annotation||null}).select('id').single();
  if(error)throw error;
  return Response.json({ok:true,id:data.id});
 }catch(e){return fail(e);}
}
