import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { S3Client } from '@aws-sdk/client-s3';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith('YOUR_') || value.includes('YOUR-PROJECT')) throw new Error(`Missing ${name}. Set it in .env.local.`);
  return value;
}
export function supabaseAdmin(): SupabaseClient {
  return createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
export async function authorized(req: NextRequest): Promise<{ db: SupabaseClient; user: User }> {
  const header = req.headers.get('authorization') || '';
  const jwt = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!jwt) throw new HttpError(401, 'Please sign in.');
  const db = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data.user) throw new HttpError(401, 'Invalid or expired session.');
  return { db, user: data.user };
}
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function fail(error: unknown) {
  if (!(error instanceof HttpError)) console.error('API error:', error);
  return Response.json({ error: error instanceof HttpError ? error.message : 'Internal server error. Check the server logs.' }, { status: error instanceof HttpError ? error.status : 500 });
}
export function bad(condition: unknown, message: string): asserts condition {
  if (!condition) throw new HttpError(400, message);
}
export function r2(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: required('R2_ACCESS_KEY_ID'), secretAccessKey: required('R2_SECRET_ACCESS_KEY') },
    forcePathStyle: true,
  });
}
export function r2Bucket() { return required('R2_BUCKET'); }
export async function mustEdit(db: SupabaseClient, projectId: string) {
  const { data, error } = await db.rpc('my_project_role', { p_project_id: projectId });
  if (error || !['owner','editor'].includes(data)) throw new HttpError(403, 'You do not have edit access to this project.');
}
export async function mustView(db: SupabaseClient, projectId: string) {
  const { data, error } = await db.rpc('my_project_role', { p_project_id: projectId });
  if (error || !['owner','editor','viewer'].includes(data)) throw new HttpError(403, 'You do not have access to this project.');
}
export async function json(req: NextRequest) {
  try { return await req.json(); } catch { throw new HttpError(400,'Invalid JSON body.'); }
}
export function isUuid(s: unknown): s is string { return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s); }
