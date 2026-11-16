import { NextRequest } from 'next/server';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authorized,bad,fail,HttpError,isUuid,json,mustEdit,r2,r2Bucket } from '@/lib/server';
import { MAX_PARTS, MULTIPART_PART_SIZE } from '@/lib/limits';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
 try {
  const { db,user } = await authorized(req); const b = await json(req);
  bad(isUuid(b.versionId) && Number.isSafeInteger(b.partNumber) && b.partNumber>=1 && b.partNumber<=MAX_PARTS,'Invalid upload part');
  const { data:v } = await db.from('asset_versions').select('*,assets(project_id)').eq('id',b.versionId).single();
  if (!v?.upload_id || v.status!=='uploading' || v.created_by!==user.id) throw new HttpError(404,'Active multipart upload not found');
  await mustEdit(db,(v.assets as {project_id:string}).project_id);
  bad(b.partNumber <= Math.ceil(v.size_bytes/MULTIPART_PART_SIZE),'Part number outside file');
  const url = await getSignedUrl(r2(),new UploadPartCommand({Bucket:r2Bucket(),Key:v.storage_key,UploadId:v.upload_id,PartNumber:b.partNumber}),{expiresIn:900});
  return Response.json({url});
 } catch(e) { return fail(e); }
}
