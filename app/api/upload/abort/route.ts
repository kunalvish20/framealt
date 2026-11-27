import { NextRequest } from 'next/server';
import { authorized, bad, fail, HttpError, isUuid, json, mustEdit } from '@/lib/server';
import { cancelMuxUpload, deleteMuxAsset, getMuxUpload } from '@/lib/mux';
import { discardMuxUpload } from '@/lib/mux-finalize';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { db, user } = await authorized(req);
    const body = await json(req);
    bad(isUuid(body.versionId), 'Invalid version ID');
    const { data: version } = await db.from('asset_versions')
      .select('id,status,upload_id,source_provider,created_by,assets(project_id)')
      .eq('id', body.versionId).single();
    if (!version || version.source_provider !== 'mux' || version.created_by !== user.id || version.status !== 'uploading') throw new HttpError(404, 'Active upload not found');
    await mustEdit(db, (version.assets as unknown as { project_id: string }).project_id);
    if (version.upload_id) {
      const upload = await getMuxUpload(version.upload_id);
      if (upload.status === 'waiting') await cancelMuxUpload(upload.id);
      else if (upload.asset_id) await deleteMuxAsset(upload.asset_id);
    }
    await discardMuxUpload(version.id);
    return Response.json({ ok: true });
  } catch (error) { return fail(error); }
}
