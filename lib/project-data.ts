import type { SupabaseClient } from '@supabase/supabase-js';

// PostgREST follows the declared FK chain; RLS remains in force at every level.
// Internal object keys and multipart upload IDs are not needed by the interface.
export const UI_VERSION_COLUMNS = 'id,asset_id,version,mime_type,size_bytes,status,created_by,created_at,source_provider,assets!inner(project_id)';
export function projectVersions(db: SupabaseClient, projectId: string) {
  return db.from('asset_versions').select(UI_VERSION_COLUMNS).eq('assets.project_id', projectId).order('version', { ascending: false });
}
export function projectApprovals(db: SupabaseClient, projectId: string) {
  return db.from('approvals').select('id,asset_version_id,user_id,status,asset_versions!inner(assets!inner(project_id))').eq('asset_versions.assets.project_id', projectId);
}
