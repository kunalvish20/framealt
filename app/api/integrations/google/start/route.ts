import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { authorized, fail } from '@/lib/server';
import { codeChallenge, codeVerifier, googleAuthUrl, OAUTH_COOKIE, seal } from '@/lib/google-drive';
export const runtime='nodejs';
export async function POST(req: NextRequest) {
  try {
    const {user} = await authorized(req);
    const verifier = codeVerifier(), state = randomBytes(24).toString('base64url');
    const response = NextResponse.json({ url: googleAuthUrl(state, codeChallenge(verifier)) });
    response.cookies.set(OAUTH_COOKIE, seal({ userId:user.id, state, verifier, created:Date.now() }, 'oauth-state'), {
      httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV==='production', path:'/api/integrations/google/callback', maxAge:600,
    });
    return response;
  } catch (error) { return fail(error); }
}
