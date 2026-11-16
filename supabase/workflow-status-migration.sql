-- Run after schema.sql. Stores a file's workflow label separately from
-- per-version reviewer approval decisions. Safe to rerun.
alter table public.assets add column if not exists workflow_status text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'freeframe_asset_workflow_status_length') then
    alter table public.assets add constraint freeframe_asset_workflow_status_length
      check (workflow_status is null or char_length(btrim(workflow_status)) between 1 and 40);
  end if;
end $$;

create index if not exists freeframe_assets_workflow_status_idx
  on public.assets(project_id, workflow_status);
-- Existing project-members SELECT policy reads this column. Writes are only
-- performed by the server route after checking owner/editor membership.
