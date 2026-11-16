import {NextRequest} from 'next/server';
import {authorized,bad,fail,HttpError,isUuid,json,mustEdit,supabaseAdmin} from '@/lib/server';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const {db}=await authorized(req),body=await json(req);
  bad(isUuid(body.commentId),'Invalid comment ID');bad(typeof body.resolved==='boolean','Invalid resolve status');
  const {data:comment}=await db.from('comments').select('id,project_id').eq('id',body.commentId).single();
  if(!comment)throw new HttpError(404,'Comment not found');
  await mustEdit(db,comment.project_id);
  const {error}=await supabaseAdmin().from('comments').update({resolved_at:body.resolved?new Date().toISOString():null}).eq('id',body.commentId);
  if(error)throw error;
  return Response.json({ok:true});
 }catch(e){return fail(e)}
}
