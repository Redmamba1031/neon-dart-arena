-- 1) columns
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS report_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS reported_winner_id uuid,
  ADD COLUMN IF NOT EXISTS reported_by uuid,
  ADD COLUMN IF NOT EXISTS reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS disputed boolean NOT NULL DEFAULT false;

ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS report_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS reported_winner_id uuid,
  ADD COLUMN IF NOT EXISTS reported_by uuid,
  ADD COLUMN IF NOT EXISTS reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS disputed boolean NOT NULL DEFAULT false;

-- 2) internal settle (no auth check)
CREATE OR REPLACE FUNCTION public._settle_match(_match_id uuid, _winner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  _m public.matches%rowtype;
  _pot bigint; _rake bigint; _payout bigint; _loser uuid;
  _wl integer; _ll integer;
begin
  select * into _m from matches where id = _match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _m.status <> 'live' then raise exception 'Match is not live'; end if;
  if _winner_id <> _m.creator_id and _winner_id <> _m.opponent_id then raise exception 'Winner must be a participant'; end if;
  if exists (select 1 from match_results where match_id = _match_id) then return; end if;

  _loser := case when _winner_id = _m.creator_id then _m.opponent_id else _m.creator_id end;
  _pot := _m.stake_cents * 2;
  _rake := (_pot * _m.rake_bps) / 10000;
  _payout := _pot - _rake;

  perform _credit_wallet(_winner_id, _payout, 'match_payout', _match_id, 'Match payout');

  if _winner_id = _m.creator_id then _wl := _m.creator_legs; _ll := _m.opponent_legs;
  else _wl := _m.opponent_legs; _ll := _m.creator_legs; end if;

  insert into match_results (match_id, winner_id, loser_id, winner_legs, loser_legs, payout_cents, rake_cents)
  values (_match_id, _winner_id, _loser, _wl, _ll, _payout, _rake);

  update matches set status = 'completed', winner_id = _winner_id, completed_at = now() where id = _match_id;

  perform set_config('app.allow_stats', 'on', true);
  update profiles set wins = wins + 1, rating = rating + 25 where id = _winner_id;
  if _loser is not null then
    update profiles set losses = losses + 1, rating = greatest(0, rating - 15) where id = _loser;
  end if;
  perform set_config('app.allow_stats', 'off', true);
end; $function$;
REVOKE ALL ON FUNCTION public._settle_match(uuid, uuid) FROM public, anon, authenticated;

-- 3) report / confirm a 1v1 winner
CREATE OR REPLACE FUNCTION public.report_match_winner(_match_id uuid, _winner_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare _uid uuid := auth.uid(); _m public.matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _m from matches where id = _match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _m.status <> 'live' then raise exception 'Match is not live'; end if;
  if _uid <> _m.creator_id and _uid <> coalesce(_m.opponent_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    raise exception 'Only participants can report';
  end if;
  if _winner_id <> _m.creator_id and _winner_id <> _m.opponent_id then raise exception 'Winner must be a participant'; end if;
  if _m.disputed then raise exception 'Match is disputed — contact support'; end if;

  if _m.reported_by is null then
    update matches set reported_winner_id = _winner_id, reported_by = _uid, reported_at = now(),
      report_deadline = coalesce(report_deadline, now() + interval '45 minutes')
      where id = _match_id;
    return 'reported';
  end if;

  if _m.reported_by = _uid then
    if _m.reported_winner_id = _winner_id then return 'reported'; end if;
    update matches set reported_winner_id = _winner_id, reported_at = now() where id = _match_id;
    return 'reported';
  end if;

  -- the other participant is responding
  if _m.reported_winner_id = _winner_id then
    perform _settle_match(_match_id, _winner_id);
    return 'settled';
  end if;

  if now() > coalesce(_m.report_deadline, now()) then
    perform _settle_match(_match_id, _m.reported_winner_id);
    return 'settled';
  end if;

  update matches set disputed = true where id = _match_id;
  return 'disputed';
end; $function$;
REVOKE ALL ON FUNCTION public.report_match_winner(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.report_match_winner(uuid, uuid) TO authenticated;

-- 4) finalize an unanswered 1v1 report after the window
CREATE OR REPLACE FUNCTION public.finalize_match_report(_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare _uid uuid := auth.uid(); _m public.matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _m from matches where id = _match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _uid <> _m.creator_id and _uid <> coalesce(_m.opponent_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    raise exception 'Only participants can finalize';
  end if;
  if _m.status <> 'live' then raise exception 'Match is not live'; end if;
  if _m.disputed then raise exception 'Match is disputed — contact support'; end if;
  if _m.reported_winner_id is null then raise exception 'No result has been reported yet'; end if;
  if _m.report_deadline is null or now() <= _m.report_deadline then
    raise exception 'The 45 minute confirmation window has not passed yet';
  end if;
  perform _settle_match(_match_id, _m.reported_winner_id);
end; $function$;
REVOKE ALL ON FUNCTION public.finalize_match_report(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finalize_match_report(uuid) TO authenticated;

-- 5) start the 45 minute clock when a 1v1 goes live
CREATE OR REPLACE FUNCTION public.join_match(_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare _uid uuid := auth.uid(); _m public.matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
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
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare _uid uuid := auth.uid(); _c public.challenges%rowtype; _m public.matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _c from challenges where id = _challenge_id for update;
  if not found then raise exception 'Challenge not found'; end if;
  if _c.challenged_id <> _uid then raise exception 'Not your challenge'; end if;
  if _c.status <> 'pending' then raise exception 'Challenge already answered'; end if;

  select * into _m from matches where id = _c.match_id for update;

  if _accept then
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

-- 6) tournament bracket: start the clock when both players are known
CREATE OR REPLACE FUNCTION public.set_tournament_match_deadline()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
begin
  if new.player1_id is not null and new.player2_id is not null
     and new.completed_at is null and new.report_deadline is null then
    new.report_deadline := now() + interval '45 minutes';
  end if;
  return new;
end; $function$;

DROP TRIGGER IF EXISTS trg_tournament_match_deadline ON public.tournament_matches;
CREATE TRIGGER trg_tournament_match_deadline
  BEFORE INSERT OR UPDATE ON public.tournament_matches
  FOR EACH ROW EXECUTE FUNCTION public.set_tournament_match_deadline();

-- 7) internal tournament advance (no auth check) + report/confirm wrapper
CREATE OR REPLACE FUNCTION public._advance_tournament_match(_match_id uuid, _winner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  _m public.tournament_matches%rowtype;
  _t public.tournaments%rowtype;
  _loser uuid; _pot bigint; _net bigint;
  _first uuid; _second uuid; _third uuid; _amt bigint;
begin
  select * into _m from tournament_matches where id=_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _m.completed_at is not null then return; end if;
  select * into _t from tournaments where id=_m.tournament_id for update;
  if _t.status <> 'live' then raise exception 'Tournament not live'; end if;

  _loser := case when _winner_id=_m.player1_id then _m.player2_id else _m.player1_id end;

  update tournament_matches set winner_id=_winner_id, loser_id=_loser, completed_at=now() where id=_match_id;

  if _m.next_winner_match_id is not null then
    if _m.next_winner_slot = 1 then
      update tournament_matches set player1_id=_winner_id where id=_m.next_winner_match_id;
    else
      update tournament_matches set player2_id=_winner_id where id=_m.next_winner_match_id;
    end if;
  end if;

  if _m.next_loser_match_id is not null then
    if _m.next_loser_slot = 1 then
      update tournament_matches set player1_id=_loser where id=_m.next_loser_match_id;
    else
      update tournament_matches set player2_id=_loser where id=_m.next_loser_match_id;
    end if;
  end if;

  if _m.is_final then
    _first := _winner_id;
    _second := _loser;
    select loser_id into _third from tournament_matches
      where tournament_id=_m.tournament_id and side='losers' and next_winner_match_id=_m.id limit 1;

    update tournament_participants set placement=1 where tournament_id=_m.tournament_id and user_id=_first;
    update tournament_participants set placement=2 where tournament_id=_m.tournament_id and user_id=_second;
    if _third is not null then
      update tournament_participants set placement=3 where tournament_id=_m.tournament_id and user_id=_third;
    end if;

    _pot := _t.entry_cents * _t.size;
    _net := _pot - (_pot * _t.rake_bps / 10000);

    _amt := (_net * 50) / 100;
    if _amt > 0 then perform _credit_wallet(_first, _amt, 'match_payout', null, 'Tournament 1st: '||_t.name); end if;
    _amt := (_net * 30) / 100;
    if _amt > 0 then perform _credit_wallet(_second, _amt, 'match_payout', null, 'Tournament 2nd: '||_t.name); end if;
    if _third is not null then
      _amt := (_net * 20) / 100;
      if _amt > 0 then perform _credit_wallet(_third, _amt, 'match_payout', null, 'Tournament 3rd: '||_t.name); end if;
    end if;

    update tournaments set status='completed', completed_at=now(),
      winner_id=_first, runner_up_id=_second, third_id=_third where id=_t.id;
  end if;
end; $function$;
REVOKE ALL ON FUNCTION public._advance_tournament_match(uuid, uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.report_tournament_winner(_match_id uuid, _winner_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare _uid uuid := auth.uid(); _m public.tournament_matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _m from tournament_matches where id=_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _m.completed_at is not null then raise exception 'Match already completed'; end if;
  if _m.player1_id is null or _m.player2_id is null then raise exception 'Match not ready'; end if;
  if _uid <> _m.player1_id and _uid <> _m.player2_id then raise exception 'Only participants can report'; end if;
  if _winner_id <> _m.player1_id and _winner_id <> _m.player2_id then raise exception 'Invalid winner'; end if;
  if _m.disputed then raise exception 'Match is disputed — contact support'; end if;

  if _m.reported_by is null then
    update tournament_matches set reported_winner_id=_winner_id, reported_by=_uid, reported_at=now(),
      report_deadline = coalesce(report_deadline, now() + interval '45 minutes') where id=_match_id;
    return 'reported';
  end if;

  if _m.reported_by = _uid then
    update tournament_matches set reported_winner_id=_winner_id, reported_at=now() where id=_match_id;
    return 'reported';
  end if;

  if _m.reported_winner_id = _winner_id then
    perform _advance_tournament_match(_match_id, _winner_id);
    return 'settled';
  end if;

  if now() > coalesce(_m.report_deadline, now()) then
    perform _advance_tournament_match(_match_id, _m.reported_winner_id);
    return 'settled';
  end if;

  update tournament_matches set disputed=true where id=_match_id;
  return 'disputed';
end; $function$;
REVOKE ALL ON FUNCTION public.report_tournament_winner(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.report_tournament_winner(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_tournament_match_report(_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare _uid uuid := auth.uid(); _m public.tournament_matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _m from tournament_matches where id=_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _uid <> _m.player1_id and _uid <> _m.player2_id then raise exception 'Only participants can finalize'; end if;
  if _m.completed_at is not null then raise exception 'Match already completed'; end if;
  if _m.disputed then raise exception 'Match is disputed — contact support'; end if;
  if _m.reported_winner_id is null then raise exception 'No result has been reported yet'; end if;
  if _m.report_deadline is null or now() <= _m.report_deadline then
    raise exception 'The 45 minute confirmation window has not passed yet';
  end if;
  perform _advance_tournament_match(_match_id, _m.reported_winner_id);
end; $function$;
REVOKE ALL ON FUNCTION public.finalize_tournament_match_report(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finalize_tournament_match_report(uuid) TO authenticated;