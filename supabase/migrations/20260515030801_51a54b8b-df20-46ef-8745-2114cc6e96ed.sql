
-- Update create_tournament to accept 4, 8, 16, 32
CREATE OR REPLACE FUNCTION public.create_tournament(_name text, _mode match_mode, _best_of integer, _size integer, _entry_cents bigint, _double_in boolean DEFAULT false, _finish_rule finish_rule DEFAULT 'double'::finish_rule)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid(); _tid uuid;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if not public.has_role(_uid, 'owner'::public.app_role) then
    raise exception 'Only the app owner can create tournaments';
  end if;
  if _size not in (4,8,16,32) then raise exception 'Size must be 4, 8, 16, or 32'; end if;
  if _best_of not in (1,3,5) then raise exception 'Invalid best_of'; end if;
  if _entry_cents < 100 or _entry_cents > 100000000 then raise exception 'Entry out of range'; end if;
  if length(coalesce(_name,'')) < 3 or length(_name) > 60 then raise exception 'Name must be 3-60 chars'; end if;

  insert into tournaments(creator_id,name,mode,best_of,size,entry_cents,double_in,finish_rule)
    values(_uid,_name,_mode,_best_of,_size,_entry_cents,_double_in,_finish_rule)
    returning id into _tid;

  perform _debit_wallet(_uid,_entry_cents,'match_stake',null,'Tournament entry: '||_name);
  insert into tournament_participants(tournament_id,user_id) values(_tid,_uid);

  return _tid;
end; $function$;

-- Generic single-elimination bracket builder for any power-of-2 size
CREATE OR REPLACE FUNCTION public._build_bracket_se(_tid uuid, _seeds uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _n int := array_length(_seeds, 1);
  _rounds int;
  _r int;
  _matches_in_round int;
  _s int;
  _ids uuid[];
  _prev_ids uuid[];
  _new_id uuid;
  _p1 uuid; _p2 uuid;
  _is_final boolean;
begin
  _rounds := ceil(ln(_n) / ln(2))::int;
  _prev_ids := ARRAY[]::uuid[];

  for _r in 1.._rounds loop
    _matches_in_round := _n / (2 ^ _r)::int;
    _ids := ARRAY[]::uuid[];
    _is_final := (_r = _rounds);
    for _s in 1.._matches_in_round loop
      if _r = 1 then
        _p1 := _seeds[_s * 2 - 1];
        _p2 := _seeds[_s * 2];
      else
        _p1 := null;
        _p2 := null;
      end if;
      insert into tournament_matches(tournament_id, side, round, slot, player1_id, player2_id, is_final)
        values(_tid, 'winners', _r, _s, _p1, _p2, _is_final)
        returning id into _new_id;
      _ids := _ids || _new_id;
    end loop;

    -- Wire previous round's winners into this round
    if _r > 1 then
      for _s in 1..array_length(_prev_ids, 1) loop
        update tournament_matches
          set next_winner_match_id = _ids[((_s - 1) / 2) + 1],
              next_winner_slot = case when (_s % 2) = 1 then 1 else 2 end
          where id = _prev_ids[_s];
      end loop;
    end if;

    _prev_ids := _ids;
  end loop;
end; $function$;

-- Update _start_tournament to use SE builder for 16 and 32
CREATE OR REPLACE FUNCTION public._start_tournament(_tournament_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _t public.tournaments%rowtype; _seeds uuid[];
begin
  select * into _t from tournaments where id=_tournament_id for update;
  if _t.status <> 'open' then return; end if;

  with shuffled as (
    select user_id, row_number() over (order by random()) as seed
    from tournament_participants where tournament_id=_tournament_id
  )
  update tournament_participants tp set seed=s.seed
    from shuffled s where tp.tournament_id=_tournament_id and tp.user_id=s.user_id;

  select array_agg(user_id order by seed) into _seeds
    from tournament_participants where tournament_id=_tournament_id;

  if _t.size = 4 then perform _build_bracket_4(_tournament_id, _seeds);
  elsif _t.size = 8 then perform _build_bracket_8(_tournament_id, _seeds);
  elsif _t.size = 16 then perform _build_bracket_se(_tournament_id, _seeds);
  elsif _t.size = 32 then perform _build_bracket_se(_tournament_id, _seeds);
  end if;

  update tournaments set status='live', started_at=now() where id=_tournament_id;
end; $function$;
