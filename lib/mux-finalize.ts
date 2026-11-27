import { supabaseAdmin } from './server';
import type { MuxAsset } from './mux';

export async function finalizeMuxAsset(versionId: string, asset: MuxAsset) {
  if (asset.status !== 'ready' || asset.passthrough !== versionId) return false;
  const playbackId = asset.playback_ids?.find(id => id.policy === 'signed')?.id;
  if (!playbackId) throw new Error('Mux asset has no signed playback ID.');
  const admin = supabaseAdmin();
  const { data: version, error: lookupError } = await admin.from('asset_versions')
    .select('id,asset_id,version,status,source_provider,assets(current_version)')
    .eq('id', versionId).maybeSingle();
  if (lookupError) throw lookupError;
  if (!version || version.source_provider !== 'mux') return false;
  if (version.status !== 'ready') {
    const { error } = await admin.from('asset_versions').update({
      status: 'ready', upload_id: null, mux_asset_id: asset.id, mux_playback_id: playbackId,
      ...(Number.isFinite(asset.duration) && (asset.duration || 0) > 0 ? { duration_seconds: asset.duration } : {}),
    }).eq('id', versionId).eq('status', 'uploading');
    if (error) throw error;
  }
  const current = (version.assets as unknown as { current_version: number }).current_version;
  if (version.version > current) {
    const updated = await admin.from('assets').update({ current_version: version.version }).eq('id', version.asset_id).lt('current_version', version.version);
    if (updated.error) throw updated.error;
  }
  return true;
}

export async function discardMuxUpload(versionId: string) {
  const admin = supabaseAdmin();
  const { data: version, error: lookupError } = await admin.from('asset_versions').select('id,asset_id,status,assets(current_version)').eq('id', versionId).eq('source_provider', 'mux').maybeSingle();
  if (lookupError) throw lookupError;
  if (!version || version.status !== 'uploading') return false;
  const removed = await admin.from('asset_versions').delete().eq('id', versionId).eq('status', 'uploading');
  if (removed.error) throw removed.error;
  if ((version.assets as unknown as { current_version: number }).current_version === 0) {
    await admin.from('assets').delete().eq('id', version.asset_id);
  }
  return true;
}
