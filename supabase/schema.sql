-- ECHO-CHAMP - clean Supabase schema
-- WARNING: this resets the application tables and deletes their data.

create extension if not exists pgcrypto;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'menu_items'
  ) then
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'menu_items'
        and c.relkind in ('r', 'p')
    ) then
      drop table public.menu_items cascade;
    else
      drop view public.menu_items cascade;
    end if;
  end if;

  if to_regclass('public.menu_items_legacy') is not null then
    drop table public.menu_items_legacy cascade;
  end if;
end;
$$;

drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.daily_closures cascade;
drop table if exists public.products cascade;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in (
    'petit_dejeuner', 'plat_du_jour', 'plats', 'pizza', 'boissons'
  )),
  price numeric(12, 2) not null default 0 check (price >= 0),
  is_available boolean not null default true,
  image_url text,
  stock_initial integer not null default 0 check (stock_initial >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products(category);
create index products_available_idx on public.products(is_available);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_firstname text,
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  status text not null default 'en_attente_paiement' check (status in (
    'pending', 'en_attente_paiement', 'payee_validee', 'validee',
    'annulee', 'completed', 'paid'
  )),
  order_type text not null default 'sur_place'
    check (order_type in ('sur_place', 'emporter')),
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'carte', 'virement_bancaire', 'credit')),
  source text not null default 'interne'
    check (source in ('catalogue', 'interne')),
  customer_message text,
  estimated_ready_minutes integer
    check (estimated_ready_minutes is null or estimated_ready_minutes between 1 and 240),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_status_idx on public.orders(status);
