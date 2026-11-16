import { NextRequest } from 'next/server';
import { authorized, bad, fail, json } from '@/lib/server';
import { saveGoogleTokens } from '@/lib/google-drive';
export const runtime='nodejs';
/** Called once after Supabase Google sign-in if session includes Google provider tokens. */
export async function POST(req:NextRequest) {
  try {const {user}=await authorized(req);const data=await json(req);
    bad(typeof data.accessToken==='string' && data.accessToken.length<8192 && data.accessToken.length>20,'Missing OAuth access token');
    bad(!data.refreshToken || (typeof data.refreshToken==='string' && data.refreshToken.length<8192),'Invalid refresh token');
    const result=await saveGoogleTokens(user.id,{access_token:data.accessToken,refresh_token:data.refreshToken,expires_in:3600});
    return Response.json({connected:true,email:result.email},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e);}
}
