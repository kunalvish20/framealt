export type Role = 'owner' | 'editor' | 'viewer';
export type Project = { id: string; owner_id: string; title: string; description: string; created_at: string; updated_at: string };
export type Asset = { id: string; project_id: string; name: string; kind: string; mime_type: string; created_by: string; created_at: string; current_version: number; folder_id?: string|null; workflow_status?: string|null };
export type Version = { id: string; asset_id: string; version: number; storage_key: string; mime_type: string; size_bytes: number; duration_seconds?:number|null; status: 'uploading'|'ready'; created_by: string; created_at: string; source_provider?: 'r2'|'google_drive'; external_file_id?:string|null; upload_id?: string|null };
import type {ReviewMark} from './annotation';
export type Comment = { id: string; project_id: string; asset_version_id: string; author_id?: string|null; guest_name?: string|null; body: string; time_seconds: number; created_at: string; share_link_id?: string|null; annotation?: ReviewMark[]|null; parent_id?: string|null; resolved_at?: string|null };
export type ShareLink = { id: string; project_id: string; asset_id?: string|null; can_comment: boolean; expires_at?: string|null; revoked_at?: string|null; created_at: string };
