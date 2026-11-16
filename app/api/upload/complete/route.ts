import { NextRequest } from 'next/server';
import { CompleteMultipartUploadCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { authorized,bad,fail,HttpError,isUuid,json,mustEdit,r2,r2Bucket,supabaseAdmin } from '@/lib/server';
import { MAX_PARTS } from '@/lib/limits';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
 try {
  const {db,user}=await authorized(req); const b=await json(req);
  bad(isUuid(b.versionId),'Invalid version ID');
  const {data:v}=await db.from('asset_versions').select('*,assets(project_id,current_version)').eq('id',b.versionId).single();
  if(!v||v.status!=='uploading'||v.created_by!==user.id) throw new HttpError(404,'Pending upload not found');
  const asset = v.assets as {project_id:string;current_version:number};
  await mustEdit(db,asset.project_id);
  if(v.upload_id){
   bad(Array.isArray(b.parts) && b.parts.length > 1 && b.parts.length <= MAX_PARTS,'Missing multipart parts');
   const parts = b.parts.map((p: {partNumber:number;etag:string})=>({PartNumber:p.partNumber,ETag:p.etag}));
   bad(parts.every((p:{PartNumber:number;ETag:string},i:number)=>Number.isInteger(p.PartNumber)&&p.PartNumber===i+1&&typeof p.ETag==='string'&&/^"?[a-zA-Z0-9-]+"?$/.test(p.ETag)),'Invalid multipart ETags');
   await r2().send(new CompleteMultipartUploadCommand({Bucket:r2Bucket(),Key:v.storage_key,UploadId:v.upload_id,MultipartUpload:{Parts:parts}}));
  }
  let head;
  try { head=await r2().send(new HeadObjectCommand({Bucket:r2Bucket(),Key:v.storage_key})); }
  catch { throw new HttpError(409,'Upload not found in R2. Please retry.'); }
  if(head.ContentLength!==v.size_bytes) {
   await r2().send(new DeleteObjectCommand({Bucket:r2Bucket(),Key:v.storage_key})).catch(()=>{});
   throw new HttpError(409,'File size verification failed. Upload rejected.');
  }
  const admin=supabaseAdmin();
  const {error}=await admin.from('asset_versions').update({status:'ready',upload_id:null}).eq('id',v.id).eq('status','uploading');
  if(error) throw error;
  await admin.from('assets').update({current_version:Math.max(asset.current_version,v.version)}).eq('id',v.asset_id).lt('current_version',v.version);
  return Response.json({ok:true,versionId:v.id,assetId:v.asset_id});
 } catch(e) { return fail(e); }
}
