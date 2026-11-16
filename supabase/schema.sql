-- FreeFrame Cloud schema: paste into Supabase SQL Editor as ONE migration.
-- Existing FreeFrame SQLAlchemy schema is NOT compatible with these tables.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Member' check (char_length(display_name) between 1 and 80),
 created_at timestamptz not null default now()
);

create or replace function public.new_user_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name) values(new.id, coalesce(nullif(left(new.raw_user_meta_data->>'display_name',80),''), split_part(new.email,'@',1),'Member')) on conflict(id) do nothing;
 return new;
end; $$;
drop trigger if exists on_auth_user_created_freeframe on auth.users;
create trigger on_auth_user_created_freeframe after insert on auth.users for each row execute function public.new_user_profile();
insert into public.profiles(id,display_name)
select id,coalesce(nullif(left(raw_user_meta_data->>'display_name',80),''),split_part(email,'@',1),'Member') from auth.users
on conflict(id) do nothing;

create table if not exists public.projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 140),
 description text not null default '' check (char_length(description) <= 3000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create or replace function public.protect_project_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if new.owner_id <> old.owner_id then raise exception 'Project owner cannot be changed.'; end if;
 return new;
end; $$;
drop trigger if exists protect_freeframe_project_owner on public.projects;
create trigger protect_freeframe_project_owner before update on public.projects for each row execute function public.protect_project_owner();

create table if not exists public.project_members (
 project_id uuid not null references public.projects(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','editor','viewer')),
 joined_at timestamptz not null default now(),
 primary key(project_id,user_id)
);
create index if not exists project_members_user_idx on public.project_members(user_id);

-- SECURITY DEFINER prevents infinite recursion in project_members RLS.
-- Only return the role of auth.uid(); function cannot ask for other users' roles.
create or replace function public.my_project_role(p_project_id uuid) returns text
language sql stable security definer set search_path = '' as $$
 select role from public.project_members where project_id=p_project_id and user_id=(select auth.uid()) limit 1;
$$;
create or replace function public.is_project_owner(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.projects where id=p_project_id and owner_id=(select auth.uid()));
$$;
create or replace function public.member_of_project(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.my_project_role(p_project_id) is not null;
$$;
create or replace function public.can_edit_project(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.my_project_role(p_project_id) in ('owner','editor');
$$;

create or replace function public.add_owner_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.project_members(project_id,user_id,role) values(new.id,new.owner_id,'owner');
 return new;
end; $$;
drop trigger if exists after_freeframe_project_create on public.projects;
create trigger after_freeframe_project_create after insert on public.projects for each row execute function public.add_owner_membership();

create table if not exists public.assets (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 240),
 kind text not null check(kind in ('image','video','audio')),
 mime_type text not null,
 current_version integer not null default 0 check(current_version >= 0),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists assets_project_idx on public.assets(project_id,created_at desc);

create or replace function public.asset_project(p_asset_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
 select project_id from public.assets where id=p_asset_id;
$$;

create table if not exists public.asset_versions (
 id uuid primary key default gen_random_uuid(),
 asset_id uuid not null references public.assets(id) on delete cascade,
 version integer not null check(version > 0),
 storage_key text not null unique,
 mime_type text not null,
 size_bytes bigint not null check(size_bytes > 0),
 status text not null default 'uploading' check(status in ('uploading','ready')),
 upload_id text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(asset_id,version)
);
create index if not exists asset_versions_asset_idx on public.asset_versions(asset_id,version desc);

create table if not exists public.share_links (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 asset_id uuid references public.assets(id) on delete cascade,
 token_hash text not null unique check(char_length(token_hash)=64),
 can_comment boolean not null default true,
 expires_at timestamptz,
 revoked_at timestamptz,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists share_links_project_idx on public.share_links(project_id);

create table if not exists public.comments (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 asset_version_id uuid not null references public.asset_versions(id) on delete cascade,
 author_id uuid references auth.users(id) on delete set null,
 guest_name text check(guest_name is null or char_length(guest_name) between 1 and 80),
 share_link_id uuid references public.share_links(id) on delete set null,
 body text not null check(char_length(body) between 1 and 3000),
 time_seconds numeric(12,3) not null default 0 check(time_seconds >= 0),
 created_at timestamptz not null default now(),
 check ((author_id is not null) <> (guest_name is not null))
);
create index if not exists comments_version_idx on public.comments(asset_version_id, time_seconds, created_at);

create table if not exists public.approvals (
 id uuid primary key default gen_random_uuid(),
 asset_version_id uuid not null references public.asset_versions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null check(status in ('approved','changes_requested')),
 note text not null default '' check(char_length(note)<=1000),
 created_at timestamptz not null default now(),
 unique(asset_version_id,user_id)
);

-- RPC to add an existing Supabase Auth user without exposing email lists to clients.
create or replace function public.invite_existing_user(p_project_id uuid, p_email text, p_role text default 'viewer')
returns text language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_email text := lower(trim(p_email));
begin
 if not public.is_project_owner(p_project_id) then raise exception 'Only the project owner can add members.'; end if;
 if p_role not in ('editor','viewer') then raise exception 'Invalid role.'; end if;
 if length(v_email) > 254 or position('@' in v_email) = 0 then raise exception 'Invalid email.'; end if;
 select id into v_user from auth.users where lower(email)=v_email limit 1;
 if v_user is null then return 'not_registered'; end if;
 if exists(select 1 from public.project_members where project_id=p_project_id and user_id=v_user and role='owner') then return 'already_owner'; end if;
 insert into public.project_members(project_id,user_id,role) values(p_project_id,v_user,p_role)
 on conflict(project_id,user_id) do update set role=excluded.role;
 return 'added';
end; $$;
revoke all on function public.invite_existing_user(uuid,text,text) from public;
grant execute on function public.invite_existing_user(uuid,text,text) to authenticated;
revoke all on function public.my_project_role(uuid) from public;
grant execute on function public.my_project_role(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.assets enable row level security;
alter table public.asset_versions enable row level security;
alter table public.comments enable row level security;
alter table public.approvals enable row level security;
alter table public.share_links enable row level security;

create policy "profiles read for logged in users" on public.profiles for select to authenticated using (true);
create policy "profiles edit own" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "project members see projects" on public.projects for select to authenticated using(public.member_of_project(id));
create policy "users create their projects" on public.projects for insert to authenticated with check(owner_id=auth.uid());
create policy "editors edit projects" on public.projects for update to authenticated using(public.can_edit_project(id)) with check(public.can_edit_project(id));
-- To delete a project, use a server route that deletes its R2 objects first; DB deletes are deliberately disabled.
create policy "project members see fellow members" on public.project_members for select to authenticated using(public.member_of_project(project_id));
create policy "project members see assets" on public.assets for select to authenticated using(public.member_of_project(project_id));
create policy "project members see versions" on public.asset_versions for select to authenticated using(public.member_of_project(public.asset_project(asset_id)));
create policy "project members see comments" on public.comments for select to authenticated using(public.member_of_project(project_id));
create policy "member writes own comments" on public.comments for insert to authenticated with check(public.member_of_project(project_id) and author_id=auth.uid() and guest_name is null and share_link_id is null and exists(select 1 from public.asset_versions v join public.assets a on a.id=v.asset_id where v.id=asset_version_id and a.project_id=project_id));
create policy "member deletes own comments" on public.comments for delete to authenticated using(author_id=auth.uid() and share_link_id is null);
create policy "members see approvals" on public.approvals for select to authenticated using(public.member_of_project(public.asset_project((select asset_id from public.asset_versions where id=asset_version_id))));
create policy "members approve own" on public.approvals for insert to authenticated with check(user_id=auth.uid() and public.member_of_project(public.asset_project((select asset_id from public.asset_versions where id=asset_version_id))));
create policy "members update own approvals" on public.approvals for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and public.member_of_project(public.asset_project((select asset_id from public.asset_versions where id=asset_version_id))));
create policy "editors see shares" on public.share_links for select to authenticated using(public.can_edit_project(project_id));
-- Share and asset mutations are handled by authorized server routes, not direct browser writes.

-- Optional publication to enable change events if you choose to subscribe later:
-- alter publication supabase_realtime add table public.comments;

-- Share comment rate limit: 6 comments per IP + share link per minute.
create table if not exists public.guest_comment_limits (
 share_link_id uuid not null references public.share_links(id) on delete cascade,
 client_hash text not null,
 window_start timestamptz not null,
 attempts integer not null default 1,
 primary key(share_link_id,client_hash,window_start)
);
alter table public.guest_comment_limits enable row level security; -- no direct grants/policies
create or replace function public.throttle_share_comment(p_share_id uuid,p_client_ip text)
returns boolean language plpgsql security definer set search_path='' as $$
declare count_now integer; clipped_ip text := left(p_client_ip,64);
begin
 insert into public.guest_comment_limits(share_link_id,client_hash,window_start,attempts)
 values(p_share_id,pg_catalog.md5(p_share_id::text || ':' || clipped_ip),date_trunc('minute',now()),1)
 on conflict(share_link_id,client_hash,window_start) do update set attempts=public.guest_comment_limits.attempts+1
 returning attempts into count_now;
 return count_now <= 6;
end; $$;
revoke all on function public.throttle_share_comment(uuid,text) from public,anon,authenticated;
grant execute on function public.throttle_share_comment(uuid,text) to service_role;
-- Periodically remove counters older than 2 days via Supabase scheduled maintenance:
-- delete from public.guest_comment_limits where window_start < now() - interval '2 days';
