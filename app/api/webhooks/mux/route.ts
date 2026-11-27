import { NextRequest } from 'next/server';
import { discardMuxUpload, finalizeMuxAsset } from '@/lib/mux-finalize';
import { deleteMuxAsset, type MuxAsset, verifyMuxWebhook } from '@/lib/mux';
import { isUuid } from '@/lib/server';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.text();
  try {
    if (!verifyMuxWebhook(body, req.headers.get('mux-signature'))) return Response.json({ error: 'Invalid Mux signature' }, { status: 401 });
    const event = JSON.parse(body) as { type?: string; data?: MuxAsset };
    const versionId = event.data?.passthrough;
    if (!isUuid(versionId)) return Response.json({ ok: true });
    if (event.type === 'video.asset.ready' && event.data) await finalizeMuxAsset(versionId, event.data);
    if (event.type === 'video.asset.errored' && event.data) {
      const discarded = await discardMuxUpload(versionId);
      if (discarded && event.data.id) await deleteMuxAsset(event.data.id).catch(() => {});
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Mux webhook failed:', error);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
