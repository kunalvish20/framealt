import { NextRequest } from 'next/server';
import { authorized,bad,fail,HttpError,isUuid,json } from '@/lib/server';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const {db}=await authorized(req);const b=await json(req);
  bad(isUuid(b.projectId),'Invalid project');bad(typeof b.email==='string'&&b.email.includes('@')&&b.email.length<=254,'Invalid email');
  bad(['editor','viewer'].includes(b.role),'Role must be editor or viewer');
  const {data,error}=await db.rpc('invite_existing_user',{p_project_id:b.projectId,p_email:b.email,p_role:b.role});
  if(error)throw new HttpError(403,error.message);
  return Response.json({result:data});
 }catch(e){return fail(e);}
}

export async function DELETE(req:NextRequest){
 try{
  const {db}=await authorized(req); const b=await json(req);
  bad(isUuid(b.projectId)&&isUuid(b.userId),'Invalid member selection');
  const {data:role}=await db.rpc('my_project_role',{p_project_id:b.projectId});
  if(role!=='owner')throw new HttpError(403,'Only the project owner can remove members');
  const {data:member}=await db.from('project_members').select('role').eq('project_id',b.projectId).eq('user_id',b.userId).single();
  if(!member)throw new HttpError(404,'Member not found');
  if(member.role==='owner')throw new HttpError(403,'Cannot remove the project owner');
  const {supabaseAdmin}=await import('@/lib/server');
  const {error}=await supabaseAdmin().from('project_members').delete().eq('project_id',b.projectId).eq('user_id',b.userId).neq('role','owner');if(error)throw error;
  return Response.json({ok:true});
 }catch(e){return fail(e);}
}
