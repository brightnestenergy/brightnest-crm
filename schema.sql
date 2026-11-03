-- Brightnest Energy CRM - Full Schema
-- Run this in the Supabase SQL Editor

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  source_id text unique,
  name text not null,
  phone text,
  email text,
  address text,
  suburb text,
  postcode text,
  state text default 'VIC',
  bill text,
  timeline text,
  notes text,
  status text default 'new',
  system_kw text,
  battery_kwh text,
  greensketch_url text,
  signed_in_greensketch boolean default false,
  signed_date date,
  needs_follow_up boolean default true,
  next_follow_up date,
  too_far boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table leads enable row level security;

drop policy if exists "Authenticated users can do everything" on leads;
create policy "Authenticated users can do everything" on leads
  for all using (auth.role() = 'authenticated');

create index if not exists leads_source_id_idx on leads(source_id);
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_postcode_idx on leads(postcode);

-- Optional: inventory table (currently demo data is local; move here when ready)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  category text,
  stock integer default 0,
  cost numeric,
  price numeric,
  low_stock integer default 5,
  created_at timestamptz default now()
);

alter table products enable row level security;
create policy "Authenticated users can manage products" on products for all using (auth.role() = 'authenticated');