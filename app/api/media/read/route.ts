import { NextRequest } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authorized,bad,fail,HttpError,isUuid,mustView,r2,r2Bucket } from '@/lib/server';
import { resolveShare } from '@/lib/shares';
import { createPlaybackToken } from '@/lib/google-drive';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
  const id=req.nextUrl.searchParams.get('versionId');bad(isUuid(id),'Invalid version ID');
  const token=req.nextUrl.searchParams.get('shareToken');let key:string;let googleClaims: {mode:'share'|'user';subject:string}|null=null;let source='r2';
  if(token){
   const {db,link}=await resolveShare(token);
   const {data:v}=await db.from('asset_versions').select('storage_key,status,asset_id,source_provider,assets(project_id)').eq('id',id).single();
   if(!v||v.status!=='ready'||(v.assets as unknown as {project_id:string}).project_id!==link.project_id||(link.asset_id&&link.asset_id!==v.asset_id))throw new HttpError(404,'Media not available');
   key=v.storage_key; source=v.source_provider||'r2'; googleClaims={mode:'share',subject:link.id};
  }else{
   const {db,user}=await authorized(req);
   const {data:v}=await db.from('asset_versions').select('storage_key,status,source_provider,assets(project_id)').eq('id',id).single();
   if(!v||v.status!=='ready')throw new HttpError(404,'Version not found');
   await mustView(db,(v.assets as unknown as {project_id:string}).project_id);
   key=v.storage_key; source=v.source_provider||'r2'; googleClaims={mode:'user',subject:user.id};
  }
  if(source==='google_drive') {
   const signed=createPlaybackToken({versionId:id,mode:googleClaims!.mode,subject:googleClaims!.subject});
   const base=process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/,'')||req.nextUrl.origin;
   return Response.json({url:`${base}/api/media/google?token=${encodeURIComponent(signed)}`,expiresIn:2700},{headers:{'Cache-Control':'no-store'}});
  }
  const url=await getSignedUrl(r2(),new GetObjectCommand({Bucket:r2Bucket(),Key:key}),{expiresIn:1800});
  return Response.json({url,expiresIn:1800},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}
}
