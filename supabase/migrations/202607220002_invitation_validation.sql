begin;

create or replace function public.invite_workspace_member(target_workspace uuid, target_email text, target_role public.workspace_role)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  normalized_email text := lower(trim(target_email));
  invited_user uuid;
  invitation uuid;
begin
  if not public.can_manage_workspace(target_workspace) then raise exception using errcode='42501', message='INVITE_FORBIDDEN'; end if;
  if target_role='owner' then raise exception using errcode='22023', message='INVITE_INVALID_ROLE'; end if;
  if normalized_email !~ '^[A-Za-z0-9_+''.-]+@[A-Za-z0-9-]+([.][A-Za-z0-9-]+)+$' or char_length(normalized_email)>320 then
    raise exception using errcode='22023', message='INVITE_INVALID_EMAIL';
  end if;
  if normalized_email=lower(coalesce(auth.jwt()->>'email','')) then raise exception using errcode='22023', message='INVITE_SELF'; end if;
  select id into invited_user from auth.users where lower(email)=normalized_email limit 1;
  if invited_user is not null and exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=invited_user) then
    raise exception using errcode='23505', message='INVITE_ALREADY_MEMBER';
  end if;
  if exists(select 1 from public.workspace_invitations where workspace_id=target_workspace and email=normalized_email and status='pending' and expires_at>now()) then
    raise exception using errcode='23505', message='INVITE_ALREADY_PENDING';
  end if;
  insert into public.workspace_invitations(workspace_id,email,role,invited_by)
  values(target_workspace,normalized_email,target_role,auth.uid()) returning id into invitation;
  return invitation;
end $$;

grant execute on function public.invite_workspace_member(uuid,text,public.workspace_role) to authenticated;
commit;
