CREATE OR REPLACE FUNCTION public.join_match(_match_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

  perform public._charge_entry(_uid, _match_id, _m.stake_cents, _m.rake_bps, 'Joined match');

  update public.matches
    set opponent_id = _uid, status = 'live', started_at = now(),
        report_deadline = now() + interval '2 hours'
    where id = _match_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.report_match_winner(_match_id uuid, _winner_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
      report_deadline = coalesce(report_deadline, now() + interval '2 hours')
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

  -- conflicting winners always dispute and hold the payout, even after the deadline
  update matches set disputed = true where id = _match_id;
  return 'disputed';
end; $function$;

CREATE OR REPLACE FUNCTION public.finalize_match_report(_match_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid(); _m public.matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _m from matches where id = _match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _uid <> _m.creator_id and _uid <> coalesce(_m.opponent_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    raise exception 'Only participants can finalize';
  end if;
  if _m.status <> 'live' then raise exception 'Match is not live'; end if;
  if _m.disputed then raise exception 'Match is disputed — staff will review it and release the funds'; end if;
  if _m.reported_winner_id is null then raise exception 'No result has been reported yet'; end if;
  if _m.report_deadline is null or now() <= _m.report_deadline then
    raise exception 'The 2 hour confirmation window has not passed yet';
  end if;
  perform _settle_match(_match_id, _m.reported_winner_id);
end; $function$;

CREATE OR REPLACE FUNCTION public.report_tournament_winner(_match_id uuid, _winner_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
      report_deadline = coalesce(report_deadline, now() + interval '2 hours') where id=_match_id;
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

  update tournament_matches set disputed = true where id=_match_id;
  return 'disputed';
end; $function$;

CREATE OR REPLACE FUNCTION public.finalize_tournament_match_report(_match_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid(); _m public.tournament_matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _m from tournament_matches where id=_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _uid <> _m.player1_id and _uid <> _m.player2_id then raise exception 'Only participants can finalize'; end if;
  if _m.completed_at is not null then raise exception 'Match already completed'; end if;
  if _m.disputed then raise exception 'Match is disputed — staff will review it and release the funds'; end if;
  if _m.reported_winner_id is null then raise exception 'No result has been reported yet'; end if;
  if _m.report_deadline is null or now() <= _m.report_deadline then
    raise exception 'The 2 hour confirmation window has not passed yet';
  end if;
  perform _advance_tournament_match(_match_id, _m.reported_winner_id);
end; $function$;

CREATE OR REPLACE FUNCTION public.set_tournament_match_deadline()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
begin
  if new.player1_id is not null and new.player2_id is not null
     and new.completed_at is null and new.report_deadline is null then
    new.report_deadline := now() + interval '2 hours';
  end if;
  return new;
end; $function$;