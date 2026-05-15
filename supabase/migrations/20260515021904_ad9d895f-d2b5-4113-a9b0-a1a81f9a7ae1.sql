
-- =========================================
-- Enums
-- =========================================
create type public.match_mode as enum ('501', 'Cricket', 'Medley');
create type public.finish_rule as enum ('straight', 'double', 'master', 'both');
create type public.match_status as enum ('open', 'live', 'completed', 'cancelled');
create type public.txn_kind as enum ('deposit', 'withdrawal', 'match_stake', 'match_payout', 'rake', 'refund');

-- =========================================
-- Wallets
-- =========================================
create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wallets enable row level security;

create policy "Users read their own wallet"
  on public.wallets for select
  to authenticated
  using (auth.uid() = user_id);

-- No insert/update/delete policies — only SECURITY DEFINER functions modify wallets.

-- =========================================
-- Wallet transactions (append-only ledger)
-- =========================================
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null,
  kind public.txn_kind not null,
  match_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index wallet_tx_user_idx on public.wallet_transactions (user_id, created_at desc);
create index wallet_tx_match_idx on public.wallet_transactions (match_id);

alter table public.wallet_transactions enable row level security;

create policy "Users read their own transactions"
  on public.wallet_transactions for select
  to authenticated
  using (auth.uid() = user_id);

-- =========================================
-- Matches
-- =========================================
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid references auth.users(id) on delete set null,
  mode public.match_mode not null,
  best_of int not null check (best_of in (1, 3, 5)),
  double_in boolean not null default false,
  finish_rule public.finish_rule not null default 'double',
  stake_cents bigint not null check (stake_cents > 0),
  status public.match_status not null default 'open',
  winner_id uuid references auth.users(id) on delete set null,
  rake_bps int not null default 500, -- 5%
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  constraint creator_not_opponent check (opponent_id is null or opponent_id <> creator_id),
  constraint winner_must_be_participant check (
    winner_id is null or winner_id = creator_id or winner_id = opponent_id
  )
);

create index matches_status_idx on public.matches (status, created_at desc);
create index matches_creator_idx on public.matches (creator_id);
create index matches_opponent_idx on public.matches (opponent_id);

alter table public.matches enable row level security;

create policy "Authenticated users can browse matches"
  on public.matches for select
  to authenticated
  using (true);

-- No insert/update from clients — go through SECURITY DEFINER functions.

-- =========================================
-- Match legs (per-leg results, mostly for medley)
-- =========================================
create table public.match_legs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  leg_number int not null,
  leg_mode public.match_mode not null,
  winner_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz not null default now(),
  unique (match_id, leg_number)
);

alter table public.match_legs enable row level security;

create policy "Authenticated users can view match legs"
  on public.match_legs for select
  to authenticated
  using (true);

-- =========================================
-- Helper: updated_at trigger
-- =========================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger wallets_touch_updated before update on public.wallets
  for each row execute function public.touch_updated_at();

-- =========================================
-- Auto-create wallet on signup
-- =========================================
create or replace function public.handle_new_user_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user_wallet() from public, anon, authenticated;

create trigger on_auth_user_created_wallet
  after insert on auth.users
  for each row execute function public.handle_new_user_wallet();

