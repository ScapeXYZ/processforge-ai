begin;

create extension if not exists pgcrypto;

create table if not exists public.template_categories (
  id uuid primary key default gen_random_uuid(),
  name text,
  slug text,
  description text,
  created_at timestamptz default now()
);

create table if not exists public.marketplace_creator_profiles (
  user_id uuid primary key,
  display_name text,
  joined_at timestamptz default now()
);

create table if not exists public.sop_templates (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid,
  source_sop_id uuid,
  title text,
  slug text,
  summary text,
  description text,
  industry text,
  department text,
  category text,
  tags text[] default '{}',
  category_id uuid,
  template_content jsonb default '{}'::jsonb,
  preview_content text default '',
  visibility text default 'public',
  publication_status text default 'draft',
  moderation_status text default 'draft',
  version text default '1.0',
  compliance_framework text,
  risk_level text,
  is_free boolean default true,
  paid_ready boolean default false,
  usage_count integer default 0,
  favorite_count integer default 0,
  rating_average numeric(3,2) default 0,
  rating_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  published_at timestamptz
);

create table if not exists public.template_tags (
  template_id uuid,
  tag text
);

create table if not exists public.template_ratings (
  template_id uuid,
  user_id uuid,
  rating smallint,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.template_favorites (
  template_id uuid,
  user_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.template_usage (
  id uuid primary key default gen_random_uuid(),
  template_id uuid,
  user_id uuid,
  event_type text,
  session_key text,
  created_at timestamptz default now()
);

alter table public.template_categories add column if not exists id uuid default gen_random_uuid();
alter table public.template_categories add column if not exists name text;
alter table public.template_categories add column if not exists slug text;
alter table public.template_categories add column if not exists description text;
alter table public.template_categories add column if not exists created_at timestamptz default now();

alter table public.marketplace_creator_profiles add column if not exists user_id uuid;
alter table public.marketplace_creator_profiles add column if not exists display_name text;
alter table public.marketplace_creator_profiles add column if not exists joined_at timestamptz default now();

alter table public.sop_templates add column if not exists id uuid default gen_random_uuid();
alter table public.sop_templates add column if not exists creator_id uuid;
alter table public.sop_templates add column if not exists source_sop_id uuid;
alter table public.sop_templates add column if not exists title text;
alter table public.sop_templates add column if not exists slug text;
alter table public.sop_templates add column if not exists summary text;
alter table public.sop_templates add column if not exists description text;
alter table public.sop_templates add column if not exists industry text;
alter table public.sop_templates add column if not exists department text;
alter table public.sop_templates add column if not exists category text;
alter table public.sop_templates add column if not exists tags text[] default '{}';
alter table public.sop_templates add column if not exists category_id uuid;
alter table public.sop_templates add column if not exists template_content jsonb default '{}'::jsonb;
alter table public.sop_templates add column if not exists preview_content text default '';
alter table public.sop_templates add column if not exists visibility text default 'public';
alter table public.sop_templates add column if not exists publication_status text default 'draft';
alter table public.sop_templates add column if not exists moderation_status text default 'draft';
alter table public.sop_templates add column if not exists version text default '1.0';
alter table public.sop_templates add column if not exists compliance_framework text;
alter table public.sop_templates add column if not exists risk_level text;
alter table public.sop_templates add column if not exists is_free boolean default true;
alter table public.sop_templates add column if not exists paid_ready boolean default false;
alter table public.sop_templates add column if not exists usage_count integer default 0;
alter table public.sop_templates add column if not exists favorite_count integer default 0;
alter table public.sop_templates add column if not exists rating_average numeric(3,2) default 0;
alter table public.sop_templates add column if not exists rating_count integer default 0;
alter table public.sop_templates add column if not exists created_at timestamptz default now();
alter table public.sop_templates add column if not exists updated_at timestamptz default now();
alter table public.sop_templates add column if not exists published_at timestamptz;

alter table public.template_tags add column if not exists template_id uuid;
alter table public.template_tags add column if not exists tag text;
alter table public.template_ratings add column if not exists template_id uuid;
alter table public.template_ratings add column if not exists user_id uuid;
alter table public.template_ratings add column if not exists rating smallint;
alter table public.template_ratings add column if not exists created_at timestamptz default now();
alter table public.template_ratings add column if not exists updated_at timestamptz default now();
alter table public.template_favorites add column if not exists template_id uuid;
alter table public.template_favorites add column if not exists user_id uuid;
alter table public.template_favorites add column if not exists created_at timestamptz default now();
alter table public.template_usage add column if not exists id uuid default gen_random_uuid();
alter table public.template_usage add column if not exists template_id uuid;
alter table public.template_usage add column if not exists user_id uuid;
alter table public.template_usage add column if not exists event_type text;
alter table public.template_usage add column if not exists session_key text;
alter table public.template_usage add column if not exists created_at timestamptz default now();

do $$ begin
  if to_regclass('public.sops') is not null then
    alter table public.sops add column if not exists source_template_id uuid;
  end if;
end $$;

drop view if exists public.public_marketplace_templates;

drop trigger if exists template_rating_totals on public.template_ratings;
drop trigger if exists template_favorite_totals on public.template_favorites;
drop trigger if exists template_usage_totals on public.template_usage;
drop trigger if exists templates_updated_at on public.sop_templates;

drop policy if exists categories_public_read on public.template_categories;
drop policy if exists creator_profiles_public_read on public.marketplace_creator_profiles;
drop policy if exists creator_profiles_own_write on public.marketplace_creator_profiles;
drop policy if exists templates_public_or_owner_read on public.sop_templates;
drop policy if exists templates_owner_read on public.sop_templates;
drop policy if exists templates_creator_insert on public.sop_templates;
drop policy if exists templates_creator_update on public.sop_templates;
drop policy if exists templates_creator_delete on public.sop_templates;
drop policy if exists tags_public_read on public.template_tags;
drop policy if exists tags_creator_write on public.template_tags;
drop policy if exists ratings_public_read on public.template_ratings;
drop policy if exists ratings_user_write on public.template_ratings;
drop policy if exists favorites_own on public.template_favorites;
drop policy if exists usage_public_insert on public.template_usage;
drop policy if exists usage_creator_read on public.template_usage;

drop function if exists public.refresh_template_rating() cascade;
drop function if exists public.refresh_template_favorites() cascade;
drop function if exists public.refresh_template_usage() cascade;
drop function if exists public.marketplace_set_updated_at() cascade;
drop function if exists public.is_public_template(uuid) cascade;

update public.template_categories set id=gen_random_uuid() where id is null;
update public.template_categories set name=coalesce(nullif(trim(name),''),'Uncategorized') where name is null or trim(name)='';
update public.template_categories set slug=lower(regexp_replace(coalesce(nullif(trim(slug),''),name||'-'||left(id::text,8)),'[^a-zA-Z0-9]+','-','g')) where slug is null or trim(slug)='';
update public.marketplace_creator_profiles set display_name='ProcessForge Creator' where display_name is null or trim(display_name)='';
update public.sop_templates set id=gen_random_uuid() where id is null;
update public.sop_templates set title='Untitled SOP Template' where title is null or trim(title)='';
update public.sop_templates set slug='sop-template-'||left(id::text,8) where slug is null or trim(slug)='';
update public.sop_templates set summary='Reusable ProcessForge standard operating procedure template.' where summary is null or trim(summary)='';
update public.sop_templates set description=summary where description is null or trim(description)='';
update public.sop_templates set category=coalesce(nullif(trim(category),''),'Uncategorized') where category is null or trim(category)='';
update public.sop_templates set tags='{}' where tags is null;
update public.sop_templates set template_content='{}'::jsonb where template_content is null;
update public.sop_templates set preview_content='' where preview_content is null;
update public.sop_templates set visibility='public' where visibility is null;
update public.sop_templates set publication_status='draft' where publication_status is null;
update public.sop_templates set moderation_status='draft' where moderation_status is null;
update public.sop_templates set version='1.0' where version is null;
update public.sop_templates set usage_count=0 where usage_count is null or usage_count<0;
update public.sop_templates set favorite_count=0 where favorite_count is null or favorite_count<0;
update public.sop_templates set rating_average=0 where rating_average is null or rating_average<0 or rating_average>5;
update public.sop_templates set rating_count=0 where rating_count is null or rating_count<0;
update public.sop_templates set created_at=now() where created_at is null;
update public.sop_templates set updated_at=coalesce(created_at,now()) where updated_at is null;

delete from public.template_tags a using public.template_tags b where a.ctid>b.ctid and a.template_id=b.template_id and a.tag=b.tag;
delete from public.template_ratings a using public.template_ratings b where a.ctid<b.ctid and a.template_id=b.template_id and a.user_id=b.user_id;
delete from public.template_favorites a using public.template_favorites b where a.ctid>b.ctid and a.template_id=b.template_id and a.user_id=b.user_id;
with ranked as(select ctid,id,slug,row_number() over(partition by slug order by created_at nulls last,ctid) as position from public.template_categories) update public.template_categories c set slug=left(r.slug,80)||'-'||left(r.id::text,8) from ranked r where c.ctid=r.ctid and r.position>1;
with ranked as(select ctid,id,slug,row_number() over(partition by slug order by created_at nulls last,ctid) as position from public.sop_templates) update public.sop_templates t set slug=left(r.slug,80)||'-'||left(r.id::text,8) from ranked r where t.ctid=r.ctid and r.position>1;

create unique index if not exists template_categories_slug_uidx on public.template_categories(slug);
create unique index if not exists sop_templates_slug_uidx on public.sop_templates(slug);
create unique index if not exists template_tags_identity_uidx on public.template_tags(template_id,tag);
create unique index if not exists template_ratings_identity_uidx on public.template_ratings(template_id,user_id);
create unique index if not exists template_favorites_identity_uidx on public.template_favorites(template_id,user_id);
create index if not exists templates_public_discovery_idx on public.sop_templates(publication_status,moderation_status,visibility,published_at desc);
create index if not exists templates_industry_department_idx on public.sop_templates(industry,department);
create index if not exists templates_popular_idx on public.sop_templates(usage_count desc,rating_average desc);
create index if not exists template_usage_template_created_idx on public.template_usage(template_id,created_at desc);

create function pg_temp.marketplace_uuid_column(target_schema text,target_table text,target_column text) returns boolean language sql stable as $$
  select exists(select 1 from information_schema.columns c where c.table_schema=target_schema and c.table_name=target_table and c.column_name=target_column and c.udt_name='uuid')
$$;

do $$
begin
  if pg_temp.marketplace_uuid_column('public','marketplace_creator_profiles','user_id') and not exists(select 1 from pg_constraint where conname='marketplace_creator_profiles_user_id_fkey' and conrelid='public.marketplace_creator_profiles'::regclass) then
    alter table public.marketplace_creator_profiles add constraint marketplace_creator_profiles_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade not valid;
  end if;
  if pg_temp.marketplace_uuid_column('public','sop_templates','creator_id') and not exists(select 1 from pg_constraint where conname='sop_templates_creator_id_fkey' and conrelid='public.sop_templates'::regclass) then
    alter table public.sop_templates add constraint sop_templates_creator_id_fkey foreign key(creator_id) references auth.users(id) on delete cascade not valid;
  end if;
  if to_regclass('public.sops') is not null and pg_temp.marketplace_uuid_column('public','sop_templates','source_sop_id') and pg_temp.marketplace_uuid_column('public','sops','id') and not exists(select 1 from pg_constraint where conname='sop_templates_source_sop_id_fkey' and conrelid='public.sop_templates'::regclass) then
    alter table public.sop_templates add constraint sop_templates_source_sop_id_fkey foreign key(source_sop_id) references public.sops(id) on delete set null not valid;
  end if;
  if pg_temp.marketplace_uuid_column('public','sop_templates','category_id') and pg_temp.marketplace_uuid_column('public','template_categories','id') and not exists(select 1 from pg_constraint where conname='sop_templates_category_id_fkey' and conrelid='public.sop_templates'::regclass) then
    alter table public.sop_templates add constraint sop_templates_category_id_fkey foreign key(category_id) references public.template_categories(id) on delete set null not valid;
  end if;
  if pg_temp.marketplace_uuid_column('public','template_tags','template_id') and pg_temp.marketplace_uuid_column('public','sop_templates','id') and not exists(select 1 from pg_constraint where conname='template_tags_template_id_fkey' and conrelid='public.template_tags'::regclass) then
    alter table public.template_tags add constraint template_tags_template_id_fkey foreign key(template_id) references public.sop_templates(id) on delete cascade not valid;
  end if;
  if pg_temp.marketplace_uuid_column('public','template_ratings','template_id') and pg_temp.marketplace_uuid_column('public','sop_templates','id') and not exists(select 1 from pg_constraint where conname='template_ratings_template_id_fkey' and conrelid='public.template_ratings'::regclass) then
    alter table public.template_ratings add constraint template_ratings_template_id_fkey foreign key(template_id) references public.sop_templates(id) on delete cascade not valid;
  end if;
  if pg_temp.marketplace_uuid_column('public','template_ratings','user_id') and not exists(select 1 from pg_constraint where conname='template_ratings_user_id_fkey' and conrelid='public.template_ratings'::regclass) then
    alter table public.template_ratings add constraint template_ratings_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade not valid;
  end if;
  if pg_temp.marketplace_uuid_column('public','template_favorites','template_id') and pg_temp.marketplace_uuid_column('public','sop_templates','id') and not exists(select 1 from pg_constraint where conname='template_favorites_template_id_fkey' and conrelid='public.template_favorites'::regclass) then
    alter table public.template_favorites add constraint template_favorites_template_id_fkey foreign key(template_id) references public.sop_templates(id) on delete cascade not valid;
  end if;
  if pg_temp.marketplace_uuid_column('public','template_favorites','user_id') and not exists(select 1 from pg_constraint where conname='template_favorites_user_id_fkey' and conrelid='public.template_favorites'::regclass) then
    alter table public.template_favorites add constraint template_favorites_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade not valid;
  end if;
  if pg_temp.marketplace_uuid_column('public','template_usage','template_id') and pg_temp.marketplace_uuid_column('public','sop_templates','id') and not exists(select 1 from pg_constraint where conname='template_usage_template_id_fkey' and conrelid='public.template_usage'::regclass) then
    alter table public.template_usage add constraint template_usage_template_id_fkey foreign key(template_id) references public.sop_templates(id) on delete cascade not valid;
  end if;
  if pg_temp.marketplace_uuid_column('public','template_usage','user_id') and not exists(select 1 from pg_constraint where conname='template_usage_user_id_fkey' and conrelid='public.template_usage'::regclass) then
    alter table public.template_usage add constraint template_usage_user_id_fkey foreign key(user_id) references auth.users(id) on delete set null not valid;
  end if;
  if to_regclass('public.sops') is not null and pg_temp.marketplace_uuid_column('public','sops','source_template_id') and pg_temp.marketplace_uuid_column('public','sop_templates','id') and not exists(select 1 from pg_constraint where conname='sops_source_template_id_fkey' and conrelid='public.sops'::regclass) then
    alter table public.sops add constraint sops_source_template_id_fkey foreign key(source_template_id) references public.sop_templates(id) on delete set null not valid;
  end if;
end $$;

create function public.is_public_template(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.sop_templates t where t.id=target and t.visibility in('public','unlisted') and t.publication_status='published' and t.moderation_status='approved')
$$;
create function public.marketplace_set_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end $$;
create function public.refresh_template_rating() returns trigger language plpgsql security definer set search_path='' as $$ declare target uuid;begin target=case when tg_op='DELETE' then old.template_id else new.template_id end;update public.sop_templates t set rating_average=coalesce((select avg(r.rating) from public.template_ratings r where r.template_id=target),0),rating_count=(select count(*) from public.template_ratings r where r.template_id=target) where t.id=target;if tg_op='DELETE' then return old;end if;return new;end $$;
create function public.refresh_template_favorites() returns trigger language plpgsql security definer set search_path='' as $$ declare target uuid;begin target=case when tg_op='DELETE' then old.template_id else new.template_id end;update public.sop_templates t set favorite_count=(select count(*) from public.template_favorites f where f.template_id=target) where t.id=target;if tg_op='DELETE' then return old;end if;return new;end $$;
create function public.refresh_template_usage() returns trigger language plpgsql security definer set search_path='' as $$ begin if new.event_type='copy' then update public.sop_templates set usage_count=usage_count+1 where id=new.template_id;end if;return new;end $$;

create trigger templates_updated_at before update on public.sop_templates for each row execute function public.marketplace_set_updated_at();
create trigger template_rating_totals after insert or update or delete on public.template_ratings for each row execute function public.refresh_template_rating();
create trigger template_favorite_totals after insert or delete on public.template_favorites for each row execute function public.refresh_template_favorites();
create trigger template_usage_totals after insert on public.template_usage for each row execute function public.refresh_template_usage();

create view public.public_marketplace_templates with(security_barrier=true) as
select id,creator_id,title,slug,summary,description,industry,department,category,tags,category_id,template_content,preview_content,visibility,publication_status,moderation_status,version,compliance_framework,risk_level,is_free,paid_ready,usage_count,favorite_count,rating_average,rating_count,created_at,updated_at,published_at
from public.sop_templates where visibility in('public','unlisted') and publication_status='published' and moderation_status='approved';

alter table public.template_categories enable row level security;
alter table public.marketplace_creator_profiles enable row level security;
alter table public.sop_templates enable row level security;
alter table public.template_tags enable row level security;
alter table public.template_ratings enable row level security;
alter table public.template_favorites enable row level security;
alter table public.template_usage enable row level security;

create policy categories_public_read on public.template_categories for select using(true);
create policy creator_profiles_public_read on public.marketplace_creator_profiles for select using(true);
create policy creator_profiles_own_write on public.marketplace_creator_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy templates_owner_read on public.sop_templates for select to authenticated using(creator_id=auth.uid());
create policy templates_creator_insert on public.sop_templates for insert to authenticated with check(creator_id=auth.uid() and (source_sop_id is null or exists(select 1 from public.sops s where s.id=source_sop_id and public.can_edit_workspace(s.workspace_id))));
create policy templates_creator_update on public.sop_templates for update to authenticated using(creator_id=auth.uid()) with check(creator_id=auth.uid());
create policy templates_creator_delete on public.sop_templates for delete to authenticated using(creator_id=auth.uid());
create policy tags_public_read on public.template_tags for select using(public.is_public_template(template_id) or exists(select 1 from public.sop_templates t where t.id=template_id and t.creator_id=auth.uid()));
create policy tags_creator_write on public.template_tags for all to authenticated using(exists(select 1 from public.sop_templates t where t.id=template_id and t.creator_id=auth.uid())) with check(exists(select 1 from public.sop_templates t where t.id=template_id and t.creator_id=auth.uid()));
create policy ratings_public_read on public.template_ratings for select using(true);
create policy ratings_user_write on public.template_ratings for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and not exists(select 1 from public.sop_templates t where t.id=template_id and t.creator_id=auth.uid()));
create policy favorites_own on public.template_favorites for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy usage_public_insert on public.template_usage for insert with check(public.is_public_template(template_id));
create policy usage_creator_read on public.template_usage for select to authenticated using(exists(select 1 from public.sop_templates t where t.id=template_id and t.creator_id=auth.uid()));

revoke all on public.sop_templates,public.template_categories,public.template_tags,public.template_ratings,public.template_favorites,public.template_usage,public.marketplace_creator_profiles from anon,authenticated;
grant select on public.public_marketplace_templates,public.template_categories,public.marketplace_creator_profiles,public.template_tags,public.template_ratings to anon,authenticated;
grant select,insert,update,delete on public.sop_templates,public.template_tags,public.template_ratings,public.template_favorites,public.marketplace_creator_profiles to authenticated;
grant insert on public.template_usage to anon,authenticated;
grant select on public.template_usage to authenticated;
grant execute on function public.is_public_template(uuid) to anon,authenticated;

insert into public.template_categories(name,slug,description)
select seed.name,seed.slug,seed.description from(values
 ('Operations','operations','Daily and recurring operational processes'),
 ('Finance','finance','Financial controls and accounting workflows'),
 ('Human Resources','human-resources','People operations and employee lifecycle'),
 ('Customer Service','customer-service','Customer support and service delivery'),
 ('Quality & Compliance','quality-compliance','Governance, quality and audit processes')
) seed(name,slug,description)
where not exists(select 1 from public.template_categories c where c.slug=seed.slug);

commit;

notify pgrst, 'reload schema';
