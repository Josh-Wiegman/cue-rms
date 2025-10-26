-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Vehicles catalogue
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  location text not null,
  name text not null,
  license_plate text not null unique,
  status text not null default 'active' check (status in ('active', 'sold', 'archived')),
  purchase_date date,
  vin text,
  engine text,
  chassis text,
  odometer text,
  fuel_type text,
  transmission text,
  gross_vehicle_mass text,
  notes text
);

create table if not exists public.vehicle_maintenance_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  date date,
  entered_by text,
  work text,
  odo_reading text,
  performed_at text,
  outcome text,
  cost text,
  notes text,
  locked boolean not null default false
);

-- Timestamp maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row
execute procedure public.set_updated_at();

create trigger maintenance_set_updated_at
before update on public.vehicle_maintenance_records
for each row
execute procedure public.set_updated_at();

-- Row level security configuration
alter table public.vehicles enable row level security;
alter table public.vehicle_maintenance_records enable row level security;

-- Auth helpers assume a custom JWT claim "auth_level" where 1 = admin, 2 = standard user.

create policy "Vehicles readable by authorised users"
  on public.vehicles
  for select
  using (public.get_vehicle_auth_level() in (1, 2));

-- Helper to read the auth level from the request context. The edge function sets
-- the custom GUC "app.auth_level" for each transaction based on the user's
-- supplied authorisation level. If the value is missing we fall back to the
-- non-admin role (2).
create or replace function public.get_vehicle_auth_level()
returns integer
language sql
stable
as $$
  select coalesce(current_setting('app.auth_level', true)::int, 2);
$$;

create policy "Vehicles maintainable by admins"
  on public.vehicles
  for all
  using (public.get_vehicle_auth_level() = 1)
  with check (public.get_vehicle_auth_level() = 1);

create policy "Maintenance readable by authorised users"
  on public.vehicle_maintenance_records
  for select
  using (public.get_vehicle_auth_level() in (1, 2));

create policy "Maintenance manageable by admins"
  on public.vehicle_maintenance_records
  for delete using (public.get_vehicle_auth_level() = 1);

create policy "Maintenance insert for crew"
  on public.vehicle_maintenance_records
  for insert
  with check (
    public.get_vehicle_auth_level() in (1, 2)
    and coalesce(locked, false) = false
  );

create policy "Maintenance update when unlocked"
  on public.vehicle_maintenance_records
  for update
  using (
    public.get_vehicle_auth_level() = 1
    or (public.get_vehicle_auth_level() = 2 and locked = false)
  )
  with check (
    public.get_vehicle_auth_level() = 1
    or (public.get_vehicle_auth_level() = 2 and coalesce(locked, false) = false)
  );
