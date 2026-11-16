import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { authorized,bad,fail,HttpError,isUuid,json,mustEdit,supabaseAdmin } from '@/lib/server';
import { driveKind, googleFile, readConnection } from '@/lib/google-drive';
export const runtime='nodejs';
export async function POST(req:NextRequest) {
  try {
    const {db,user}=await authorized(req),body=await json(req);
    bad(isUuid(body.projectId),'Invalid project');
    bad(typeof body.fileId==='string'&&/^[a-zA-Z0-9_-]{5,256}$/.test(body.fileId),'Invalid Google Drive file ID');
    await mustEdit(db,body.projectId);
    if(!await readConnection(user.id))throw new HttpError(409,'Connect Google Drive first.');
    // Re-fetch metadata server-side. Never trust a filename/mime submitted by the browser.
    const file=await googleFile(user.id,body.fileId),kind=driveKind(file.mimeType);
    if(!kind)throw new HttpError(400,'Only images, video and audio can be linked for review. Google Docs, folders and other files remain visible in the Drive library.');
    const admin=supabaseAdmin();
    // Clicking a video already attached to this project should OPEN the existing
    // review instead of creating duplicate assets or accidental V2/V3 revisions.
    // An explicit assetId is the separate user action for uploading a new version.
    if(!body.assetId){
      const {data:existingVersions,error:lookupError}=await admin.from('asset_versions')
        .select('id,asset_id').eq('source_provider','google_drive')
        .eq('external_owner_id',user.id).eq('external_file_id',file.id)
        .eq('status','ready').order('created_at',{ascending:false}).limit(100);
      if(lookupError)throw new HttpError(500,'Unable to check whether this video is already linked.');
      if(existingVersions?.length){
        const existingIds=[...new Set(existingVersions.map(v=>v.asset_id))];
        const {data:existingAssets,error:assetLookupError}=await admin.from('assets')
          .select('id').eq('project_id',body.projectId).in('id',existingIds).limit(1);
        if(assetLookupError)throw new HttpError(500,'Unable to verify an existing review.');
        if(existingAssets?.length){
          const existing=existingAssets[0];
          const matching=existingVersions.find(v=>v.asset_id===existing.id);
          return Response.json({ok:true,alreadyLinked:true,assetId:existing.id,versionId:matching?.id,name:file.name,source:'google_drive'});
        }
      }
    }
    let assetId=randomUUID(),version=1,created=false;
    if(body.assetId) {
      bad(isUuid(body.assetId),'Invalid target asset');
      const {data:asset}=await db.from('assets').select('id,project_id,kind,current_version').eq('id',body.assetId).eq('project_id',body.projectId).single();
      if(!asset)throw new HttpError(404,'Asset not found');
      if(asset.kind!==kind)throw new HttpError(400,'A new version must use the same media type.');
      const {data:pending}=await db.from('asset_versions').select('id').eq('asset_id',asset.id).eq('status','uploading').limit(1);
      if(pending?.length)throw new HttpError(409,'Wait until the current upload finishes.');
      assetId=asset.id;version=asset.current_version+1;
    } else {
      const {error}=await admin.from('assets').insert({id:assetId,project_id:body.projectId,name:file.name.slice(0,240),kind,mime_type:file.mimeType,created_by:user.id});
      if(error)throw new HttpError(400,'Cannot create asset in this project.');
      created=true;
    }
    const versionId=randomUUID();
    const {error}=await admin.from('asset_versions').insert({
      id:versionId,asset_id:assetId,version,storage_key:`google-drive/${user.id}/${file.id}/${versionId}`,
      mime_type:file.mimeType,size_bytes:Math.max(1,Number(file.size)||1),status:'ready',
      source_provider:'google_drive',external_file_id:file.id,external_owner_id:user.id,created_by:user.id,
      ...(file.videoMediaMetadata?.durationMillis&&Number(file.videoMediaMetadata.durationMillis)>0?{duration_seconds:Number(file.videoMediaMetadata.durationMillis)/1000}:{}),
    });
    if(error){if(created)await admin.from('assets').delete().eq('id',assetId);throw new HttpError(409,'Could not attach file; another version may have been added.');}
    const {error:updateError}=await admin.from('assets').update({current_version:version}).eq('id',assetId).lt('current_version',version);
    if(updateError)throw new HttpError(500,'Attached file, but could not update asset version.');
    return Response.json({ok:true,assetId,versionId,name:file.name,source:'google_drive'});
  } catch(e){return fail(e);}
}
