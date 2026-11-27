import { HttpError } from './server';
import { signMuxPlaybackUrl, verifyMuxSignature } from './mux-crypto.mjs';

function required(name: string) {
  const value = process.env[name];
  if (!value || value.startsWith('YOUR_') || value.startsWith('REPLACE_')) throw new HttpError(503, `Configure ${name} on the server before using Mux.`);
  return value;
}

type MuxUpload = { id: string; url: string; status: 'waiting' | 'asset_created' | 'errored' | 'cancelled' | 'timed_out'; asset_id?: string; error?: { message?: string } };
export type MuxAsset = { id: string; status: 'preparing' | 'ready' | 'errored'; passthrough?: string; duration?: number; playback_ids?: { id: string; policy: string }[]; errors?: { messages?: string[] } };

async function muxRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = Buffer.from(`${required('MUX_TOKEN_ID')}:${required('MUX_TOKEN_SECRET')}`).toString('base64');
  const response = await fetch(`https://api.mux.com/video/v1${path}`, {
    ...init,
    headers: { Authorization: `Basic ${auth}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 404) throw new HttpError(404, 'Mux asset or upload was not found.');
    console.error('Mux API error:', response.status, path);
    throw new HttpError(502, `Mux request failed (${response.status}). Check the server logs and Mux credentials.`);
  }
  if (response.status === 204) return undefined as T;
  const result = await response.json() as { data: T };
  return result.data;
}

export function createMuxUpload(versionId: string, origin: string) {
  return muxRequest<MuxUpload>('/uploads', {
    method: 'POST',
    body: JSON.stringify({
      cors_origin: origin,
      timeout: 86400,
      new_asset_settings: { passthrough: versionId, playback_policies: ['signed'], video_quality: 'basic', max_resolution_tier: '2160p' },
    }),
  });
}
export const getMuxUpload = (id: string) => muxRequest<MuxUpload>(`/uploads/${encodeURIComponent(id)}`);
export const getMuxAsset = (id: string) => muxRequest<MuxAsset>(`/assets/${encodeURIComponent(id)}`);
export const cancelMuxUpload = (id: string) => muxRequest<MuxUpload>(`/uploads/${encodeURIComponent(id)}/cancel`, { method: 'PUT' });
export async function deleteMuxAsset(id: string) {
  try { await muxRequest<void>(`/assets/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  catch (error) { if (!(error instanceof HttpError && error.status === 404)) throw error; }
}

export function muxPlaybackUrl(playbackId: string, audience: 'v' | 't', durationSeconds = 0) {
  return signMuxPlaybackUrl(playbackId, audience, durationSeconds, required('MUX_SIGNING_KEY_ID'), required('MUX_SIGNING_PRIVATE_KEY'));
}

export function verifyMuxWebhook(body: string, signature: string | null) {
  return verifyMuxSignature(body, signature, required('MUX_WEBHOOK_SECRET'));
}
