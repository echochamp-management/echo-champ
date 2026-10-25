alter table public.daily_closures
  add column if not exists total_expenses numeric(12, 2) not null default 0 check (total_expenses >= 0),
  add column if not exists net_cash numeric(12, 2) not null default 0 check (net_cash >= 0);

create table if not exists public.customer_debts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  customer_name text not null,
  customer_firstname text,
  amount numeric(12, 2) not null check (amount >= 0),
  remaining_amount numeric(12, 2) not null check (remaining_amount >= 0),
  status text not null default 'ouvert' check (status in ('ouvert', 'partiellement_regle', 'regle')),
  payment_method text not null default 'credit' check (payment_method in ('credit')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists customer_debts_status_idx on public.customer_debts(status);
create index if not exists customer_debts_created_at_idx on public.customer_debts(created_at desc);

alter table public.customer_debts enable row level security;

create policy customer_debts_read on public.customer_debts
for select to anon, authenticated using (true);

create policy customer_debts_insert on public.customer_debts
for insert to authenticated with check (true);

create policy customer_debts_update on public.customer_debts
for update to authenticated using (true) with check (true);

grant select, insert, update on public.customer_debts to anon, authenticated;
