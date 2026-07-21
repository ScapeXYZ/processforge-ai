begin;

-- Remove either previously attempted signature so PostgREST sees exactly one RPC.
drop function if exists public.invite_workspace_member(uuid, text, public.workspace_role);
drop function if exists public.invite_workspace_member(uuid, text, text);

create function public.invite_workspace_member(
  target_workspace uuid,
  target_email text,
  target_role text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_email text := lower(trim(target_email));
  caller_email text;
  invited_user_id uuid;
  invitation_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'INVITE_AUTH_REQUIRED';
  end if;

  if not exists (select 1 from public.workspaces where id = target_workspace) then
    raise exception using errcode = 'P0002', message = 'INVITE_WORKSPACE_NOT_FOUND';
  end if;

  if target_role is null or target_role not in ('admin', 'editor', 'viewer') then
    raise exception using errcode = '22023', message = 'INVITE_INVALID_ROLE';
  end if;

  if normalized_email is null
    or char_length(normalized_email) > 320
    or normalized_email !~ '^[A-Za-z0-9_+''.-]+@[A-Za-z0-9-]+([.][A-Za-z0-9-]+)+$'
  then
    raise exception using errcode = '22023', message = 'INVITE_INVALID_EMAIL';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace
      and user_id = caller_id
      and role in ('owner', 'admin')
  ) then
    raise exception using errcode = '42501', message = 'INVITE_INSUFFICIENT_PERMISSIONS';
  end if;

  select lower(email) into caller_email from auth.users where id = caller_id;
  if normalized_email = caller_email then
    raise exception using errcode = '22023', message = 'INVITE_SELF';
  end if;

  select id into invited_user_id
  from auth.users
  where lower(email) = normalized_email
  limit 1;

  if invited_user_id is not null and exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace and user_id = invited_user_id
  ) then
    raise exception using errcode = '23505', message = 'INVITE_ALREADY_MEMBER';
  end if;

  if exists (
    select 1 from public.workspace_invitations
    where workspace_id = target_workspace
      and email = normalized_email
      and status = 'pending'
  ) then
    raise exception using errcode = '23505', message = 'INVITE_ALREADY_PENDING';
  end if;

  insert into public.workspace_invitations (
    workspace_id, email, role, invited_by, status
  ) values (
    target_workspace,
    normalized_email,
    target_role::public.workspace_role,
    caller_id,
    'pending'
  )
  returning id into invitation_id;

  return invitation_id;
end;
$$;

-- SECURITY DEFINER is required only to look up auth.users and perform the
-- controlled insert. Every authorization and ownership check happens above.
revoke all on function public.invite_workspace_member(uuid, text, text) from public;
revoke all on function public.invite_workspace_member(uuid, text, text) from anon;
grant execute on function public.invite_workspace_member(uuid, text, text) to authenticated;

commit;

notify pgrst, 'reload schema';
