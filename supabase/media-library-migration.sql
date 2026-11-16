-- FreeFrame media-library / folder hierarchy migration.
-- Run AFTER schema.sql and google-drive-migration.sql, once, in the same Supabase project.
-- Google Drive originals and versions are NOT moved or copied.
create table if not exists public.project_folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.project_folders(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_folder_not_self check (parent_id is distinct from id)
);
create index if not exists project_folders_project_parent_idx on public.project_folders(project_id,parent_id,name);
-- Case-insensitive folder names unique within a directory (root included).
create unique index if not exists project_folders_sibling_unique
  on public.project_folders(project_id,coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(name));

create or replace function public.validate_freeframe_folder() returns trigger
language plpgsql set search_path = '' as $$
declare parent_project uuid; loop_found boolean;
begin
 new.name := btrim(new.name);
 if new.parent_id is not null then
   select project_id into parent_project from public.project_folders where id=new.parent_id;
   if parent_project is null or parent_project<>new.project_id then
     raise exception 'Parent must be in the same project';
   end if;
   with recursive ancestors as (
     select id,parent_id from public.project_folders where id=new.parent_id
     union all
     select f.id,f.parent_id from public.project_folders f join ancestors a on a.parent_id=f.id
   ) select exists(select 1 from ancestors where id=new.id) into loop_found;
   if loop_found then raise exception 'Cannot move a folder into its own descendant'; end if;
 end if;
 new.updated_at:=now();
 return new;
end $$;
drop trigger if exists validate_freeframe_folder_trg on public.project_folders;
create trigger validate_freeframe_folder_trg before insert or update on public.project_folders
for each row execute function public.validate_freeframe_folder();

alter table public.assets add column if not exists folder_id uuid references public.project_folders(id) on delete restrict;
create index if not exists freeframe_assets_project_folder_idx on public.assets(project_id,folder_id,created_at desc);
create or replace function public.validate_freeframe_asset_folder() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.folder_id is not null and not exists (
   select 1 from public.project_folders where id=new.folder_id and project_id=new.project_id
 ) then raise exception 'Asset folder must belong to the same project'; end if;
 return new;
end $$;
drop trigger if exists validate_freeframe_asset_folder_trg on public.assets;
create trigger validate_freeframe_asset_folder_trg before insert or update on public.assets
for each row execute function public.validate_freeframe_asset_folder();

alter table public.project_folders enable row level security;
create policy "project members read their folders" on public.project_folders
 for select to authenticated using (public.member_of_project(project_id));
-- No direct client write policies: authenticated calls go through /api/library/organize
-- with a checked project owner/editor role. service_role bypasses RLS.
