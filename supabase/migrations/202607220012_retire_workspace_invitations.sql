begin;

-- Phase 17 retains historical invitation objects and records for audit and
-- migration compatibility, but removes them from every active application role.
do $block$
declare
  invitation_function record;
begin
  for invitation_function in
    select procedure.oid::regprocedure as signature
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'invite_workspace_member',
        'accept_workspace_invitation',
        'create_workspace_email_invitation',
        'prepare_workspace_invitation_resend',
        'accept_workspace_invitation_token'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', invitation_function.signature);
  end loop;
end
$block$;

do $block$
begin
  if to_regclass('public.workspace_invitations') is not null then
    revoke all on table public.workspace_invitations from public, anon, authenticated;
    comment on table public.workspace_invitations is
      'Inactive legacy invitation records retained for audit history. Workspace invitations are not included in the current release.';
  end if;
end
$block$;

commit;
notify pgrst, 'reload schema';
