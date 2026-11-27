import { NextRequest } from 'next/server';
import { authorized, bad, fail, HttpError, isUuid, json, mustEdit } from '@/lib/server';
import { finalizeMuxAsset, discardMuxUpload } from '@/lib/mux-finalize';
import { deleteMuxAsset, getMuxAsset, getMuxUpload } from '@/lib/mux';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { db, user } = await authorized(req);
    const body = await json(req);
    bad(isUuid(body.versionId), 'Invalid version ID');
    const { data: version } = await db.from('asset_versions')
      .select('id,asset_id,status,upload_id,source_provider,created_by,assets(project_id)')
      .eq('id', body.versionId).single();
    if (!version || version.source_provider !== 'mux' || version.created_by !== user.id) throw new HttpError(404, 'Mux upload not found');
    await mustEdit(db, (version.assets as unknown as { project_id: string }).project_id);
    if (version.status === 'ready') return Response.json({ ok: true, ready: true });
    if (!version.upload_id) throw new HttpError(409, 'Mux upload has no upload ID.');
    const upload = await getMuxUpload(version.upload_id);
    if (['errored', 'cancelled', 'timed_out'].includes(upload.status)) {
      const discarded = await discardMuxUpload(version.id);
      if (discarded && upload.asset_id) await deleteMuxAsset(upload.asset_id).catch(() => {});
      throw new HttpError(409, upload.error?.message || 'Mux upload failed. Please retry.');
    }
    if (upload.status !== 'asset_created' || !upload.asset_id) return Response.json({ ok: true, ready: false });
    const asset = await getMuxAsset(upload.asset_id);
    if (asset.status === 'errored') {
      const discarded = await discardMuxUpload(version.id);
      if (discarded) await deleteMuxAsset(asset.id).catch(() => {});
      throw new HttpError(409, asset.errors?.messages?.[0] || 'Mux could not process this video.');
    }
    if (asset.status !== 'ready') return Response.json({ ok: true, ready: false });
    const ready = await finalizeMuxAsset(version.id, asset);
    return Response.json({ ok: true, ready });
  } catch (error) { return fail(error); }
}
