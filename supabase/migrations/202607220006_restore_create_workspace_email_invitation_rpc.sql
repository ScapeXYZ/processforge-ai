begin;

-- Keep this migration safe for databases where the email-delivery columns were
-- not added by an earlier deployment. Existing invitation rows are preserved.
alter table public.workspace_invitations
  add column if not exists token_hash text;

alter table public.workspace_invitations
  add column if not exists sent_at timestamptz;

alter table public.workspace_invitations
  add column if not exists email_delivery_status text not null default 'not_sent';

alter table public.workspace_invitations
  add column if not exists email_delivery_error text;

create unique index if not exists workspace_invitations_token_hash_idx
  on public.workspace_invitations (token_hash)
  where token_hash is not null;

do $constraint$
begin
  alter table public.workspace_invitations
    add constraint workspace_invitations_delivery_status_check
    check (email_delivery_status in ('not_sent', 'pending', 'sent', 'failed'));
exception
  when duplicate_object then null;
end
$constraint$;

-- Dropping only this function signature permits this repair to correct stale
-- argument names as well as recreate a missing function for PostgREST.
drop function if exists public.create_workspace_email_invitation(uuid, text, text, text);

create function public.create_workspace_email_invitation(
  target_email text,
  target_role text,
  target_token_hash text,
  target_workspace uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller uuid := auth.uid();
  normalized_email text := lower(trim(target_email));
  invited_user_id uuid;
  invitation_id uuid;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'INVITE_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace
  ) then
    raise exception using errcode = 'P0002', message = 'INVITE_WORKSPACE_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = caller
      and wm.role in ('owner', 'admin')
  ) then
    raise exception using errcode = '42501', message = 'INVITE_INSUFFICIENT_PERMISSIONS';
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

  if target_token_hash is null
    or char_length(target_token_hash) <> 64
    or target_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception using errcode = '22023', message = 'INVITE_INVALID_TOKEN';
  end if;

  if normalized_email = (
    select lower(u.email)
    from auth.users u
    where u.id = caller
  ) then
    raise exception using errcode = '22023', message = 'INVITE_SELF';
  end if;

  select u.id
  into invited_user_id
  from auth.users u
  where lower(u.email) = normalized_email
  limit 1;

  if invited_user_id is not null and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = invited_user_id
  ) then
    raise exception using errcode = '23505', message = 'INVITE_ALREADY_MEMBER';
  end if;

  if exists (
    select 1
    from public.workspace_invitations wi
    where wi.workspace_id = target_workspace
      and wi.email = normalized_email
      and wi.status = 'pending'
  ) then
    raise exception using errcode = '23505', message = 'INVITE_ALREADY_PENDING';
  end if;

  insert into public.workspace_invitations (
    workspace_id,
    email,
    role,
    invited_by,
    status,
    expires_at,
    token_hash,
    email_delivery_status,
    email_delivery_error,
    sent_at
  )
  values (
    target_workspace,
    normalized_email,
    target_role::public.workspace_role,
    caller,
    'pending',
    now() + interval '7 days',
    target_token_hash,
    'pending',
    null,
    null
  )
  returning id into invitation_id;

  return invitation_id;
end
$function$;

revoke all on function public.create_workspace_email_invitation(text, text, text, uuid)
  from public, anon;

grant execute on function public.create_workspace_email_invitation(text, text, text, uuid)
  to authenticated;

commit;

notify pgrst, 'reload schema';
