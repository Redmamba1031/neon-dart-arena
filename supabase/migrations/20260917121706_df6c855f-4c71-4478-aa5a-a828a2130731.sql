alter table public.profiles
  add column if not exists country text,
  add column if not exists region_code text,
  add column if not exists region_name text,
  add column if not exists city text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists location_source text,
  add column if not exists location_updated_at timestamptz;

create table if not exists public.restricted_regions (
  code text primary key,
  country text not null default 'US',
  name text not null,
  reason text not null default 'Real-money skill gaming is not permitted in this state.',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on public.restricted_regions to authenticated;
grant select on public.restricted_regions to anon;
grant all on public.restricted_regions to service_role;

alter table public.restricted_regions enable row level security;

drop policy if exists "Anyone can read restricted regions" on public.restricted_regions;
create policy "Anyone can read restricted regions"
  on public.restricted_regions for select
  to anon, authenticated
  using (true);

insert into public.restricted_regions (code, name) values
  ('AZ','Arizona'), ('AR','Arkansas'), ('CT','Connecticut'), ('DE','Delaware'),
  ('LA','Louisiana'), ('MT','Montana'), ('SD','South Dakota'), ('TN','Tennessee'),
  ('WA','Washington')
on conflict (code) do nothing;

create or replace function public.update_my_location(
  _country text,
  _region_code text,
  _region_name text,
  _city text,
  _lat double precision default null,
  _lng double precision default null,
  _source text default 'manual'
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if _region_code is null or length(trim(_region_code)) < 2 then
    raise exception 'A state or region is required';
  end if;
  update public.profiles set
    country = coalesce(nullif(trim(_country), ''), 'US'),
    region_code = upper(trim(_region_code)),
    region_name = nullif(trim(_region_name), ''),
    city = nullif(trim(_city), ''),
    lat = _lat,
    lng = _lng,
    location_source = case when _source in ('device','manual') then _source else 'manual' end,
    location_updated_at = now(),
    updated_at = now()
  where id = _uid;
end; $$;

revoke execute on function public.update_my_location(text,text,text,text,double precision,double precision,text) from public, anon;
grant execute on function public.update_my_location(text,text,text,text,double precision,double precision,text) to authenticated;

create or replace function public._assert_region_allowed(_user_id uuid)
returns void
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare _p public.profiles%rowtype; _r public.restricted_regions%rowtype;
begin
  select * into _p from public.profiles where id = _user_id;
  if _p.region_code is null then
    raise exception 'Set your location in your profile before playing for money';
  end if;
  if coalesce(_p.country, 'US') <> 'US' then return; end if;
  select * into _r from public.restricted_regions where code = _p.region_code and active;
  if found then
    raise exception 'Real-money play is not available in %', _r.name;
  end if;
end; $$;

revoke execute on function public._assert_region_allowed(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_match(_mode match_mode, _best_of integer, _stake_cents bigint, _double_in boolean DEFAULT false, _finish_rule finish_rule DEFAULT 'double'::finish_rule, _opponent_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid(); _match_id uuid;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  perform public._assert_not_banned(_uid);
  perform public._assert_region_allowed(_uid);
  if _best_of not in (1,3,5) then raise exception 'Invalid best_of'; end if;
  if _mode = 'Medley' and _best_of = 1 then raise exception 'Medley requires best of 3 or 5'; end if;
  if _stake_cents < 500 or _stake_cents > 100000000 then raise exception 'Stake must be at least 500 coins'; end if;
  if _opponent_id = _uid then raise exception 'You cannot challenge yourself'; end if;
  if _opponent_id is not null and not exists(select 1 from profiles where id = _opponent_id) then
    raise exception 'Player not found';
  end if;

  insert into matches (creator_id, mode, best_of, stake_cents, double_in, finish_rule, invited_id)
  values (_uid, _mode, _best_of, _stake_cents, _double_in, _finish_rule, _opponent_id)
  returning id into _match_id;

  perform _debit_wallet(_uid, _stake_cents, 'match_stake', _match_id, 'Created match');

  if _opponent_id is not null then
    insert into challenges (match_id, challenger_id, challenged_id) values (_match_id, _uid, _opponent_id);
  end if;

  return _match_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.join_match(_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid(); _m public.matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  perform public._assert_not_banned(_uid);
  perform public._assert_region_allowed(_uid);
  select * into _m from public.matches where id = _match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _m.status <> 'open' then raise exception 'Match not open'; end if;
  if _m.creator_id = _uid then raise exception 'Cannot join your own match'; end if;
  if _m.opponent_id is not null then raise exception 'Match already has an opponent'; end if;

  perform public._debit_wallet(_uid, _m.stake_cents, 'match_stake', _match_id, 'Joined match');

  update public.matches
    set opponent_id = _uid, status = 'live', started_at = now(),
        report_deadline = now() + interval '45 minutes'
    where id = _match_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.respond_challenge(_challenge_id uuid, _accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid(); _c public.challenges%rowtype; _m public.matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _c from challenges where id = _challenge_id for update;
  if not found then raise exception 'Challenge not found'; end if;
  if _c.challenged_id <> _uid then raise exception 'Not your challenge'; end if;
  if _c.status <> 'pending' then raise exception 'Challenge already answered'; end if;

  select * into _m from matches where id = _c.match_id for update;

  if _accept then
    perform public._assert_not_banned(_uid);
    perform public._assert_region_allowed(_uid);
    if _m.status <> 'open' then raise exception 'Match no longer open'; end if;
    perform _debit_wallet(_uid, _m.stake_cents, 'match_stake', _m.id, 'Accepted challenge');
    update matches set opponent_id = _uid, status = 'live', started_at = now(),
      report_deadline = now() + interval '45 minutes' where id = _m.id;
    update challenges set status = 'accepted', responded_at = now() where id = _challenge_id;
  else
    if _m.status = 'open' then
      perform _credit_wallet(_m.creator_id, _m.stake_cents, 'refund', _m.id, 'Challenge declined');
      update matches set status = 'cancelled', cancelled_at = now() where id = _m.id;
    end if;
    update challenges set status = 'declined', responded_at = now() where id = _challenge_id;
  end if;
end; $function$;