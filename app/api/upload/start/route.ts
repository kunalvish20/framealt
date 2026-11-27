import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { authorized, bad, fail, HttpError, isUuid, json, mustEdit, supabaseAdmin } from '@/lib/server';
import { MAX_UPLOAD_BYTES, validUpload } from '@/lib/limits';
import { cancelMuxUpload, createMuxUpload } from '@/lib/mux';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { db, user } = await authorized(req);
    const body = await json(req);
    bad(isUuid(body.projectId), 'Invalid project ID');
    bad(typeof body.fileName === 'string' && body.fileName.trim().length > 0 && body.fileName.length <= 240, 'Invalid file name');
    bad(validUpload(body.size, body.mimeType) && body.mimeType.startsWith('video/'), 'Mux cloud upload accepts video files up to 50 GiB. Link images and audio from Google Drive.');
    await mustEdit(db, body.projectId);

    const admin = supabaseAdmin();
    let assetId = randomUUID();
    let version = 1;
    const newAsset = !body.assetId;
    if (body.assetId) {
      bad(isUuid(body.assetId), 'Invalid asset ID');
      const { data: existing } = await db.from('assets').select('id,kind,current_version').eq('id', body.assetId).eq('project_id', body.projectId).single();
      if (!existing) throw new HttpError(404, 'Asset not found');
      if (existing.kind !== 'video') throw new HttpError(400, 'Mux can only add video versions.');
      assetId = existing.id;
      version = existing.current_version + 1;
      const { data: pending } = await db.from('asset_versions').select('id').eq('asset_id', assetId).eq('status', 'uploading').limit(1);
      if (pending?.length) throw new HttpError(409, 'Another version is uploading. Complete it before starting another.');
    } else {
      const { error } = await admin.from('assets').insert({ id: assetId, project_id: body.projectId, name: body.fileName.trim(), kind: 'video', mime_type: body.mimeType, created_by: user.id });
      if (error) throw new HttpError(400, error.message);
    }

    const versionId = randomUUID();
    let muxUploadId: string | undefined;
    try {
      const { error } = await admin.from('asset_versions').insert({
        id: versionId, asset_id: assetId, version, storage_key: 'mux/' + versionId,
        size_bytes: body.size, mime_type: body.mimeType, created_by: user.id,
        status: 'uploading', source_provider: 'mux',
        ...(Number.isFinite(body.durationSeconds) && body.durationSeconds > 0 && body.durationSeconds < 1e8 ? { duration_seconds: body.durationSeconds } : {}),
      });
      if (error) throw new HttpError(409, error.message);
      const origin = req.headers.get('origin') || req.nextUrl.origin;
      const upload = await createMuxUpload(versionId, origin);
      muxUploadId = upload.id;
      const saved = await admin.from('asset_versions').update({ upload_id: upload.id }).eq('id', versionId).eq('status', 'uploading');
      if (saved.error) throw saved.error;
      return Response.json({ assetId, versionId, version, uploadUrl: upload.url, maxUploadBytes: MAX_UPLOAD_BYTES });
    } catch (error) {
      if (muxUploadId) await cancelMuxUpload(muxUploadId).catch(() => {});
      await admin.from('asset_versions').delete().eq('id', versionId);
      if (newAsset) await admin.from('assets').delete().eq('id', assetId);
      throw error;
    }
  } catch (error) { return fail(error); }
}
