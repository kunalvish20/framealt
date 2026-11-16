import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { authorized,bad,fail,HttpError,isUuid,json,mustEdit,supabaseAdmin } from '@/lib/server';
import { hashToken } from '@/lib/shares';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const {db,user}=await authorized(req); const b=await json(req);
  bad(isUuid(b.projectId),'Invalid project ID');await mustEdit(db,b.projectId);
  if(b.assetId){bad(isUuid(b.assetId),'Invalid asset ID');const {data:a}=await db.from('assets').select('id').eq('id',b.assetId).eq('project_id',b.projectId).single();if(!a)throw new HttpError(404,'Asset not found');}
  const days=Number(b.expiresDays||7);bad(Number.isInteger(days)&&days>=1&&days<=90,'Expiration must be 1–90 days');
  const token=randomBytes(32).toString('hex');
  const {data,error}=await supabaseAdmin().from('share_links').insert({project_id:b.projectId,asset_id:b.assetId||null,token_hash:hashToken(token),can_comment:b.canComment!==false,expires_at:new Date(Date.now()+days*86400000).toISOString(),created_by:user.id}).select('id').single();
  if(error)throw error;
  const appUrl=process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  return Response.json({id:data.id,url:`${appUrl.replace(/\/$/,'')}/share/${token}`},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}
}
export async function DELETE(req:NextRequest){
 try{
  const {db}=await authorized(req);const b=await json(req);bad(isUuid(b.linkId),'Invalid link ID');
  const {data:link}=await db.from('share_links').select('project_id').eq('id',b.linkId).single();if(!link)throw new HttpError(404,'Link not found');
  await mustEdit(db,link.project_id);
  const {error}=await supabaseAdmin().from('share_links').update({revoked_at:new Date().toISOString()}).eq('id',b.linkId);if(error)throw error;
  return Response.json({ok:true});
 }catch(e){return fail(e);}
}
