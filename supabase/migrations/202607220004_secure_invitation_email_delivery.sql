begin;

alter table public.workspace_invitations add column if not exists token_hash text;
alter table public.workspace_invitations add column if not exists sent_at timestamptz;
alter table public.workspace_invitations add column if not exists email_delivery_status text not null default 'not_sent';
alter table public.workspace_invitations add column if not exists email_delivery_error text;

create unique index if not exists workspace_invitations_token_hash_idx
  on public.workspace_invitations(token_hash) where token_hash is not null;

do $$ begin
  alter table public.workspace_invitations add constraint workspace_invitations_delivery_status_check
    check (email_delivery_status in ('not_sent','pending','sent','failed'));
exception when duplicate_object then null; end $$;

create or replace function public.create_workspace_email_invitation(
  target_workspace uuid, target_email text, target_role text, target_token_hash text
) returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); normalized text:=lower(trim(target_email)); invited_user uuid; result uuid;
begin
  if caller is null then raise exception using errcode='42501',message='INVITE_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.workspaces where id=target_workspace) then raise exception using errcode='P0002',message='INVITE_WORKSPACE_NOT_FOUND'; end if;
  if not exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=caller and role in ('owner','admin')) then raise exception using errcode='42501',message='INVITE_INSUFFICIENT_PERMISSIONS'; end if;
  if target_role is null or target_role not in ('admin','editor','viewer') then raise exception using errcode='22023',message='INVITE_INVALID_ROLE'; end if;
  if normalized is null or char_length(normalized)>320 or normalized !~ '^[A-Za-z0-9_+''.-]+@[A-Za-z0-9-]+([.][A-Za-z0-9-]+)+$' then raise exception using errcode='22023',message='INVITE_INVALID_EMAIL'; end if;
  if target_token_hash is null or char_length(target_token_hash)<>64 or target_token_hash !~ '^[0-9a-f]+$' then raise exception using errcode='22023',message='INVITE_INVALID_TOKEN'; end if;
  if normalized=(select lower(email) from auth.users where id=caller) then raise exception using errcode='22023',message='INVITE_SELF'; end if;
  select id into invited_user from auth.users where lower(email)=normalized limit 1;
  if invited_user is not null and exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=invited_user) then raise exception using errcode='23505',message='INVITE_ALREADY_MEMBER'; end if;
  if exists(select 1 from public.workspace_invitations where workspace_id=target_workspace and email=normalized and status='pending') then raise exception using errcode='23505',message='INVITE_ALREADY_PENDING'; end if;
  insert into public.workspace_invitations(workspace_id,email,role,invited_by,status,expires_at,token_hash,email_delivery_status)
  values(target_workspace,normalized,target_role::public.workspace_role,caller,'pending',now()+interval '7 days',target_token_hash,'pending') returning id into result;
  return result;
end $$;

create or replace function public.prepare_workspace_invitation_resend(
  target_invitation uuid, target_token_hash text
) returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); invite public.workspace_invitations;
begin
  if caller is null then raise exception using errcode='42501',message='INVITE_AUTH_REQUIRED'; end if;
  select * into invite from public.workspace_invitations where id=target_invitation for update;
  if invite.id is null then raise exception using errcode='P0002',message='INVITE_NOT_FOUND'; end if;
  if not exists(select 1 from public.workspace_members where workspace_id=invite.workspace_id and user_id=caller and role in ('owner','admin')) then raise exception using errcode='42501',message='INVITE_INSUFFICIENT_PERMISSIONS'; end if;
  if invite.status='accepted' then raise exception using errcode='22023',message='INVITE_ALREADY_ACCEPTED'; end if;
  if invite.status='revoked' then raise exception using errcode='22023',message='INVITE_REVOKED'; end if;
  if invite.status<>'pending' then raise exception using errcode='22023',message='INVITE_INVALID_STATUS'; end if;
  if invite.sent_at is not null and invite.sent_at>now()-interval '60 seconds' then raise exception using errcode='P0001',message='INVITE_RATE_LIMITED'; end if;
  if target_token_hash is null or char_length(target_token_hash)<>64 or target_token_hash !~ '^[0-9a-f]+$' then raise exception using errcode='22023',message='INVITE_INVALID_TOKEN'; end if;
  update public.workspace_invitations set token_hash=target_token_hash,expires_at=now()+interval '7 days',email_delivery_status='pending',email_delivery_error=null where id=invite.id;
  return invite.id;
end $$;

create or replace function public.accept_workspace_invitation_token(target_token_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); caller_email text; invite public.workspace_invitations;
begin
  if caller is null then raise exception using errcode='42501',message='INVITE_AUTH_REQUIRED'; end if;
  select lower(email) into caller_email from auth.users where id=caller;
  select * into invite from public.workspace_invitations where token_hash=target_token_hash for update;
  if invite.id is null then raise exception using errcode='P0002',message='INVITE_INVALID_TOKEN'; end if;
  if invite.status='accepted' then raise exception using errcode='22023',message='INVITE_ALREADY_ACCEPTED'; end if;
  if invite.status='revoked' then raise exception using errcode='22023',message='INVITE_REVOKED'; end if;
  if invite.status<>'pending' then raise exception using errcode='22023',message='INVITE_INVALID_STATUS'; end if;
  if invite.expires_at<=now() then raise exception using errcode='22023',message='INVITE_EXPIRED'; end if;
  if caller_email<>invite.email then raise exception using errcode='42501',message='INVITE_WRONG_ACCOUNT'; end if;
  if exists(select 1 from public.workspace_members where workspace_id=invite.workspace_id and user_id=caller) then raise exception using errcode='23505',message='INVITE_ALREADY_MEMBER'; end if;
  insert into public.workspace_members(workspace_id,user_id,role) values(invite.workspace_id,caller,invite.role);
  update public.workspace_invitations set status='accepted',accepted_at=now(),token_hash=null where id=invite.id;
  return invite.workspace_id;
end $$;

revoke all on function public.create_workspace_email_invitation(uuid,text,text,text) from public,anon;
revoke all on function public.prepare_workspace_invitation_resend(uuid,text) from public,anon;
revoke all on function public.accept_workspace_invitation_token(text) from public,anon;
grant execute on function public.create_workspace_email_invitation(uuid,text,text,text) to authenticated;
grant execute on function public.prepare_workspace_invitation_resend(uuid,text) to authenticated;
grant execute on function public.accept_workspace_invitation_token(text) to authenticated;
commit;
notify pgrst,'reload schema';
