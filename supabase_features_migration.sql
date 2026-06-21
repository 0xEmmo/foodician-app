-- =============================================================
-- TREATS BY FOODICIAN — Feature Migration
-- Run this ONCE in your Supabase SQL Editor.
-- Adds all new tables for: delivery addresses, loyalty,
-- opening hours, promo codes, referrals, live chat, KDS, favorites.
-- =============================================================

-- ── 1. DELIVERY ADDRESSES ────────────────────────────────────────
create table if not exists public.delivery_addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  address_name text not null default 'Home',
  street       text not null,
  city         text not null default 'Lagos',
  state        text not null default 'Lagos',
  phone        text not null default '',
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.delivery_addresses enable row level security;

drop policy if exists "da_select_own" on public.delivery_addresses;
create policy "da_select_own"
  on public.delivery_addresses for select using (auth.uid() = user_id);

drop policy if exists "da_insert_own" on public.delivery_addresses;
create policy "da_insert_own"
  on public.delivery_addresses for insert with check (auth.uid() = user_id);

drop policy if exists "da_update_own" on public.delivery_addresses;
create policy "da_update_own"
  on public.delivery_addresses for update using (auth.uid() = user_id);

drop policy if exists "da_delete_own" on public.delivery_addresses;
create policy "da_delete_own"
  on public.delivery_addresses for delete using (auth.uid() = user_id);

-- ── 2. LOYALTY POINTS ────────────────────────────────────────────
create table if not exists public.loyalty_points (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique not null references auth.users(id) on delete cascade,
  points       integer not null default 0,
  tier         text not null default 'bronze',
  total_earned integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.loyalty_points enable row level security;

drop policy if exists "lp_select_own" on public.loyalty_points;
create policy "lp_select_own"
  on public.loyalty_points for select using (auth.uid() = user_id);

drop policy if exists "lp_admin_select" on public.loyalty_points;
create policy "lp_admin_select"
  on public.loyalty_points for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create table if not exists public.loyalty_transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  order_id         text,
  points_earned    integer,
  points_redeemed  integer,
  transaction_type text not null check (transaction_type in ('earned', 'redeemed')),
  created_at       timestamptz not null default now()
);

alter table public.loyalty_transactions enable row level security;

drop policy if exists "lt_select_own" on public.loyalty_transactions;
create policy "lt_select_own"
  on public.loyalty_transactions for select using (auth.uid() = user_id);

