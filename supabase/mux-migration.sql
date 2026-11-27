-- Run in Supabase SQL Editor after schema.sql and google-drive-migration.sql.
-- Keeps existing R2 and Google Drive versions readable while new video uploads use Mux.
alter table public.asset_versions
  add column if not exists mux_asset_id text,
  add column if not exists mux_playback_id text;

alter table public.asset_versions drop constraint if exists asset_versions_source_provider_check;
alter table public.asset_versions add constraint asset_versions_source_provider_check
  check (source_provider in ('r2', 'google_drive', 'mux'));

create unique index if not exists asset_versions_mux_asset_id_idx
  on public.asset_versions(mux_asset_id) where mux_asset_id is not null;
create index if not exists asset_versions_mux_upload_id_idx
  on public.asset_versions(upload_id) where source_provider = 'mux' and upload_id is not null;
