-- Roadster concept demo — Supabase schema.
--
-- 1. Run this in the Supabase SQL editor.
-- 2. Put SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (or your host's env).
-- 3. Restart the app: storage switches from .data/db.json to Supabase automatically.
--
-- Each table stores the full record as jsonb (`data`) plus indexed id and
-- created_at, matching src/lib/server/repo.ts. The app writes with the
-- service role from server code only; RLS blocks anonymous access entirely.

create table if not exists public.orders (
  id          text primary key,
  created_at  timestamptz not null default now(),
  data        jsonb not null
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx  on public.orders ((data->>'status'));
create index if not exists orders_number_idx  on public.orders ((data->>'number'));

create table if not exists public.investor_leads (
  id          text primary key,
  created_at  timestamptz not null default now(),
  data        jsonb not null
);
create index if not exists investor_leads_created_idx on public.investor_leads (created_at desc);

-- Watch-only receiving addresses (no private keys are ever stored)
create table if not exists public.wallets (
  id          text primary key,
  created_at  timestamptz not null default now(),
  data        jsonb not null   -- {network, address, label, active}
);

create table if not exists public.bank_accounts (
  id          text primary key,
  created_at  timestamptz not null default now(),
  data        jsonb not null   -- {bankName, accountName, accountNumber, currency, active}
);

-- Single row, id = 'global': {btcUsd, ethUsd, ngnPerUsd, updatedAt}
create table if not exists public.settings (
  id          text primary key,
  created_at  timestamptz not null default now(),
  data        jsonb not null
);

alter table public.orders         enable row level security;
alter table public.investor_leads enable row level security;
alter table public.wallets        enable row level security;
alter table public.bank_accounts  enable row level security;
alter table public.settings       enable row level security;
-- No policies on purpose: only the service role (server-side) can read/write.
-- When you move admin login to Supabase Auth, add read policies for admins, e.g.
--   create policy "admins read orders" on public.orders for select
--     using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
