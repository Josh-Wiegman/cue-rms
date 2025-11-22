-- PartyHire schema for Supabase (scalable for RMS)
-- Uses multi-tenant org_slug column and keeps stock allocation counts for availability.

create extension if not exists "uuid-ossp";

create table if not exists public.partyhire_inventory (
  id bigserial primary key,
  org_slug text not null default 'public',
  sku text not null,
  name text not null,
  category text not null default 'General',
  description text,
  total_quantity integer not null default 0,
  allocated_quantity integer not null default 0,
  unit_price numeric(12,2) not null default 0,
  daily_rate numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partyhire_inventory_org_sku unique (org_slug, sku)
);

create table if not exists public.partyhire_orders (
  id uuid primary key default uuid_generate_v4(),
  org_slug text not null default 'public',
  reference text not null,
  quote_number text not null,
  invoice_number text not null,
  customer_name text not null,
  contact_email text not null,
  contact_phone text,
  event_name text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  location text not null,
  delivery_method text not null default 'pickup',
  notes text,
  recipients text[] not null default array[]::text[],
  status text not null default 'Prepped',
  subtotal numeric(12,2) not null default 0,
  gst numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partyhire_order_items (
  id bigserial primary key,
  order_id uuid not null references public.partyhire_orders(id) on delete cascade,
  stock_id bigint not null references public.partyhire_inventory(id),
  quantity integer not null,
  returned_quantity integer not null default 0,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null default 0
);

create index if not exists idx_partyhire_orders_org on public.partyhire_orders(org_slug);
create index if not exists idx_partyhire_inventory_org on public.partyhire_inventory(org_slug);
create index if not exists idx_partyhire_order_items_order on public.partyhire_order_items(order_id);

create or replace view public.partyhire_inventory_view as
select
  i.*, 
  (i.total_quantity - i.allocated_quantity) as available_quantity
from public.partyhire_inventory i;

-- Helper function to upsert inventory counts
create or replace function public.partyhire_adjust_allocation(target_org text, stock_id bigint, delta integer)
returns void
language plpgsql
as $$
begin
  update public.partyhire_inventory
  set allocated_quantity = greatest(0, allocated_quantity + delta),
      updated_at = now()
  where id = stock_id and org_slug = target_org;
end;
$$;

-- RLS placeholders (customize per deployment)
alter table public.partyhire_orders enable row level security;
alter table public.partyhire_inventory enable row level security;
alter table public.partyhire_order_items enable row level security;

-- Sample permissive policy for development
create policy if not exists partyhire_orders_tenant_read on public.partyhire_orders
  for select using (true);
create policy if not exists partyhire_inventory_tenant_read on public.partyhire_inventory
  for select using (true);
create policy if not exists partyhire_order_items_tenant_read on public.partyhire_order_items
  for select using (true);

create policy if not exists partyhire_orders_tenant_write on public.partyhire_orders
  for all using (true) with check (true);
create policy if not exists partyhire_inventory_tenant_write on public.partyhire_inventory
  for all using (true) with check (true);
create policy if not exists partyhire_order_items_tenant_write on public.partyhire_order_items
  for all using (true) with check (true);
