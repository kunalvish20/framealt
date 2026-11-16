import { NextRequest } from 'next/server';
import { CreateMultipartUploadCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { authorized, bad, fail, HttpError, isUuid, json, mustEdit, r2, r2Bucket, supabaseAdmin } from '@/lib/server';
import { SMALL_UPLOAD_THRESHOLD, MAX_UPLOAD_BYTES, uploadKind, validUpload } from '@/lib/limits';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
 try {
  const { db, user } = await authorized(req);
  const body = await json(req);
  bad(isUuid(body.projectId), 'Invalid project ID');
  bad(typeof body.fileName === 'string' && body.fileName.trim().length > 0 && body.fileName.length <= 240,'Invalid file name');
  bad(validUpload(body.size,body.mimeType),'Unsupported file or size. Use image, video, audio, up to 50 GiB.');
  await mustEdit(db, body.projectId);
  const admin = supabaseAdmin();
  let assetId: string = randomUUID(); let version = 1; let newAsset = true;
  if (body.assetId) {
   bad(isUuid(body.assetId),'Invalid asset ID');
   const { data: existing } = await db.from('assets').select('*').eq('id',body.assetId).eq('project_id',body.projectId).single();
   if (!existing) throw new HttpError(404,'Asset not found');
   if (existing.kind !== uploadKind(body.mimeType)) throw new HttpError(400,'New version must have the same media type.');
   assetId = existing.id; version = existing.current_version + 1; newAsset = false;
   // Prevent overlapping uploads for the same asset.
   const { data: pending } = await db.from('asset_versions').select('id').eq('asset_id',assetId).eq('status','uploading').limit(1);
   if (pending?.length) throw new HttpError(409,'Another version is uploading. Complete it before starting another.');
  } else {
   const { error } = await admin.from('assets').insert({ id:assetId,project_id:body.projectId, name:body.fileName.trim(),kind:uploadKind(body.mimeType), mime_type:body.mimeType,created_by:user.id });
   if (error) throw new HttpError(400,error.message);
  }
  const versionId = randomUUID();
  const safeExt = (body.fileName.match(/\.([a-z0-9]{1,12})$/i)?.[1] || 'bin').toLowerCase();
  const key = `projects/${body.projectId}/${assetId}/${versionId}.${safeExt}`;
  const multipart = body.size > SMALL_UPLOAD_THRESHOLD;
  let uploadId: string | null = null;
  try {
   if (multipart) {
    const created = await r2().send(new CreateMultipartUploadCommand({ Bucket:r2Bucket(),Key:key,ContentType:body.mimeType }));
    if (!created.UploadId) throw new Error('R2 failed to start multipart upload');
    uploadId = created.UploadId;
   }
   const { error } = await admin.from('asset_versions').insert({ id:versionId,asset_id:assetId,version,storage_key:key,size_bytes:body.size,mime_type:body.mimeType,upload_id:uploadId,created_by:user.id,status:'uploading',...(Number.isFinite(body.durationSeconds)&&body.durationSeconds>0&&body.durationSeconds<1e8?{duration_seconds:body.durationSeconds}:{}) });
   if (error) throw new HttpError(409,error.message);
  } catch (e) {
   if (newAsset) await admin.from('assets').delete().eq('id',assetId);
   if (uploadId) {
    const { AbortMultipartUploadCommand } = await import('@aws-sdk/client-s3');
    await r2().send(new AbortMultipartUploadCommand({Bucket:r2Bucket(),Key:key,UploadId:uploadId})).catch(()=>{});
   }
   throw e;
  }
  const putUrl = !multipart ? await getSignedUrl(r2(),new PutObjectCommand({Bucket:r2Bucket(),Key:key,ContentType:body.mimeType}),{expiresIn:900}) : undefined;
  return Response.json({assetId,versionId,version,multipart,putUrl,maxUploadBytes:MAX_UPLOAD_BYTES});
 } catch (e) { return fail(e); }
}
