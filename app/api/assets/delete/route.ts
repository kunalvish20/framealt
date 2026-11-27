import { NextRequest } from 'next/server';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { authorized,bad,fail,HttpError,isUuid,json,mustEdit,r2,r2Bucket,supabaseAdmin } from '@/lib/server';
import { deleteMuxAsset } from '@/lib/mux';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const {db}=await authorized(req);const b=await json(req);bad(isUuid(b.assetId),'Invalid asset ID');
  const {data:asset,error:assetError}=await db.from('assets').select('project_id').eq('id',b.assetId).maybeSingle();if(assetError)throw assetError;if(!asset)throw new HttpError(404,'Asset not found');
  await mustEdit(db,asset.project_id);
  const {data:versions,error:versionsError}=await db.from('asset_versions').select('storage_key,status,source_provider,mux_asset_id').eq('asset_id',b.assetId);
  if(versionsError)throw versionsError;
  if(versions?.some(v=>v.status==='uploading'))throw new HttpError(409,'Finish or cancel active upload first.');
  if(versions?.some(v=>v.source_provider==='mux'&&!v.mux_asset_id))throw new HttpError(409,'Mux asset ID is missing. Contact support before deleting this file.');
  for(const v of versions||[])if((v.source_provider||'r2')==='r2')await r2().send(new DeleteObjectCommand({Bucket:r2Bucket(),Key:v.storage_key}));
  for(const v of versions||[])if(v.source_provider==='mux'&&v.mux_asset_id)await deleteMuxAsset(v.mux_asset_id);
  const {data:deleted,error}=await supabaseAdmin().from('assets').delete().eq('id',b.assetId).select('id').maybeSingle();if(error)throw error;
  if(!deleted)throw new HttpError(404,'Asset was not found.');
  return Response.json({ok:true,deletedMuxAssets:(versions||[]).filter(v=>v.source_provider==='mux').length});
 }catch(e){return fail(e);}
}
