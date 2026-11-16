import { NextRequest } from 'next/server';
import { AbortMultipartUploadCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { authorized,bad,fail,HttpError,isUuid,json,mustEdit,r2,r2Bucket,supabaseAdmin } from '@/lib/server';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const {db,user}=await authorized(req);const b=await json(req);bad(isUuid(b.versionId),'Invalid version ID');
  const {data:v}=await db.from('asset_versions').select('*,assets(project_id,current_version)').eq('id',b.versionId).single();
  if(!v||v.created_by!==user.id||v.status!=='uploading')throw new HttpError(404,'Upload not found');
  await mustEdit(db,(v.assets as {project_id:string}).project_id);
  if(v.upload_id)await r2().send(new AbortMultipartUploadCommand({Bucket:r2Bucket(),Key:v.storage_key,UploadId:v.upload_id})).catch(()=>{});
  else await r2().send(new DeleteObjectCommand({Bucket:r2Bucket(),Key:v.storage_key})).catch(()=>{});
  const admin=supabaseAdmin();await admin.from('asset_versions').delete().eq('id',v.id);
  if((v.assets as {current_version:number}).current_version===0)await admin.from('assets').delete().eq('id',v.asset_id);
  return Response.json({ok:true});
 }catch(e){return fail(e);}
}
