import { NextRequest } from 'next/server';
import { authorized, bad, fail, HttpError, isUuid, json, mustEdit, supabaseAdmin } from '@/lib/server';
import { deleteMuxAsset } from '@/lib/mux';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { db } = await authorized(req);
    const body = await json(req);
    bad(isUuid(body.versionId), 'Invalid version ID.');
    const { data: version, error: lookupError } = await db.from('asset_versions')
      .select('id,asset_id,version,status,source_provider,mux_asset_id,assets(project_id,current_version)')
      .eq('id', body.versionId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!version || version.source_provider !== 'mux') throw new HttpError(404, 'Mux version not found.');
    const asset = version.assets as unknown as { project_id: string; current_version: number } | null;
    if (!asset) throw new HttpError(404, 'File not found.');
    await mustEdit(db, asset.project_id);
    if (version.status !== 'ready' || !version.mux_asset_id) throw new HttpError(409, 'This Mux version is not ready. Cancel a pending upload first.');

    const admin = supabaseAdmin();
    const { data: siblings, error: siblingsError } = await admin.from('asset_versions')
      .select('id,version,status').eq('asset_id', version.asset_id);
    if (siblingsError) throw siblingsError;
    if (!siblings?.some(item => item.id === version.id)) throw new HttpError(409, 'Version changed. Refresh and try again.');
    if (siblings?.some(item => item.status === 'uploading')) throw new HttpError(409, 'Finish or cancel the active upload first.');
    const remaining = siblings.filter(item => item.id !== version.id);
    const nextVersion = Math.max(0, ...remaining.map(item => item.version));

    // Remote deletion comes first so a Mux API failure never silently leaves a billed asset.
    // Mux 404 is safe to retry if a previous attempt removed the remote copy.
    await deleteMuxAsset(version.mux_asset_id);
    if (!remaining.length) {
      const { data: deleted, error } = await admin.from('assets').delete().eq('id', version.asset_id).select('id').maybeSingle();
      if (error) throw error;
      if (!deleted) throw new HttpError(409, 'File changed. Refresh and try again.');
      return Response.json({ ok: true, deletedFile: true });
    }

    if (asset.current_version === version.version) {
      const { data: updated, error } = await admin.from('assets').update({ current_version: nextVersion }).eq('id', version.asset_id).eq('current_version', version.version).select('id').maybeSingle();
      if (error) throw error;
      if (!updated) throw new HttpError(409, 'A newer version was added. Refresh and try again.');
    }
    const { error: deleteError } = await admin.from('asset_versions').delete().eq('id', version.id);
    if (deleteError) {
      if (asset.current_version === version.version) await admin.from('assets').update({ current_version: asset.current_version }).eq('id', version.asset_id);
      throw deleteError;
    }
    return Response.json({ ok: true, deletedFile: false });
  } catch (error) { return fail(error); }
}
