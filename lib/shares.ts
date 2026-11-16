import { createHash } from 'node:crypto';
import { HttpError, supabaseAdmin } from './server';
export function hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
export async function resolveShare(token: string) {
  if (!/^[0-9a-f]{64}$/i.test(token)) throw new HttpError(404,'Share link not found.');
  const db = supabaseAdmin();
  const { data: link, error } = await db.from('share_links').select('*').eq('token_hash',hashToken(token)).is('revoked_at',null).maybeSingle();
  if (error || !link || (link.expires_at && new Date(link.expires_at).getTime() < Date.now())) throw new HttpError(404, 'Share link has expired or was revoked.');
  return { db, link };
}
