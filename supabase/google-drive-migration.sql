-- Run ONCE (or rerun safely) after the existing supabase/schema.sql.
-- Your Drive files are referenced, not copied into Supabase or R2.
create table if not exists public.google_drive_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_sub text not null,
  email text not null,
  scope text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
-- Clients must never access provider credentials, including their own.
alter table public.google_drive_connections enable row level security;
revoke all on public.google_drive_connections from anon, authenticated;
-- Only server-side service_role has table access (bypasses RLS).

alter table public.asset_versions
  add column if not exists source_provider text not null default 'r2',
  add column if not exists external_file_id text,
  add column if not exists external_owner_id uuid references auth.users(id) on delete set null;

-- Prevent unrecognized providers; legacy R2 versions remain unchanged.
do $$ begin
  if not exists (select 1 from pg_constraint where conname='asset_versions_source_provider_check') then
    alter table public.asset_versions add constraint asset_versions_source_provider_check
      check(source_provider in ('r2','google_drive'));
  end if;
end $$;
create index if not exists google_drive_asset_versions_lookup
  on public.asset_versions(external_owner_id,external_file_id) where source_provider='google_drive';
