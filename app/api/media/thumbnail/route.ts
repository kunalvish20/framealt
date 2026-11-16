import {NextRequest} from 'next/server';
import {authorized,bad,fail,HttpError,isUuid,mustView} from '@/lib/server';
import {googleAccessToken} from '@/lib/google-drive';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
  const {db}=await authorized(req);
  const versionId=req.nextUrl.searchParams.get('versionId');bad(isUuid(versionId),'Invalid version ID');
  const {data:version}=await db.from('asset_versions')
   .select('asset_id,source_provider,external_file_id,external_owner_id,assets(project_id)').eq('id',versionId).eq('status','ready').single();
  if(!version)throw new HttpError(404,'Media not found');
  await mustView(db,(version.assets as unknown as {project_id:string}).project_id);
  if(version.source_provider!=='google_drive'||!version.external_file_id||!version.external_owner_id)return Response.json({url:null},{headers:{'Cache-Control':'no-store'}});
  const access=await googleAccessToken(version.external_owner_id);
  const google=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(version.external_file_id)}?fields=thumbnailLink&supportsAllDrives=true`,{headers:{Authorization:`Bearer ${access}`},cache:'no-store'});
  if(!google.ok)return Response.json({url:null},{headers:{'Cache-Control':'no-store'}});
  const json=await google.json() as {thumbnailLink?:string};
  const url=typeof json.thumbnailLink==='string'&&json.thumbnailLink.startsWith('https://')?json.thumbnailLink:null;
  return Response.json({url},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return fail(e)}
}
