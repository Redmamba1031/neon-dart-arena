-- Entry fee model: each player's entry = prize contribution + disclosed service fee.
-- Winner receives 100% of the prize pot; no cut is taken from the pot at settlement.

CREATE OR REPLACE FUNCTION public.match_fee_cents(_entry_cents bigint, _rake_bps integer)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$ select (_entry_cents * _rake_bps) / 10000 $$;

GRANT EXECUTE ON FUNCTION public.match_fee_cents(bigint, integer) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public._charge_entry(_user_id uuid, _match_id uuid, _entry_cents bigint, _rake_bps integer, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare _fee bigint := public.match_fee_cents(_entry_cents, _rake_bps);
begin
  perform public._debit_wallet(_user_id, _entry_cents - _fee, 'match_stake', _match_id, _note || ' (prize pot)');
  if _fee > 0 then
    perform public._debit_wallet(_user_id, _fee, 'rake', _match_id, _note || ' (service fee)');
  end if;
end; $$;

REVOKE EXECUTE ON FUNCTION public._charge_entry(uuid, uuid, bigint, integer, text) FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.create_match(_mode match_mode, _best_of integer, _stake_cents bigint, _double_in boolean DEFAULT false, _finish_rule finish_rule DEFAULT 'double'::finish_rule, _opponent_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare _uid uuid := auth.uid(); _match_id uuid;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  perform public._assert_not_banned(_uid);
  perform public._assert_region_allowed(_uid);
  if _best_of not in (1,3,5) then raise exception 'Invalid best_of'; end if;
  if _mode = 'Medley' and _best_of = 1 then raise exception 'Medley requires best of 3 or 5'; end if;
  if _stake_cents < 500 or _stake_cents > 100000000 then raise exception 'Entry must be at least $5.00'; end if;
  if _opponent_id = _uid then raise exception 'You cannot challenge yourself'; end if;
  if _opponent_id is not null and not exists(select 1 from profiles where id = _opponent_id) then
    raise exception 'Player not found';
  end if;

  insert into matches (creator_id, mode, best_of, stake_cents, double_in, finish_rule, invited_id)
  values (_uid, _mode, _best_of, _stake_cents, _double_in, _finish_rule, _opponent_id)
  returning id into _match_id;

  perform public._charge_entry(_uid, _match_id, _stake_cents, (select rake_bps from matches where id = _match_id), 'Created match');

  if _opponent_id is not null then
    insert into challenges (match_id, challenger_id, challenged_id) values (_match_id, _uid, _opponent_id);
  end if;

  return _match_id;
end; $$;

CREATE OR REPLACE FUNCTION public.join_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  perform public._charge_entry(_uid, _match_id, _m.stake_cents, _m.rake_bps, 'Joined match');

  update public.matches
    set opponent_id = _uid, status = 'live', started_at = now(),
        report_deadline = now() + interval '45 minutes'
    where id = _match_id;
end; $$;

CREATE OR REPLACE FUNCTION public.respond_challenge(_challenge_id uuid, _accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    perform public._charge_entry(_uid, _m.id, _m.stake_cents, _m.rake_bps, 'Accepted challenge');
    update matches set opponent_id = _uid, status = 'live', started_at = now(),
      report_deadline = now() + interval '45 minutes' where id = _m.id;
    update challenges set status = 'accepted', responded_at = now() where id = _challenge_id;
  else
    if _m.status = 'open' then
      perform _credit_wallet(_m.creator_id, _m.stake_cents, 'refund', _m.id, 'Challenge declined - entry refunded');
      update matches set status = 'cancelled', cancelled_at = now() where id = _m.id;
    end if;
    update challenges set status = 'declined', responded_at = now() where id = _challenge_id;
  end if;
end; $$;

CREATE OR REPLACE FUNCTION public.cancel_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  _uid uuid := auth.uid();
  _m public.matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _m from public.matches where id = _match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _m.creator_id <> _uid then raise exception 'Only the creator can cancel'; end if;
  if _m.status <> 'open' then raise exception 'Only open matches can be cancelled'; end if;

  -- full entry refunded, including the service fee
  perform public._credit_wallet(_uid, _m.stake_cents, 'refund', _match_id, 'Cancelled match - entry refunded');

  update public.matches
    set status = 'cancelled', cancelled_at = now()
    where id = _match_id;
end; $$;

CREATE OR REPLACE FUNCTION public._settle_match(_match_id uuid, _winner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  _m public.matches%rowtype;
  _fee bigint; _pot bigint; _loser uuid;
  _wl integer; _ll integer;
begin
  select * into _m from matches where id = _match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _m.status <> 'live' then raise exception 'Match is not live'; end if;
  if _winner_id <> _m.creator_id and _winner_id <> _m.opponent_id then raise exception 'Winner must be a participant'; end if;
  if exists (select 1 from match_results where match_id = _match_id) then return; end if;

  _loser := case when _winner_id = _m.creator_id then _m.opponent_id else _m.creator_id end;
  _fee := public.match_fee_cents(_m.stake_cents, _m.rake_bps);
  -- service fees were already collected at entry; the winner takes 100% of the prize pot
  _pot := (_m.stake_cents - _fee) * 2;

  perform _credit_wallet(_winner_id, _pot, 'match_payout', _match_id, 'Prize pot');

  if _winner_id = _m.creator_id then _wl := _m.creator_legs; _ll := _m.opponent_legs;
  else _wl := _m.opponent_legs; _ll := _m.creator_legs; end if;

  insert into match_results (match_id, winner_id, loser_id, winner_legs, loser_legs, payout_cents, rake_cents)
  values (_match_id, _winner_id, _loser, _wl, _ll, _pot, _fee * 2);

  update matches set status = 'completed', winner_id = _winner_id, completed_at = now() where id = _match_id;

  perform set_config('app.allow_stats', 'on', true);
  update profiles set wins = wins + 1, rating = rating + 25 where id = _winner_id;
  if _loser is not null then
    update profiles set losses = losses + 1, rating = greatest(0, rating - 15) where id = _loser;
  end if;
  perform set_config('app.allow_stats', 'off', true);
end; $$;