-- RPC: award_loyalty_points
create or replace function public.award_loyalty_points(
  p_user_id  uuid,
  p_order_id text,
  p_points   integer
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  new_total integer;
  new_tier  text;
begin
  insert into public.loyalty_points (user_id, points, total_earned)
  values (p_user_id, p_points, p_points)
  on conflict (user_id) do update
    set points       = loyalty_points.points + p_points,
        total_earned = loyalty_points.total_earned + p_points;

  select total_earned into new_total
    from public.loyalty_points where user_id = p_user_id;

  new_tier := case
    when new_total >= 50000 then 'platinum'
    when new_total >= 15000 then 'gold'
    when new_total >= 5000  then 'silver'
    else 'bronze'
  end;

  update public.loyalty_points set tier = new_tier where user_id = p_user_id;

  insert into public.loyalty_transactions (user_id, order_id, points_earned, transaction_type)
  values (p_user_id, p_order_id, p_points, 'earned');
end;
$$;

grant execute on function public.award_loyalty_points(uuid, text, integer) to authenticated;

-- RPC: redeem_loyalty_points (1000 pts → ₦10,000 wallet credit)
create or replace function public.redeem_loyalty_points(p_user_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_points       integer;
  credit_amount  numeric := 10000;
  new_points     integer;
begin
  select points into v_points
    from public.loyalty_points where user_id = p_user_id;

  if v_points is null or v_points < 1000 then
    return json_build_object('success', false, 'error', 'Need at least 1000 points to redeem');
  end if;

  new_points := v_points - 1000;

  update public.loyalty_points
     set points = new_points
   where user_id = p_user_id;

  -- Credit the Foodician wallet (profiles.wallet column)
  update public.profiles
     set wallet = coalesce(wallet, 0) + credit_amount
   where id = p_user_id;

  insert into public.loyalty_transactions (user_id, points_redeemed, transaction_type)
  values (p_user_id, 1000, 'redeemed');

  return json_build_object(
    'success', true,
    'credit_added', credit_amount,
    'new_points', new_points
  );
end;
$$;

grant execute on function public.redeem_loyalty_points(uuid) to authenticated;

-- ── 3. OPENING HOURS ─────────────────────────────────────────────
create table if not exists public.shop_hours (
  id          uuid primary key default gen_random_uuid(),
  day_of_week integer not null unique check (day_of_week between 0 and 6),
  open_time   time not null default '10:00',
  close_time  time not null default '22:00',
  is_closed   boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.shop_hours enable row level security;

drop policy if exists "sh_select_public" on public.shop_hours;
create policy "sh_select_public"
  on public.shop_hours for select using (true);

drop policy if exists "sh_all_admin" on public.shop_hours;
create policy "sh_all_admin"
  on public.shop_hours for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Seed default hours (Mon–Fri 10am–10pm, Sat 11am–11pm, Sun closed)
insert into public.shop_hours (day_of_week, open_time, close_time, is_closed) values
  (0, '12:00', '21:00', false),  -- Sunday
  (1, '10:00', '22:00', false),  -- Monday
  (2, '10:00', '22:00', false),  -- Tuesday
  (3, '10:00', '22:00', false),  -- Wednesday
  (4, '10:00', '22:00', false),  -- Thursday
  (5, '10:00', '22:00', false),  -- Friday
  (6, '11:00', '23:00', false)   -- Saturday
on conflict (day_of_week) do nothing;

-- ── 4. FAVORITES ─────────────────────────────────────────────────
create table if not exists public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_id    text not null,
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

alter table public.favorites enable row level security;

drop policy if exists "fav_select_own" on public.favorites;
create policy "fav_select_own"
  on public.favorites for select using (auth.uid() = user_id);

drop policy if exists "fav_insert_own" on public.favorites;
create policy "fav_insert_own"
  on public.favorites for insert with check (auth.uid() = user_id);

drop policy if exists "fav_delete_own" on public.favorites;
create policy "fav_delete_own"
  on public.favorites for delete using (auth.uid() = user_id);

-- ── 5. PROMO CODES ───────────────────────────────────────────────
create table if not exists public.promo_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,
  discount_type    text not null check (discount_type in ('percentage', 'fixed')),
  discount_value   numeric(10,2) not null,
  max_uses         integer,
  current_uses     integer not null default 0,
  min_order_amount numeric(10,2),
  expiry_date      date,
  is_active        boolean not null default true,
  description      text,
  created_at       timestamptz not null default now()
);

alter table public.promo_codes enable row level security;

drop policy if exists "pc_select_active" on public.promo_codes;
create policy "pc_select_active"
  on public.promo_codes for select using (is_active = true);

drop policy if exists "pc_all_admin" on public.promo_codes;
create policy "pc_all_admin"
  on public.promo_codes for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create table if not exists public.promo_usage (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  promo_code_id    uuid not null references public.promo_codes(id) on delete cascade,
  order_id         text,
  discount_applied numeric(10,2) not null,
  used_at          timestamptz not null default now(),
  unique (user_id, promo_code_id)
);

alter table public.promo_usage enable row level security;

drop policy if exists "pu_select_own" on public.promo_usage;
create policy "pu_select_own"
  on public.promo_usage for select using (auth.uid() = user_id);

drop policy if exists "pu_insert_own" on public.promo_usage;
create policy "pu_insert_own"
  on public.promo_usage for insert with check (auth.uid() = user_id);

drop policy if exists "pu_admin" on public.promo_usage;
create policy "pu_admin"
  on public.promo_usage for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- RPC: increment_promo_uses
create or replace function public.increment_promo_uses(p_promo_id uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.promo_codes
     set current_uses = current_uses + 1
   where id = p_promo_id;
$$;

grant execute on function public.increment_promo_uses(uuid) to authenticated;

-- ── 6. REFERRALS ─────────────────────────────────────────────────
alter table public.profiles add column if not exists referral_code text unique;

create table if not exists public.referrals (
  id               uuid primary key default gen_random_uuid(),
  referrer_id      uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  referral_code    text,
  status           text not null default 'pending' check (status in ('pending', 'completed')),
  reward_amount    numeric(10,2) not null default 2000,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.referrals enable row level security;

drop policy if exists "ref_select_own" on public.referrals;
create policy "ref_select_own"
  on public.referrals for select using (auth.uid() = referrer_id);

drop policy if exists "ref_admin" on public.referrals;
create policy "ref_admin"
  on public.referrals for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- RPC: use_referral_code (called when a new user signs up with a ref code)
create or replace function public.use_referral_code(
  p_code              text,
  p_referred_user_id  uuid
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_referrer_id uuid;
  reward        numeric := 2000;
begin
  select id into v_referrer_id
    from public.profiles
   where referral_code = p_code
   limit 1;

  if v_referrer_id is null then
    return json_build_object('success', false, 'error', 'Invalid referral code');
  end if;

  if v_referrer_id = p_referred_user_id then
    return json_build_object('success', false, 'error', 'Cannot refer yourself');
  end if;

  -- Check not already referred
  if exists (select 1 from public.referrals where referred_user_id = p_referred_user_id) then
    return json_build_object('success', false, 'error', 'Already referred');
  end if;

  insert into public.referrals (referrer_id, referred_user_id, referral_code, status, reward_amount, completed_at)
  values (v_referrer_id, p_referred_user_id, p_code, 'completed', reward, now());

  -- Credit referrer's wallet
  update public.profiles
     set wallet = coalesce(wallet, 0) + reward
   where id = v_referrer_id;

  return json_build_object('success', true);
end;
$$;

grant execute on function public.use_referral_code(text, uuid) to authenticated, anon;

-- ── 7. LIVE CHAT ─────────────────────────────────────────────────
create table if not exists public.chat_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  order_id         text,
  status           text not null default 'open' check (status in ('open', 'resolved')),
  last_message_at  timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.chat_sessions enable row level security;

drop policy if exists "cs_select_own" on public.chat_sessions;
create policy "cs_select_own"
  on public.chat_sessions for select using (auth.uid() = user_id);

drop policy if exists "cs_insert_own" on public.chat_sessions;
create policy "cs_insert_own"
  on public.chat_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "cs_update_own" on public.chat_sessions;
create policy "cs_update_own"
  on public.chat_sessions for update using (auth.uid() = user_id);

drop policy if exists "cs_admin" on public.chat_sessions;
create policy "cs_admin"
  on public.chat_sessions for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.chat_sessions(id) on delete cascade,
  order_id      text,
  user_id       uuid references auth.users(id) on delete set null,
  admin_id      uuid references auth.users(id) on delete set null,
  message_text  text not null,
  message_type  text not null check (message_type in ('user', 'admin', 'system')),
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

drop policy if exists "cm_select_own" on public.chat_messages;
create policy "cm_select_own"
  on public.chat_messages for select using (
    exists (
      select 1 from public.chat_sessions
      where id = session_id and user_id = auth.uid()
    )
  );

drop policy if exists "cm_insert_own" on public.chat_messages;
create policy "cm_insert_own"
  on public.chat_messages for insert with check (
    exists (
      select 1 from public.chat_sessions
      where id = session_id and user_id = auth.uid()
    ) or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "cm_update_own" on public.chat_messages;
create policy "cm_update_own"
  on public.chat_messages for update using (
    exists (
      select 1 from public.chat_sessions
      where id = session_id and user_id = auth.uid()
    ) or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "cm_admin" on public.chat_messages;
create policy "cm_admin"
  on public.chat_messages for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Enable realtime for chat
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chat_sessions'
  ) then
    alter publication supabase_realtime add table public.chat_sessions;
  end if;
end $$;

-- ── 8. KITCHEN DISPLAY SYSTEM ────────────────────────────────────
-- Foodician's orders table already exists with numeric IDs.
-- This RPC lets kitchen staff read active orders without admin RLS.
create or replace function public.fetch_kitchen_orders()
returns setof public.orders
language sql security definer set search_path = public
as $$
  select * from public.orders
   where status in ('Confirmed', 'Ready')
   order by created_at asc;
$$;

grant execute on function public.fetch_kitchen_orders() to authenticated;

-- RPC: kitchen_update_status (kitchen staff can advance status)
create or replace function public.kitchen_update_status(
  p_order_id  integer,
  p_status    text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_status not in ('Confirmed', 'Ready', 'Completed', 'Cancelled') then
    raise exception 'Invalid status: %', p_status;
  end if;
  update public.orders set status = p_status where id = p_order_id;
end;
$$;

grant execute on function public.kitchen_update_status(integer, text) to authenticated;

-- ── 9. ADD role COLUMN TO profiles IF MISSING ────────────────────
alter table public.profiles add column if not exists role text not null default 'user';

-- ── 10. shop_hours REALTIME ──────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'shop_hours'
  ) then
    alter publication supabase_realtime add table public.shop_hours;
  end if;
end $$;
