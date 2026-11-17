/** Server-only Google Drive OAuth, refresh and read helpers. */
import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError, supabaseAdmin } from '@/lib/server';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
export const DRIVE_REDIRECT_PATH = '/api/integrations/google/callback';
export const OAUTH_COOKIE = 'freeframe_google_oauth';
const GOOGLE_API = 'https://www.googleapis.com/drive/v3';

function secretKey(label: string): Buffer {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 32 || secret.includes('REPLACE')) throw new HttpError(500, 'Set a secure GOOGLE_TOKEN_ENCRYPTION_KEY (32+ random characters).');
  return createHash('sha256').update(`${label}:${secret}`).digest();
}
function configured(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith('YOUR_') || value.includes('REPLACE')) throw new HttpError(500, `Missing ${name} in .env.local.`);
  return value;
}
export function googleClientId() { return configured('GOOGLE_CLIENT_ID'); }
function googleClientSecret() { return configured('GOOGLE_CLIENT_SECRET'); }
export function googleRedirectUri() { return `${configured('NEXT_PUBLIC_APP_URL').replace(/\/$/, '')}${DRIVE_REDIRECT_PATH}`; }
export function seal(data: object, label: string): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', secretKey(label), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
export function unseal<T>(value: string, label: string): T {
  try {
    const [iv, tag, ciphertext] = value.split('.');
    if (!iv || !tag || !ciphertext) throw Error('Malformed token');
    const decipher = createDecipheriv('aes-256-gcm', secretKey(label), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8')) as T;
  } catch { throw new HttpError(401, 'Invalid or expired Google connection state. Please retry.'); }
}
export function googleAuthUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: googleClientId(), redirect_uri: googleRedirectUri(), response_type: 'code',
    scope: `openid email profile ${DRIVE_SCOPE}`, access_type: 'offline', prompt: 'consent',
    include_granted_scopes: 'true', state, code_challenge: codeChallenge, code_challenge_method: 'S256',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
export function codeVerifier() { return randomBytes(48).toString('base64url'); }
export function codeChallenge(verifier: string) { return createHash('sha256').update(verifier).digest('base64url'); }

type GoogleToken = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
async function postToken(values: Record<string, string>): Promise<GoogleToken> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...values, client_id: googleClientId(), client_secret: googleClientSecret() }),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({})) as GoogleToken;
  if (!res.ok || !body.access_token) throw new HttpError(401, 'Google authorization expired or was revoked. Reconnect Google Drive.');
  return body;
}
export function exchangeGoogleCode(code: string, verifier: string) {
  return postToken({ grant_type: 'authorization_code', code, redirect_uri: googleRedirectUri(), code_verifier: verifier });
}
export type DriveConnection = { user_id: string; google_sub: string; email: string; access_token_encrypted: string; refresh_token_encrypted: string | null; expires_at: string; scope: string };
export async function readConnection(userId: string): Promise<DriveConnection | null> {
  const { data, error } = await supabaseAdmin().from('google_drive_connections').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new HttpError(500, 'Could not read Drive connection. Run supabase/google-drive-migration.sql.');
  return data as DriveConnection | null;
}
async function googleIdentity(accessToken: string): Promise<{ sub: string; email: string; scope: string }> {
  const [userRes, tokenRes] = await Promise.all([
    fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }),
    fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`, { cache: 'no-store' }),
  ]);
  if (!userRes.ok || !tokenRes.ok) throw new HttpError(401, 'Google token is invalid. Please reconnect.');
  const user = await userRes.json() as { sub?: string; email?: string };
  const token = await tokenRes.json() as { aud?: string; audience?: string; issued_to?: string; scope?: string };
  if ((token.aud || token.audience || token.issued_to) !== googleClientId()) throw new HttpError(403, 'Google OAuth token was issued for a different application. Check Google Client ID.');
  if (!token.scope?.split(' ').includes(DRIVE_SCOPE)) throw new HttpError(403, 'Please grant Google Drive read access to use this feature.');
  if (!user.sub || !user.email) throw new HttpError(401, 'Unable to verify your Google account.');
  return { sub: user.sub, email: user.email, scope: token.scope };
}
export async function saveGoogleTokens(userId: string, token: GoogleToken) {
  if (!token.access_token) throw new HttpError(400, 'Missing Google access token.');
  const identity = await googleIdentity(token.access_token);
  const old = await readConnection(userId);
  const refresh = token.refresh_token || (old?.google_sub === identity.sub && old.refresh_token_encrypted ? unseal<{token:string}>(old.refresh_token_encrypted, 'google-refresh').token : '');
  if (!refresh) throw new HttpError(400, 'Google did not issue an offline token. Reconnect and choose Allow.');
  const row = {
    user_id: userId, google_sub: identity.sub, email: identity.email, scope: identity.scope,
    access_token_encrypted: seal({token:token.access_token}, 'google-access'),
    refresh_token_encrypted: seal({token:refresh}, 'google-refresh'),
    expires_at: new Date(Date.now() + Math.max(60, Number(token.expires_in) || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin().from('google_drive_connections').upsert(row, { onConflict: 'user_id' });
  if (error) throw new HttpError(500, `Could not save Google connection. Run migration SQL. (${error.code || 'database'})`);
  return { email: identity.email, googleSub: identity.sub };
}
const tokenRequests = new Map<string, Promise<string>>();
export async function googleAccessToken(userId: string): Promise<string> {
  const existing = tokenRequests.get(userId);
  if (existing) return existing;
  const request = refreshAccessToken(userId);
  tokenRequests.set(userId, request);
  try { return await request; }
  finally { if (tokenRequests.get(userId) === request) tokenRequests.delete(userId); }
}
async function refreshAccessToken(userId: string): Promise<string> {
  const connection = await readConnection(userId);
  if (!connection) throw new HttpError(409, 'Connect a Google Drive account first.');
  if (Date.parse(connection.expires_at) - Date.now() > 90_000) return unseal<{token:string}>(connection.access_token_encrypted, 'google-access').token;
  if (!connection.refresh_token_encrypted) throw new HttpError(401, 'Google Drive needs reconnecting.');
  const refresh = unseal<{token:string}>(connection.refresh_token_encrypted, 'google-refresh').token;
  const token = await postToken({ grant_type: 'refresh_token', refresh_token: refresh });
  const { error } = await supabaseAdmin().from('google_drive_connections').update({
    access_token_encrypted: seal({token:token.access_token}, 'google-access'),
    refresh_token_encrypted: token.refresh_token ? seal({token:token.refresh_token}, 'google-refresh') : connection.refresh_token_encrypted,
    expires_at: new Date(Date.now() + Math.max(60, Number(token.expires_in) || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('google_sub', connection.google_sub);
  if (error) throw new HttpError(500, 'Could not refresh Google Drive connection.');
  return token.access_token!;
}
export async function googleApi(userId: string, path: string, params: Record<string, string> = {}): Promise<Response> {
  const accessToken = await googleAccessToken(userId);
  const url = new URL(`${GOOGLE_API}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new HttpError(403, 'Google blocked this file or the Drive permission expired. Reconnect or check sharing.');
    if (response.status === 404) throw new HttpError(404, 'Google Drive file no longer exists or is not accessible.');
    throw new HttpError(502, `Google Drive request failed (${response.status}).`);
  }
  return response;
}
export type GoogleFile = {
  id: string; name: string; mimeType: string; size?: string; createdTime?: string; modifiedTime?: string;
  webViewLink?: string; thumbnailLink?: string; parents?: string[]; description?: string; videoMediaMetadata?: { durationMillis?: string|number };
};
export function driveKind(mime: string): 'video' | 'audio' | 'image' | null {
  return mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('image/') ? 'image' : null;
}
export async function googleFile(userId: string, fileId: string): Promise<GoogleFile> {
  if (!/^[a-zA-Z0-9_-]{5,256}$/.test(fileId)) throw new HttpError(400, 'Invalid Drive file ID.');
  const result = await googleApi(userId, `files/${encodeURIComponent(fileId)}`, {
    fields: 'id,name,mimeType,size,modifiedTime,webViewLink,parents,description,videoMediaMetadata(durationMillis)', supportsAllDrives: 'true',
  });
  return result.json() as Promise<GoogleFile>;
}

