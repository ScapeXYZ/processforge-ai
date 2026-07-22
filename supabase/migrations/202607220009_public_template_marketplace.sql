begin;

alter table public.sops add column if not exists source_template_id uuid;

create table if not exists public.template_categories (
  id uuid primary key default gen_random_uuid(), name text not null unique check(char_length(trim(name)) between 2 and 80),
  slug text not null unique check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'), description text, created_at timestamptz not null default now()
);
create table if not exists public.marketplace_creator_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade, display_name text not null check(char_length(trim(display_name)) between 1 and 80), joined_at timestamptz not null default now()
);
create table if not exists public.sop_templates (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references auth.users(id) on delete cascade,
  source_sop_id uuid references public.sops(id) on delete set null, title text not null check(char_length(trim(title)) between 3 and 140),
  slug text not null unique check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'), summary text not null check(char_length(trim(summary)) between 20 and 300),
  description text not null check(char_length(trim(description)) between 20 and 4000), industry text, department text,
  category_id uuid references public.template_categories(id) on delete set null, template_content jsonb not null, preview_content text not null check(char_length(preview_content)<=5000),
  visibility text not null default 'public' check(visibility in('public','unlisted','private')),
  publication_status text not null default 'draft' check(publication_status in('draft','published','unpublished','archived')),
  moderation_status text not null default 'draft' check(moderation_status in('draft','pending_review','approved','rejected','archived')),
  version text not null default '1.0', compliance_framework text, risk_level text check(risk_level is null or risk_level in('critical','high','medium','low')),
  is_free boolean not null default true, paid_ready boolean not null default false, usage_count integer not null default 0 check(usage_count>=0),
  favorite_count integer not null default 0 check(favorite_count>=0), rating_average numeric(3,2) not null default 0 check(rating_average between 0 and 5),
  rating_count integer not null default 0 check(rating_count>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);
alter table public.sops drop constraint if exists sops_source_template_id_fkey;
alter table public.sops add constraint sops_source_template_id_fkey foreign key(source_template_id) references public.sop_templates(id) on delete set null;
create table if not exists public.template_tags(template_id uuid not null references public.sop_templates(id) on delete cascade,tag text not null check(char_length(trim(tag)) between 1 and 40),primary key(template_id,tag));
create table if not exists public.template_ratings(template_id uuid not null references public.sop_templates(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,rating smallint not null check(rating between 1 and 5),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(template_id,user_id));
create table if not exists public.template_favorites(template_id uuid not null references public.sop_templates(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(template_id,user_id));
create table if not exists public.template_usage(id uuid primary key default gen_random_uuid(),template_id uuid not null references public.sop_templates(id) on delete cascade,user_id uuid references auth.users(id) on delete set null,event_type text not null check(event_type in('view','copy')),session_key text,created_at timestamptz not null default now());

create index if not exists templates_public_discovery_idx on public.sop_templates(publication_status,moderation_status,visibility,published_at desc);
create index if not exists templates_industry_department_idx on public.sop_templates(industry,department);
create index if not exists templates_popular_idx on public.sop_templates(usage_count desc,rating_average desc);
create index if not exists template_usage_template_created_idx on public.template_usage(template_id,created_at desc);

create or replace view public.public_marketplace_templates with (security_barrier=true) as
select id,creator_id,title,slug,summary,description,industry,department,category_id,template_content,preview_content,visibility,publication_status,moderation_status,version,compliance_framework,risk_level,is_free,paid_ready,usage_count,favorite_count,rating_average,rating_count,created_at,updated_at,published_at
from public.sop_templates where visibility in('public','unlisted') and publication_status='published' and moderation_status='approved';
create or replace function public.is_public_template(target uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.sop_templates t where t.id=target and t.visibility in('public','unlisted') and t.publication_status='published' and t.moderation_status='approved') $$;

alter table public.template_categories enable row level security;alter table public.marketplace_creator_profiles enable row level security;alter table public.sop_templates enable row level security;alter table public.template_tags enable row level security;alter table public.template_ratings enable row level security;alter table public.template_favorites enable row level security;alter table public.template_usage enable row level security;
drop policy if exists categories_public_read on public.template_categories;create policy categories_public_read on public.template_categories for select using(true);
drop policy if exists creator_profiles_public_read on public.marketplace_creator_profiles;create policy creator_profiles_public_read on public.marketplace_creator_profiles for select using(true);
drop policy if exists creator_profiles_own_write on public.marketplace_creator_profiles;create policy creator_profiles_own_write on public.marketplace_creator_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists templates_public_or_owner_read on public.sop_templates;drop policy if exists templates_owner_read on public.sop_templates;create policy templates_owner_read on public.sop_templates for select to authenticated using(creator_id=auth.uid());
drop policy if exists templates_creator_insert on public.sop_templates;create policy templates_creator_insert on public.sop_templates for insert to authenticated with check(creator_id=auth.uid() and source_sop_id in(select s.id from public.sops s where public.can_edit_workspace(s.workspace_id)));
drop policy if exists templates_creator_update on public.sop_templates;create policy templates_creator_update on public.sop_templates for update to authenticated using(creator_id=auth.uid()) with check(creator_id=auth.uid());
drop policy if exists templates_creator_delete on public.sop_templates;create policy templates_creator_delete on public.sop_templates for delete to authenticated using(creator_id=auth.uid());
drop policy if exists tags_public_read on public.template_tags;create policy tags_public_read on public.template_tags for select using(public.is_public_template(template_id) or exists(select 1 from public.sop_templates t where t.id=template_id and t.creator_id=auth.uid()));
drop policy if exists tags_creator_write on public.template_tags;create policy tags_creator_write on public.template_tags for all to authenticated using(exists(select 1 from public.sop_templates t where t.id=template_id and t.creator_id=auth.uid())) with check(exists(select 1 from public.sop_templates t where t.id=template_id and t.creator_id=auth.uid()));
drop policy if exists ratings_public_read on public.template_ratings;create policy ratings_public_read on public.template_ratings for select using(true);
drop policy if exists ratings_user_write on public.template_ratings;create policy ratings_user_write on public.template_ratings for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and not exists(select 1 from public.sop_templates t where t.id=template_id and t.creator_id=auth.uid()));
drop policy if exists favorites_own on public.template_favorites;create policy favorites_own on public.template_favorites for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists usage_public_insert on public.template_usage;create policy usage_public_insert on public.template_usage for insert with check(public.is_public_template(template_id));
drop policy if exists usage_creator_read on public.template_usage;create policy usage_creator_read on public.template_usage for select to authenticated using(exists(select 1 from public.sop_templates t where t.id=template_id and t.creator_id=auth.uid()));

create or replace function public.refresh_template_rating() returns trigger language plpgsql security definer set search_path='' as $$ begin update public.sop_templates t set rating_average=coalesce((select avg(r.rating) from public.template_ratings r where r.template_id=coalesce(new.template_id,old.template_id)),0),rating_count=(select count(*) from public.template_ratings r where r.template_id=coalesce(new.template_id,old.template_id)) where t.id=coalesce(new.template_id,old.template_id);return coalesce(new,old);end $$;
drop trigger if exists template_rating_totals on public.template_ratings;create trigger template_rating_totals after insert or update or delete on public.template_ratings for each row execute function public.refresh_template_rating();
create or replace function public.refresh_template_favorites() returns trigger language plpgsql security definer set search_path='' as $$ begin update public.sop_templates t set favorite_count=(select count(*) from public.template_favorites f where f.template_id=coalesce(new.template_id,old.template_id)) where t.id=coalesce(new.template_id,old.template_id);return coalesce(new,old);end $$;
drop trigger if exists template_favorite_totals on public.template_favorites;create trigger template_favorite_totals after insert or delete on public.template_favorites for each row execute function public.refresh_template_favorites();
create or replace function public.refresh_template_usage() returns trigger language plpgsql security definer set search_path='' as $$ begin if new.event_type='copy' then update public.sop_templates set usage_count=usage_count+1 where id=new.template_id;end if;return new;end $$;
drop trigger if exists template_usage_totals on public.template_usage;create trigger template_usage_totals after insert on public.template_usage for each row execute function public.refresh_template_usage();
drop trigger if exists templates_updated_at on public.sop_templates;create trigger templates_updated_at before update on public.sop_templates for each row execute function public.set_updated_at();

grant select on public.template_categories,public.marketplace_creator_profiles,public.public_marketplace_templates,public.template_tags,public.template_ratings to anon,authenticated;
revoke select on public.sop_templates from anon;grant select,insert,update,delete on public.sop_templates,public.template_tags,public.template_ratings,public.template_favorites to authenticated;
grant insert on public.template_usage to anon,authenticated;grant select on public.template_usage to authenticated;
grant execute on function public.is_public_template(uuid) to anon,authenticated;
insert into public.template_categories(name,slug,description) values('Operations','operations','Daily and recurring operational processes'),('Finance','finance','Financial controls and accounting workflows'),('Human Resources','human-resources','People operations and employee lifecycle'),('Customer Service','customer-service','Customer support and service delivery'),('Quality & Compliance','quality-compliance','Governance, quality and audit processes') on conflict(slug) do nothing;
commit;
notify pgrst,'reload schema';
