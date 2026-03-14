-- LaundroSwipe Supabase schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) if you are setting up a new project.

-- Users (customers + students; Supabase Auth users can be linked via id)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  whatsapp text,
  user_type text default 'general',  -- 'general' | 'student'
  college_id text,
  reg_no text,
  hostel_block text,
  year smallint,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  token text not null,
  service_id text not null,
  service_name text not null,
  pickup_date date not null,
  time_slot text not null,
  status text not null default 'scheduled',
  instructions text,
  user_id uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Status flow: scheduled → agent_assigned → picked_up → processing → ready → out_for_delivery → delivered

-- Optional: enable RLS and add policies so users only see their own data
-- alter table public.users enable row level security;
-- alter table public.orders enable row level security;
-- create policy "Users can read own row" on public.users for select using (auth.uid() = id);
-- create policy "Users can read own orders" on public.orders for select using (auth.uid() = user_id);

-- Indexes for common queries
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_token on public.orders(token);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_users_email on public.users(email);
