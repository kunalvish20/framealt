import { NextRequest } from 'next/server';
import { authorized, fail } from '@/lib/server';
import { readConnection } from '@/lib/google-drive';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
  try { const {user}=await authorized(req); const connection=await readConnection(user.id);
    return Response.json({ connected:!!connection, email:connection?.email||null, provider:'google_drive' },{headers:{'Cache-Control':'no-store'}});
  } catch(e){return fail(e);}
}
export async function DELETE(req:NextRequest) {
  try { const {user}=await authorized(req);
    const {error}=await (await import('@/lib/server')).supabaseAdmin().from('google_drive_connections').delete().eq('user_id',user.id);
    if(error)throw error;
    return Response.json({ok:true});
  } catch(e){return fail(e);}
}