create index orders_created_at_idx on public.orders(created_at desc);
create index orders_user_id_idx on public.orders(user_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items(order_id);
create index order_items_product_id_idx on public.order_items(product_id);

create table public.daily_closures (
  id uuid primary key default gen_random_uuid(),
  closure_date date not null default current_date,
  responsible_name text not null,
  total_sales numeric(12, 2) not null default 0 check (total_sales >= 0),
  sur_place_total numeric(12, 2) not null default 0 check (sur_place_total >= 0),
  emporter_total numeric(12, 2) not null default 0 check (emporter_total >= 0),
  total_expenses numeric(12, 2) not null default 0 check (total_expenses >= 0),
  net_cash numeric(12, 2) not null default 0 check (net_cash >= 0),
  total_orders integer not null default 0 check (total_orders >= 0),
  notes text,
  signature_url text,
  closed_at timestamptz not null default now()
);

create table public.customer_debts (
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

create index customer_debts_status_idx on public.customer_debts(status);
create index customer_debts_created_at_idx on public.customer_debts(created_at desc);

create index daily_closures_closed_at_idx
  on public.daily_closures(closed_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.daily_closures enable row level security;
alter table public.customer_debts enable row level security;

create policy products_read on public.products
for select to anon, authenticated using (true);

create policy products_update on public.products
for update to authenticated using (true) with check (true);

create policy products_insert on public.products
for insert to authenticated with check (true);

create policy products_delete on public.products
for delete to authenticated using (true);

create policy orders_read on public.orders
for select to anon, authenticated using (true);

create policy orders_insert on public.orders
for insert to anon, authenticated with check (true);

create policy orders_update on public.orders
for update to authenticated using (true) with check (true);

create policy orders_delete on public.orders
for delete to authenticated using (true);

create policy order_items_read on public.order_items
for select to anon, authenticated using (true);

create policy order_items_insert on public.order_items
for insert to anon, authenticated with check (true);

create policy daily_closures_read on public.daily_closures
for select to authenticated using (true);

create policy daily_closures_insert on public.daily_closures
for insert to authenticated with check (true);

create policy customer_debts_read on public.customer_debts
for select to anon, authenticated using (true);

create policy customer_debts_insert on public.customer_debts
for insert to authenticated with check (true);

create policy customer_debts_update on public.customer_debts
for update to authenticated using (true) with check (true);

-- Grants required by the Supabase Data API. RLS still controls every row.
grant usage on schema public to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select, insert, update, delete on public.orders to anon, authenticated;
grant select, insert on public.order_items to anon, authenticated;
grant select, insert on public.daily_closures to authenticated;
grant select, insert, update on public.customer_debts to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;

-- Initial catalogue. All products start available with zero stock.
insert into public.products (name, category, price, is_available, stock_initial) values
  ('Vivres alimentaires (Sauce viande)', 'petit_dejeuner', 750, true, 0),
  ('Vivres alimentaires (Sauce foie)', 'petit_dejeuner', 750, true, 0),
  ('Vivres alimentaires (Œuf)', 'petit_dejeuner', 800, true, 0),
  ('Sandwich Jambon', 'petit_dejeuner', 500, true, 0),
  ('Sandwich Poulet', 'petit_dejeuner', 500, true, 0),
  ('Sandwich Œuf', 'petit_dejeuner', 500, true, 0),
  ('Sandwich Bolognaise', 'petit_dejeuner', 500, true, 0),
  ('Omelette Jambon', 'petit_dejeuner', 500, true, 0),
  ('Omelette Poulet', 'petit_dejeuner', 650, true, 0),
  ('Omelette Hareng', 'petit_dejeuner', 650, true, 0),
  ('Spaghetti Jambon', 'petit_dejeuner', 750, true, 0),
  ('Spaghetti Poulet', 'petit_dejeuner', 800, true, 0),
  ('Spaghetti Hareng', 'petit_dejeuner', 1000, true, 0),
  ('Paté kòde Poulet', 'petit_dejeuner', 250, true, 0),
  ('Paté kòde Bœuf', 'petit_dejeuner', 250, true, 0),
  ('Paté kòde Morue', 'petit_dejeuner', 250, true, 0),
  ('Paté kòde Hareng', 'petit_dejeuner', 250, true, 0),
  ('Hamburger (Normal / Spécial)', 'petit_dejeuner', 1000, true, 0),

  ('Riz collé, sauce, légumes (Mardi/Jeudi/Samedi)', 'plat_du_jour', 1000, true, 0),
  ('Riz sauce pois, sauce, légumes (Lundi/Mercredi/Vendredi)', 'plat_du_jour', 1000, true, 0),
  ('Tonmtonm (Jeudi)', 'plat_du_jour', 750, true, 0),
  ('Bouillon cabri (Samedi)', 'plat_du_jour', 750, true, 0),
  ('Soupe giraumont (Dimanche)', 'plat_du_jour', 750, true, 0),
  ('Maïs (Lundi)', 'plat_du_jour', 1000, true, 0),
  ('Blé collé (Mardi)', 'plat_du_jour', 1000, true, 0),
  ('Pitimi sauce pois (Mercredi)', 'plat_du_jour', 1000, true, 0),

  ('Bœuf (en sauce / frit)', 'plats', 1500, true, 0),
  ('Cabri (en sauce / frit)', 'plats', 1800, true, 0),
  ('Porc (en sauce / frit)', 'plats', 1500, true, 0),
  ('Poulet (en sauce / frit)', 'plats', 1400, true, 0),
  ('Poulet indigène (en sauce)', 'plats', 1800, true, 0),
  ('Chicken wings', 'plats', 1250, true, 0),
  ('Chicken wings (four)', 'plats', 1350, true, 0),
  ('Taco lakay (small)', 'plats', 750, true, 0),
  ('Taco lakay (large)', 'plats', 1000, true, 0),
  ('Écrevisse (en sauce / grillé)', 'plats', 2500, true, 0),
  ('Homard (en sauce / grillé)', 'plats', 2500, true, 0),
  ('Lambi (en sauce / grillé)', 'plats', 1750, true, 0),
  ('Poisson (en sauce / frit / grillé)', 'plats', 1750, true, 0),
  ('Bouillie de blé / d''avoine / de farine (Menu soir)', 'plats', 600, true, 0),

  ('Pepperoni (Small)', 'pizza', 2500, true, 0),
  ('Pepperoni (Medium)', 'pizza', 3650, true, 0),
  ('Pepperoni (Large)', 'pizza', 5500, true, 0),
  ('Pepperoni (Extra large)', 'pizza', 6600, true, 0),
  ('Jambon (Small)', 'pizza', 2500, true, 0),
  ('Jambon (Medium)', 'pizza', 3650, true, 0),
  ('Jambon (Large)', 'pizza', 5500, true, 0),
  ('Jambon (Extra large)', 'pizza', 6600, true, 0),
  ('Bolognaise (Small)', 'pizza', 3000, true, 0),
  ('Bolognaise (Medium)', 'pizza', 4000, true, 0),
  ('Bolognaise (Large)', 'pizza', 5800, true, 0),
  ('Bolognaise (Extra large)', 'pizza', 6900, true, 0),
  ('Poulet (Small)', 'pizza', 3000, true, 0),
  ('Poulet (Medium)', 'pizza', 4000, true, 0),
  ('Poulet (Large)', 'pizza', 5800, true, 0),
  ('Poulet (Extra large)', 'pizza', 6900, true, 0),
  ('Végétarienne (Small)', 'pizza', 3300, true, 0),
  ('Végétarienne (Medium)', 'pizza', 4750, true, 0),
  ('Végétarienne (Large)', 'pizza', 6900, true, 0),
  ('Fruit de mer (Small)', 'pizza', 3500, true, 0),
  ('Fruit de mer (Medium)', 'pizza', 4850, true, 0),
  ('Fruit de mer (Large)', 'pizza', 7000, true, 0),

  ('Café', 'boissons', 250, true, 0),
  ('Café au lait', 'boissons', 300, true, 0),
  ('Chocolat', 'boissons', 300, true, 0),
  ('Lait', 'boissons', 300, true, 0),
  ('Jus Grenadia', 'boissons', 500, true, 0),
  ('Jus Cerise', 'boissons', 500, true, 0),
  ('Jus Papaye / Corosol / Cachiman', 'boissons', 400, true, 0),
  ('Jus Citron', 'boissons', 500, true, 0),
  ('Jumex / Jus Tica / Jus Petit', 'boissons', 200, true, 0),
  ('Eau', 'boissons', 100, true, 0),
  ('Malta', 'boissons', 150, true, 0),
  ('Prestige', 'boissons', 250, true, 0),
  ('Guinness', 'boissons', 400, true, 0),
  ('Limbo ice', 'boissons', 400, true, 0),
  ('Cereser', 'boissons', 1250, true, 0);