-- Backfill wallets for existing users (e.g. profile already exists)
insert into public.wallets (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- =========================================
-- Money mutators (all SECURITY DEFINER, locked down)
-- =========================================

-- Internal: debit a user's wallet atomically; throws if insufficient funds.
create or replace function public._debit_wallet(_user_id uuid, _amount_cents bigint, _kind public.txn_kind, _match_id uuid, _note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _new_balance bigint;
begin
  if _amount_cents <= 0 then
    raise exception 'Amount must be positive';
  end if;

  update public.wallets
    set balance_cents = balance_cents - _amount_cents
    where user_id = _user_id
    returning balance_cents into _new_balance;

  if _new_balance is null then
    raise exception 'Wallet not found';
  end if;
  if _new_balance < 0 then
    raise exception 'Insufficient funds';
  end if;

  insert into public.wallet_transactions (user_id, amount_cents, kind, match_id, note)
  values (_user_id, -_amount_cents, _kind, _match_id, _note);
end;
$$;

revoke execute on function public._debit_wallet(uuid, bigint, public.txn_kind, uuid, text) from public, anon, authenticated;

-- Internal: credit a user's wallet.
create or replace function public._credit_wallet(_user_id uuid, _amount_cents bigint, _kind public.txn_kind, _match_id uuid, _note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _amount_cents <= 0 then
    raise exception 'Amount must be positive';
  end if;

  update public.wallets
    set balance_cents = balance_cents + _amount_cents
    where user_id = _user_id;

  if not found then
    raise exception 'Wallet not found';
  end if;

  insert into public.wallet_transactions (user_id, amount_cents, kind, match_id, note)
  values (_user_id, _amount_cents, _kind, _match_id, _note);
end;
$$;

revoke execute on function public._credit_wallet(uuid, bigint, public.txn_kind, uuid, text) from public, anon, authenticated;

-- DEV ONLY: allow signed-in users to top up their own balance.
-- Replace with Stripe webhook in production.
create or replace function public.dev_top_up(_amount_cents bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _new_balance bigint;
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;
  if _amount_cents <= 0 or _amount_cents > 1000000 then
    raise exception 'Invalid amount';
  end if;

  perform public._credit_wallet(_uid, _amount_cents, 'deposit', null, 'Dev top-up');

  select balance_cents into _new_balance from public.wallets where user_id = _uid;
  return _new_balance;
end;
$$;

revoke execute on function public.dev_top_up(bigint) from public, anon;
grant execute on function public.dev_top_up(bigint) to authenticated;

-- Create a match: validates inputs, debits creator, returns the new match id.
create or replace function public.create_match(
  _mode public.match_mode,
  _best_of int,
  _stake_cents bigint,
  _double_in boolean default false,
  _finish_rule public.finish_rule default 'double'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _match_id uuid;
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;
  if _best_of not in (1, 3, 5) then
    raise exception 'Invalid best_of';
  end if;
  if _mode = 'Medley' and _best_of = 1 then
    raise exception 'Medley requires best of 3 or 5';
  end if;
  if _stake_cents < 100 or _stake_cents > 100000000 then
    raise exception 'Stake out of range';
  end if;

  insert into public.matches (creator_id, mode, best_of, stake_cents, double_in, finish_rule)
  values (_uid, _mode, _best_of, _stake_cents, _double_in, _finish_rule)
  returning id into _match_id;

  perform public._debit_wallet(_uid, _stake_cents, 'match_stake', _match_id, 'Created match');

  return _match_id;
end;
$$;

revoke execute on function public.create_match(public.match_mode, int, bigint, boolean, public.finish_rule) from public, anon;
grant execute on function public.create_match(public.match_mode, int, bigint, boolean, public.finish_rule) to authenticated;

-- Join an open match: validates state, debits opponent, marks live.
create or replace function public.join_match(_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _m public.matches%rowtype;
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into _m from public.matches where id = _match_id for update;
  if not found then
    raise exception 'Match not found';
  end if;
  if _m.status <> 'open' then
    raise exception 'Match not open';
  end if;
  if _m.creator_id = _uid then
    raise exception 'Cannot join your own match';
  end if;
  if _m.opponent_id is not null then
    raise exception 'Match already has an opponent';
  end if;

  perform public._debit_wallet(_uid, _m.stake_cents, 'match_stake', _match_id, 'Joined match');

  update public.matches
    set opponent_id = _uid,
        status = 'live',
        started_at = now()
    where id = _match_id;
end;
$$;

revoke execute on function public.join_match(uuid) from public, anon;
grant execute on function public.join_match(uuid) to authenticated;

-- Cancel an open match (creator only): refunds the stake.
create or replace function public.cancel_match(_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _m public.matches%rowtype;
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into _m from public.matches where id = _match_id for update;
  if not found then
    raise exception 'Match not found';
  end if;
  if _m.creator_id <> _uid then
    raise exception 'Only the creator can cancel';
  end if;
  if _m.status <> 'open' then
    raise exception 'Only open matches can be cancelled';
  end if;

  perform public._credit_wallet(_uid, _m.stake_cents, 'refund', _match_id, 'Cancelled match');

  update public.matches
    set status = 'cancelled', cancelled_at = now()
    where id = _match_id;
end;
$$;

revoke execute on function public.cancel_match(uuid) from public, anon;
grant execute on function public.cancel_match(uuid) to authenticated;

-- Settle a live match: marks winner, pays out (after rake).
-- MVP: callable by either participant. Replace with verified scoring later.
create or replace function public.settle_match(_match_id uuid, _winner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _m public.matches%rowtype;
  _pot bigint;
  _rake bigint;
  _payout bigint;
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into _m from public.matches where id = _match_id for update;
  if not found then
    raise exception 'Match not found';
  end if;
  if _m.status <> 'live' then
    raise exception 'Match is not live';
  end if;
  if _uid <> _m.creator_id and _uid <> _m.opponent_id then
    raise exception 'Only participants can settle';
  end if;
  if _winner_id <> _m.creator_id and _winner_id <> _m.opponent_id then
    raise exception 'Winner must be a participant';
  end if;

  _pot := _m.stake_cents * 2;
  _rake := (_pot * _m.rake_bps) / 10000;
  _payout := _pot - _rake;

  perform public._credit_wallet(_winner_id, _payout, 'match_payout', _match_id, 'Match payout');

  update public.matches
    set status = 'completed',
        winner_id = _winner_id,
        completed_at = now()
    where id = _match_id;
end;
$$;

revoke execute on function public.settle_match(uuid, uuid) from public, anon;
grant execute on function public.settle_match(uuid, uuid) to authenticated;

-- =========================================
-- Leaderboard view
-- =========================================
create or replace view public.leaderboard_view
with (security_invoker = true)
as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  coalesce(sum(case when m.winner_id = p.id then 1 else 0 end), 0)::int as wins,
  coalesce(sum(case when m.status = 'completed' and (m.creator_id = p.id or m.opponent_id = p.id) then 1 else 0 end), 0)::int as games_played,
  coalesce(sum(case when t.kind = 'match_payout' then t.amount_cents else 0 end), 0)::bigint as total_winnings_cents
from public.profiles p
left join public.matches m
  on (m.creator_id = p.id or m.opponent_id = p.id) and m.status = 'completed'
left join public.wallet_transactions t
  on t.user_id = p.id and t.kind = 'match_payout'
group by p.id, p.username, p.display_name, p.avatar_url;

grant select on public.leaderboard_view to authenticated;

-- =========================================
-- Re-secure handle_new_user (it was already EXECUTE-revoked, but make sure)
-- =========================================
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- =========================================
-- Realtime
-- =========================================
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.wallets;
