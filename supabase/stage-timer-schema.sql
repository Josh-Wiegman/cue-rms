-- Stage Timer schema
-- Creates core tables for scenes, timers, and notes powering the Stage Timer tool.

create extension if not exists "pgcrypto";

create table if not exists public.stage_timer_scenes (
  id uuid primary key default gen_random_uuid(),
  org_slug text not null,
  name text not null,
  is_master boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_slug, name)
);

create table if not exists public.stage_timer_timers (
  id uuid primary key default gen_random_uuid(),
  org_slug text not null,
  scene_id uuid not null references public.stage_timer_scenes(id) on delete cascade,
  name text not null,
  duration_seconds integer not null default 0,
  remaining_seconds integer not null default 0,
  status text not null default 'idle',
  code text not null,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_slug, code)
);

create table if not exists public.stage_timer_notes (
  id uuid primary key default gen_random_uuid(),
  org_slug text not null,
  timer_id uuid not null references public.stage_timer_timers(id) on delete cascade,
  body text not null,
  is_urgent boolean not null default false,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

-- Grants for authenticated users via RLS. Adjust to match your security model.
alter table public.stage_timer_scenes enable row level security;
alter table public.stage_timer_timers enable row level security;
alter table public.stage_timer_notes enable row level security;

create policy "Scenes are per organisation"
  on public.stage_timer_scenes
  using (org_slug = coalesce(current_setting('request.jwt.claims', true)::json->>'org_slug', 'public'));

create policy "Timers are per organisation"
  on public.stage_timer_timers
  using (org_slug = coalesce(current_setting('request.jwt.claims', true)::json->>'org_slug', 'public'));

create policy "Notes are per organisation"
  on public.stage_timer_notes
  using (org_slug = coalesce(current_setting('request.jwt.claims', true)::json->>'org_slug', 'public'));

-- Helper upsert to ensure a master scene exists per org.
create or replace function public.ensure_stage_timer_master_scene(target_org text)
returns uuid
language plpgsql
as $$
declare
  master_scene uuid;
begin
  select id into master_scene
  from public.stage_timer_scenes
  where org_slug = target_org and is_master = true
  limit 1;

  if master_scene is null then
    insert into public.stage_timer_scenes (org_slug, name, is_master)
    values (target_org, 'Master Scene', true)
    returning id into master_scene;
  end if;

  return master_scene;
end;
$$;
