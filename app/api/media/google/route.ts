import { NextRequest } from 'next/server';
import { fail, HttpError, isUuid, supabaseAdmin } from '@/lib/server';
import { googleAccessToken, verifyPlaybackToken } from '@/lib/google-drive';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest) {
  try {
    const signed=req.nextUrl.searchParams.get('token')||'';
    const claims=verifyPlaybackToken(signed);
    if(!isUuid(claims.versionId)||!isUuid(claims.subject))throw new HttpError(401,'Invalid playback link');
    const db=supabaseAdmin();
    const {data:v}=await db.from('asset_versions').select('id,asset_id,status,mime_type,source_provider,external_file_id,external_owner_id,assets(project_id)').eq('id',claims.versionId).single();
    if(!v||v.status!=='ready'||v.source_provider!=='google_drive'||!v.external_file_id||!v.external_owner_id)throw new HttpError(404,'Media not available');
    const projectId=(v.assets as unknown as {project_id:string}).project_id;
    if(claims.mode==='user'){
      const {data:membership}=await db.from('project_members').select('role').eq('project_id',projectId).eq('user_id',claims.subject).maybeSingle();
      if(!membership)throw new HttpError(403,'Project access was revoked');
    }else{
      const {data:share}=await db.from('share_links').select('id,asset_id,expires_at,revoked_at').eq('id',claims.subject).eq('project_id',projectId).maybeSingle();
      if(!share||share.revoked_at||(share.expires_at&&Date.parse(share.expires_at)<Date.now())||(share.asset_id&&share.asset_id!==v.asset_id))throw new HttpError(403,'Share link expired or revoked');
    }
    const range=req.headers.get('range');
    if(range&&(!/^bytes=\d+-\d*$/.test(range)||range.length>90))throw new HttpError(416,'Unsupported video range request');
    const access=await googleAccessToken(v.external_owner_id);
    // Stream bytes without copying to R2 or exposing the Google OAuth token.
    const google=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(v.external_file_id)}?alt=media&supportsAllDrives=true`,{
      headers:{Authorization:`Bearer ${access}`,...(range?{Range:range}:{})},cache:'no-store',redirect:'follow',
    });
    if(!google.ok||!google.body){
      if(google.status===404||google.status===403)throw new HttpError(403,'Drive owner removed access or the file cannot be downloaded.');
      throw new HttpError(google.status===416?416:502,`Google Drive playback unavailable (${google.status}).`);
    }
    const headers=new Headers({
      'Content-Type':v.mime_type||'application/octet-stream','Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff','Content-Disposition':'inline',
    });
    for(const key of ['content-length','content-range','accept-ranges','etag','last-modified']){
      const value=google.headers.get(key);if(value)headers.set(key,value);
    }
    return new Response(google.body,{status:google.status===206?206:200,headers});
  }catch(e){return fail(e);}
}
