import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode, OAUTH_COOKIE, saveGoogleTokens, unseal } from '@/lib/google-drive';
export const runtime='nodejs';
type Pending = { userId:string; state:string; verifier:string; created:number };
export async function GET(req:NextRequest) {
  const root = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/,'');
  const toDrive = (result:string) => new URL(`/drive?google=${encodeURIComponent(result)}`, root);
  const response = (result:string) => { const r=NextResponse.redirect(toDrive(result)); r.cookies.delete({name:OAUTH_COOKIE,path:'/api/integrations/google/callback'});return r; };
  if (req.nextUrl.searchParams.get('error')) return response('denied');
  try {
    const cookie=req.cookies.get(OAUTH_COOKIE)?.value;
    if (!cookie) return response('expired');
    const pending=unseal<Pending>(cookie,'oauth-state');
    const state=req.nextUrl.searchParams.get('state');
    const code=req.nextUrl.searchParams.get('code');
    if (!state || !code || pending.state!==state || !pending.userId || Date.now()-pending.created>600000) return response('expired');
    const tokens=await exchangeGoogleCode(code, pending.verifier);
    await saveGoogleTokens(pending.userId, tokens);
    return response('connected');
  } catch (error) {
    console.error('Google OAuth callback failed:',error instanceof Error ? error.message : 'Unknown error');
    return response('failed');
  }
}
