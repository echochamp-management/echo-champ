alter table public.orders
  add column if not exists payment_method text not null default 'cash'
  check (payment_method in ('cash', 'carte', 'virement_bancaire', 'credit'));

create table if not exists public.cash_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  responsible_name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  motive text not null,
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists cash_expenses_occurred_at_idx
  on public.cash_expenses(occurred_at desc);

alter table public.cash_expenses enable row level security;

create policy cash_expenses_read on public.cash_expenses
for select to anon, authenticated using (true);

create policy cash_expenses_insert on public.cash_expenses
for insert to authenticated with check (true);

grant select, insert on public.cash_expenses to anon, authenticated;
