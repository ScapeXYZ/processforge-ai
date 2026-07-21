begin;

alter table public.workspace_invitations add column if not exists token_hash text;
alter table public.workspace_invitations add column if not exists sent_at timestamptz;
alter table public.workspace_invitations add column if not exists email_delivery_status text not null default 'not_sent';
alter table public.workspace_invitations add column if not exists email_delivery_error text;

create or replace function public.workspace_role_for(target uuid)
returns public.workspace_role language sql stable security definer set search_path='' as $$
  select wm.role from public.workspace_members wm
  where wm.workspace_id=target and wm.user_id=auth.uid() limit 1
$$;
create or replace function public.can_manage_workspace(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.workspace_members wm where wm.workspace_id=target and wm.user_id=auth.uid() and wm.role in ('owner','admin'))
$$;
create or replace function public.can_edit_workspace(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.workspace_members wm where wm.workspace_id=target and wm.user_id=auth.uid() and wm.role in ('owner','admin','editor'))
$$;

create or replace function public.invite_workspace_member(target_workspace uuid,target_email text,target_role text)
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); normalized text:=lower(trim(target_email)); invited uuid; result uuid;
begin
  if caller is null then raise exception using errcode='42501',message='INVITE_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.workspaces where id=target_workspace) then raise exception using errcode='P0002',message='INVITE_WORKSPACE_NOT_FOUND'; end if;
  if not public.can_manage_workspace(target_workspace) then raise exception using errcode='42501',message='INVITE_INSUFFICIENT_PERMISSIONS'; end if;
  if target_role not in ('admin','editor','viewer') then raise exception using errcode='22023',message='INVITE_INVALID_ROLE'; end if;
  if normalized=(select lower(email) from auth.users where id=caller) then raise exception using errcode='22023',message='INVITE_SELF'; end if;
  select id into invited from auth.users where lower(email)=normalized limit 1;
  if invited is not null and exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=invited) then raise exception using errcode='23505',message='INVITE_ALREADY_MEMBER'; end if;
  if exists(select 1 from public.workspace_invitations where workspace_id=target_workspace and email=normalized and status='pending') then raise exception using errcode='23505',message='INVITE_ALREADY_PENDING'; end if;
  insert into public.workspace_invitations(workspace_id,email,role,invited_by,status,expires_at) values(target_workspace,normalized,target_role::public.workspace_role,caller,'pending',now()+interval '7 days') returning id into result;
  return result;
end $$;

create or replace function public.create_workspace_email_invitation(target_workspace uuid,target_email text,target_role text,target_token_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); normalized text:=lower(trim(target_email)); invited uuid; result uuid;
begin
  if caller is null then raise exception using errcode='42501',message='INVITE_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.workspaces where id=target_workspace) then raise exception using errcode='P0002',message='INVITE_WORKSPACE_NOT_FOUND'; end if;
  if not public.can_manage_workspace(target_workspace) then raise exception using errcode='42501',message='INVITE_INSUFFICIENT_PERMISSIONS'; end if;
  if target_role not in ('admin','editor','viewer') then raise exception using errcode='22023',message='INVITE_INVALID_ROLE'; end if;
  if normalized is null or char_length(normalized)>320 or normalized !~ '^[A-Za-z0-9_+''.-]+@[A-Za-z0-9-]+([.][A-Za-z0-9-]+)+$' then raise exception using errcode='22023',message='INVITE_INVALID_EMAIL'; end if;
  if target_token_hash is null or char_length(target_token_hash)<>64 then raise exception using errcode='22023',message='INVITE_INVALID_TOKEN'; end if;
  if normalized=(select lower(email) from auth.users where id=caller) then raise exception using errcode='22023',message='INVITE_SELF'; end if;
  select id into invited from auth.users where lower(email)=normalized limit 1;
  if invited is not null and exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=invited) then raise exception using errcode='23505',message='INVITE_ALREADY_MEMBER'; end if;
  if exists(select 1 from public.workspace_invitations where workspace_id=target_workspace and email=normalized and status='pending') then raise exception using errcode='23505',message='INVITE_ALREADY_PENDING'; end if;
  insert into public.workspace_invitations(workspace_id,email,role,invited_by,status,expires_at,token_hash,email_delivery_status) values(target_workspace,normalized,target_role::public.workspace_role,caller,'pending',now()+interval '7 days',target_token_hash,'pending') returning id into result;
  return result;
end $$;

create or replace function public.prepare_workspace_invitation_resend(target_invitation uuid,target_token_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); invite public.workspace_invitations;
begin
  if caller is null then raise exception using errcode='42501',message='INVITE_AUTH_REQUIRED'; end if;
  select * into invite from public.workspace_invitations where id=target_invitation for update;
  if invite.id is null then raise exception using errcode='P0002',message='INVITE_NOT_FOUND'; end if;
  if not public.can_manage_workspace(invite.workspace_id) then raise exception using errcode='42501',message='INVITE_INSUFFICIENT_PERMISSIONS'; end if;
  if invite.status='accepted' then raise exception using errcode='22023',message='INVITE_ALREADY_ACCEPTED'; end if;
  if invite.status='revoked' then raise exception using errcode='22023',message='INVITE_REVOKED'; end if;
  if invite.status<>'pending' then raise exception using errcode='22023',message='INVITE_INVALID_STATUS'; end if;
  if invite.sent_at is not null and invite.sent_at>now()-interval '60 seconds' then raise exception using errcode='P0001',message='INVITE_RATE_LIMITED'; end if;
  update public.workspace_invitations set token_hash=target_token_hash,expires_at=now()+interval '7 days',email_delivery_status='pending',email_delivery_error=null where id=invite.id;
  return invite.id;
end $$;

drop policy if exists invites_update_manager on public.workspace_invitations;
create policy invites_update_manager on public.workspace_invitations for update to authenticated
using (public.can_manage_workspace(workspace_id))
with check (public.can_manage_workspace(workspace_id) and role<>'owner');

revoke all on function public.invite_workspace_member(uuid,text,text),public.create_workspace_email_invitation(uuid,text,text,text),public.prepare_workspace_invitation_resend(uuid,text) from public,anon;
grant execute on function public.workspace_role_for(uuid),public.can_manage_workspace(uuid),public.can_edit_workspace(uuid),public.invite_workspace_member(uuid,text,text),public.create_workspace_email_invitation(uuid,text,text,text),public.prepare_workspace_invitation_resend(uuid,text) to authenticated;
commit;
notify pgrst,'reload schema';
