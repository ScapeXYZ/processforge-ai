begin;

create type public.workspace_role as enum ('owner','admin','editor','viewer');
create type public.sop_workflow_status as enum ('draft','in_review','approved','archived');
create type public.invitation_status as enum ('pending','accepted','revoked','expired');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  owner_id uuid not null references auth.users(id) on delete restrict,
  is_personal boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  joined_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);
create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and char_length(email) <= 320), role public.workspace_role not null check (role <> 'owner'),
  invited_by uuid not null references auth.users(id) on delete cascade, status public.invitation_status not null default 'pending',
  created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '7 days'), accepted_at timestamptz,
  unique(workspace_id,email,status)
);

alter table public.sops add column workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.sops drop constraint if exists sops_status_check;
update public.sops set status='draft' where status='active';
alter table public.sops add constraint sops_status_check check (status in ('draft','in_review','approved','archived'));

insert into public.workspaces(name,owner_id,is_personal)
select coalesce(nullif(trim(p.display_name),''),'Personal')||'''s Workspace',u.id,true from auth.users u left join public.profiles p on p.id=u.id;
insert into public.workspace_members(workspace_id,user_id,role) select id,owner_id,'owner' from public.workspaces where is_personal;
update public.sops s set workspace_id=(select w.id from public.workspaces w where w.owner_id=s.user_id and w.is_personal limit 1);
alter table public.sops alter column workspace_id set not null;

create table public.sop_comments (
  id uuid primary key default gen_random_uuid(), sop_id uuid not null references public.sops(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade, author_id uuid not null references auth.users(id) on delete cascade,
  section text not null check (char_length(section) between 1 and 80), message text not null check (char_length(trim(message)) between 1 and 2000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.sop_activity (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sop_id uuid references public.sops(id) on delete cascade, actor_id uuid references auth.users(id) on delete set null,
  activity_type text not null check (activity_type in ('sop_created','sop_edited','ai_generated','knowledge_used','version_restored','comment_added','review_requested','approval_granted')),
  summary text not null check (char_length(summary) between 1 and 500), metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create index workspace_members_user_idx on public.workspace_members(user_id,workspace_id);
create index invitations_email_idx on public.workspace_invitations(email,status,expires_at desc);
create index sops_workspace_updated_idx on public.sops(workspace_id,updated_at desc);
create index comments_sop_created_idx on public.sop_comments(sop_id,created_at desc);
create index activity_workspace_created_idx on public.sop_activity(workspace_id,created_at desc);

create function public.workspace_role_for(target uuid) returns public.workspace_role language sql stable security definer set search_path='' as $$
 select role from public.workspace_members where workspace_id=target and user_id=(select auth.uid()) limit 1
$$;
create function public.is_workspace_member(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_members where workspace_id=target and user_id=(select auth.uid()))
$$;
create function public.can_edit_workspace(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.workspace_role_for(target) in ('owner','admin','editor'),false)
$$;
create function public.can_manage_workspace(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.workspace_role_for(target) in ('owner','admin'),false)
$$;
create function public.shares_workspace_with(target_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_members mine join public.workspace_members theirs on theirs.workspace_id=mine.workspace_id where mine.user_id=(select auth.uid()) and theirs.user_id=target_user)
$$;

alter table public.workspaces enable row level security; alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security; alter table public.sop_comments enable row level security; alter table public.sop_activity enable row level security;
create policy workspaces_read_member on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_create_owner on public.workspaces for insert to authenticated with check (owner_id=(select auth.uid()));
create policy workspaces_update_manager on public.workspaces for update to authenticated using (public.can_manage_workspace(id)) with check (owner_id=(select owner_id from public.workspaces w where w.id=workspaces.id));
create policy workspaces_delete_owner on public.workspaces for delete to authenticated using (owner_id=(select auth.uid()) and not is_personal);
create policy members_read_member on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy members_add_manager on public.workspace_members for insert to authenticated with check (public.can_manage_workspace(workspace_id) and role<>'owner');
create policy members_update_manager on public.workspace_members for update to authenticated using (public.can_manage_workspace(workspace_id) and role<>'owner') with check (role<>'owner');
create policy members_delete_manager_or_self on public.workspace_members for delete to authenticated using (role<>'owner' and (public.can_manage_workspace(workspace_id) or user_id=(select auth.uid())));
create policy invites_read_manager_or_invitee on public.workspace_invitations for select to authenticated using (public.can_manage_workspace(workspace_id) or email=lower(coalesce((select auth.jwt()->>'email'),'')));
create policy invites_create_manager on public.workspace_invitations for insert to authenticated with check (public.can_manage_workspace(workspace_id) and invited_by=(select auth.uid()) and role<>'owner');
create policy invites_update_manager on public.workspace_invitations for update to authenticated using (public.can_manage_workspace(workspace_id)) with check (public.can_manage_workspace(workspace_id) and role<>'owner');
create policy invites_delete_manager on public.workspace_invitations for delete to authenticated using (public.can_manage_workspace(workspace_id));
create policy comments_read_member on public.sop_comments for select to authenticated using (public.is_workspace_member(workspace_id));
create policy comments_add_member on public.sop_comments for insert to authenticated with check (public.is_workspace_member(workspace_id) and author_id=(select auth.uid()));
create policy comments_update_author on public.sop_comments for update to authenticated using (author_id=(select auth.uid())) with check (author_id=(select auth.uid()));
create policy comments_delete_author_or_manager on public.sop_comments for delete to authenticated using (author_id=(select auth.uid()) or public.can_manage_workspace(workspace_id));
create policy activity_read_member on public.sop_activity for select to authenticated using (public.is_workspace_member(workspace_id));
create policy activity_add_member on public.sop_activity for insert to authenticated with check (public.is_workspace_member(workspace_id) and actor_id=(select auth.uid()));
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_read_workspace_peers on public.profiles for select to authenticated using (id=(select auth.uid()) or public.shares_workspace_with(id));

drop policy if exists sops_select_own on public.sops; drop policy if exists sops_insert_own on public.sops; drop policy if exists sops_update_own on public.sops; drop policy if exists sops_delete_own on public.sops;
create policy sops_read_member on public.sops for select to authenticated using (public.is_workspace_member(workspace_id));
create policy sops_create_editor on public.sops for insert to authenticated with check (public.can_edit_workspace(workspace_id) and user_id=(select auth.uid()));
create policy sops_update_editor on public.sops for update to authenticated using (public.can_edit_workspace(workspace_id)) with check (public.can_manage_workspace(workspace_id) or (public.workspace_role_for(workspace_id)='editor' and status in ('draft','in_review')));
create policy sops_delete_manager on public.sops for delete to authenticated using (public.can_manage_workspace(workspace_id));
drop policy if exists versions_select_own on public.sop_versions; drop policy if exists versions_insert_own on public.sop_versions; drop policy if exists versions_update_own on public.sop_versions; drop policy if exists versions_delete_own on public.sop_versions;
create policy versions_read_member on public.sop_versions for select to authenticated using (exists(select 1 from public.sops s where s.id=sop_id and public.is_workspace_member(s.workspace_id)));
create policy versions_create_editor on public.sop_versions for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.sops s where s.id=sop_id and public.can_edit_workspace(s.workspace_id)));
create policy versions_update_editor on public.sop_versions for update to authenticated using (exists(select 1 from public.sops s where s.id=sop_id and public.can_edit_workspace(s.workspace_id)));
create policy versions_delete_manager on public.sop_versions for delete to authenticated using (exists(select 1 from public.sops s where s.id=sop_id and public.can_manage_workspace(s.workspace_id)));

create function public.accept_workspace_invitation(invitation_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare invite public.workspace_invitations; current_email text:=lower(coalesce(auth.jwt()->>'email',''));
begin select * into invite from public.workspace_invitations where id=invitation_id and status='pending' and expires_at>now() for update;
 if invite.id is null or invite.email<>current_email then raise exception 'Invitation is invalid or expired'; end if;
 insert into public.workspace_members(workspace_id,user_id,role) values(invite.workspace_id,auth.uid(),invite.role) on conflict(workspace_id,user_id) do update set role=excluded.role;
 update public.workspace_invitations set status='accepted',accepted_at=now() where id=invite.id; return invite.workspace_id; end $$;

create function public.create_workspace(workspace_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; begin if char_length(trim(workspace_name)) not between 1 and 100 then raise exception 'Invalid workspace name'; end if;
 insert into public.workspaces(name,owner_id) values(trim(workspace_name),auth.uid()) returning id into result;
 insert into public.workspace_members(workspace_id,user_id,role) values(result,auth.uid(),'owner'); return result; end $$;

create trigger workspaces_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger comments_updated_at before update on public.sop_comments for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare workspace uuid; display text:=nullif(left(trim(coalesce(new.raw_user_meta_data->>'display_name','')),80),'');
begin insert into public.profiles(id,display_name) values(new.id,display); insert into public.workspaces(name,owner_id,is_personal) values(coalesce(display,'Personal')||'''s Workspace',new.id,true) returning id into workspace; insert into public.workspace_members(workspace_id,user_id,role) values(workspace,new.id,'owner'); return new; end $$;

grant select,insert,update,delete on public.workspaces,public.workspace_members,public.workspace_invitations,public.sop_comments,public.sop_activity to authenticated;
grant execute on function public.create_workspace(text),public.accept_workspace_invitation(uuid),public.workspace_role_for(uuid),public.is_workspace_member(uuid),public.can_edit_workspace(uuid),public.can_manage_workspace(uuid),public.shares_workspace_with(uuid) to authenticated;
commit;
