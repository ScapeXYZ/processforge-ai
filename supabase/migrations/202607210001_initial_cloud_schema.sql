begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  industry text, department text, description text, audience text, detail_level text,
  status text not null default 'active' check (status in ('active','draft','archived')),
  content jsonb not null,
  readiness_score integer check (readiness_score between 0 and 100),
  input_quality_score integer check (input_quality_score between 0 and 100),
  source_notes jsonb,
  knowledge_source_names text[] not null default '{}',
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sop_versions (
  id uuid primary key default gen_random_uuid(),
  sop_id uuid not null references public.sops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number text not null check (char_length(version_number) between 1 and 40),
  change_summary text check (change_summary is null or char_length(change_summary) <= 500),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (sop_id, version_number)
);

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 240),
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 10485760),
  word_count integer check (word_count is null or word_count >= 0),
  character_count integer check (character_count is null or character_count >= 0),
  enabled boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, size_bytes)
);

create index sops_user_updated_idx on public.sops(user_id, updated_at desc);
create index sops_user_archive_idx on public.sops(user_id, is_archived, is_favorite);
create index sop_versions_sop_created_idx on public.sop_versions(sop_id, created_at desc);
create index sop_versions_user_created_idx on public.sop_versions(user_id, created_at desc);
create index knowledge_documents_user_updated_idx on public.knowledge_documents(user_id, updated_at desc);

create function public.set_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger sops_updated_at before update on public.sops for each row execute function public.set_updated_at();
create trigger knowledge_documents_updated_at before update on public.knowledge_documents for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.sops enable row level security;
alter table public.sop_versions enable row level security;
alter table public.knowledge_documents enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated using ((select auth.uid()) = id);

create policy "sops_select_own" on public.sops for select to authenticated using ((select auth.uid()) = user_id);
create policy "sops_insert_own" on public.sops for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "sops_update_own" on public.sops for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "sops_delete_own" on public.sops for delete to authenticated using ((select auth.uid()) = user_id);

create policy "versions_select_own" on public.sop_versions for select to authenticated using ((select auth.uid()) = user_id and exists (select 1 from public.sops where sops.id = sop_id and sops.user_id = (select auth.uid())));
create policy "versions_insert_own" on public.sop_versions for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.sops where sops.id = sop_id and sops.user_id = (select auth.uid())));
create policy "versions_update_own" on public.sop_versions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "versions_delete_own" on public.sop_versions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "documents_select_own" on public.knowledge_documents for select to authenticated using ((select auth.uid()) = user_id);
create policy "documents_insert_own" on public.knowledge_documents for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "documents_update_own" on public.knowledge_documents for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "documents_delete_own" on public.knowledge_documents for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.profiles, public.sops, public.sop_versions, public.knowledge_documents to authenticated;
commit;