type PlaybackClaims = { versionId: string; mode: 'user' | 'share'; subject: string; exp: number };
function playbackSignature(payload: string) { return createHmac('sha256', secretKey('playback')).update(payload).digest('base64url'); }
export function createPlaybackToken(claims: Omit<PlaybackClaims,'exp'>): string {
  const payload = Buffer.from(JSON.stringify({ ...claims, exp: Date.now() + 45 * 60 * 1000 })).toString('base64url');
  return `${payload}.${playbackSignature(payload)}`;
}
export function verifyPlaybackToken(token: string): PlaybackClaims {
  const parts = token.split('.');
  if (parts.length !== 2 || parts[0].length > 3000 || parts[1].length > 200) throw new HttpError(401, 'Invalid playback link.');
  const expected = Buffer.from(playbackSignature(parts[0])); const received = Buffer.from(parts[1]);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new HttpError(401, 'Invalid playback signature.');
  let claims: PlaybackClaims;
  try { claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as PlaybackClaims; } catch { throw new HttpError(401, 'Malformed playback link.'); }
  if (!claims || !['user','share'].includes(claims.mode) || typeof claims.subject !== 'string' || typeof claims.versionId !== 'string' || !Number.isFinite(claims.exp) || claims.exp < Date.now()) throw new HttpError(401, 'Playback link expired. Reopen the review.');
  return claims;
}
