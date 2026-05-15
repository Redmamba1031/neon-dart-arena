
-- Enums
create type public.tournament_status as enum ('open','live','completed','cancelled');
create type public.bracket_side as enum ('winners','losers','grand_final');

-- Tables
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null,
  name text not null,
  mode public.match_mode not null,
  best_of int not null check (best_of in (1,3,5)),
  size int not null check (size in (4,8)),
  entry_cents bigint not null check (entry_cents >= 100 and entry_cents <= 100000000),
  rake_bps int not null default 500,
  double_in boolean not null default false,
  finish_rule public.finish_rule not null default 'double',
  status public.tournament_status not null default 'open',
  winner_id uuid,
  runner_up_id uuid,
  third_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.tournaments(status, created_at desc);

create table public.tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null,
  seed int,
  placement int,
  joined_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);
create index on public.tournament_participants(tournament_id);
create index on public.tournament_participants(user_id);

create table public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  side public.bracket_side not null,
  round int not null,
  slot int not null,
  player1_id uuid,
  player2_id uuid,
  winner_id uuid,
  loser_id uuid,
  next_winner_match_id uuid,
  next_winner_slot int,
  next_loser_match_id uuid,
  next_loser_slot int,
  is_final boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.tournament_matches(tournament_id, side, round, slot);

-- RLS
alter table public.tournaments enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.tournament_matches enable row level security;

create policy "Authenticated can view tournaments"
  on public.tournaments for select to authenticated using (true);
create policy "Authenticated can view tournament participants"
  on public.tournament_participants for select to authenticated using (true);
create policy "Authenticated can view tournament matches"
  on public.tournament_matches for select to authenticated using (true);

-- Bracket builder: 4 players
create or replace function public._build_bracket_4(_tid uuid, _seeds uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare m1 uuid; m2 uuid; m3 uuid; m4 uuid; m5 uuid; m6 uuid;
begin
  insert into tournament_matches(tournament_id,side,round,slot,player1_id,player2_id)
    values(_tid,'winners',1,1,_seeds[1],_seeds[4]) returning id into m1;
  insert into tournament_matches(tournament_id,side,round,slot,player1_id,player2_id)
    values(_tid,'winners',1,2,_seeds[2],_seeds[3]) returning id into m2;
  insert into tournament_matches(tournament_id,side,round,slot)
    values(_tid,'winners',2,1) returning id into m3;
  insert into tournament_matches(tournament_id,side,round,slot)
    values(_tid,'losers',1,1) returning id into m4;
  insert into tournament_matches(tournament_id,side,round,slot)
    values(_tid,'losers',2,1) returning id into m5;
  insert into tournament_matches(tournament_id,side,round,slot,is_final)
    values(_tid,'grand_final',1,1,true) returning id into m6;

  update tournament_matches set next_winner_match_id=m3,next_winner_slot=1,next_loser_match_id=m4,next_loser_slot=1 where id=m1;
  update tournament_matches set next_winner_match_id=m3,next_winner_slot=2,next_loser_match_id=m4,next_loser_slot=2 where id=m2;
  update tournament_matches set next_winner_match_id=m6,next_winner_slot=1,next_loser_match_id=m5,next_loser_slot=2 where id=m3;
  update tournament_matches set next_winner_match_id=m5,next_winner_slot=1 where id=m4;
  update tournament_matches set next_winner_match_id=m6,next_winner_slot=2 where id=m5;
end; $$;

-- Bracket builder: 8 players
create or replace function public._build_bracket_8(_tid uuid, _seeds uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  w1 uuid; w2 uuid; w3 uuid; w4 uuid; w5 uuid; w6 uuid; w7 uuid;
  l1 uuid; l2 uuid; l3 uuid; l4 uuid; l5 uuid; l6 uuid;
  gf uuid;
begin
  insert into tournament_matches(tournament_id,side,round,slot,player1_id,player2_id) values(_tid,'winners',1,1,_seeds[1],_seeds[8]) returning id into w1;
  insert into tournament_matches(tournament_id,side,round,slot,player1_id,player2_id) values(_tid,'winners',1,2,_seeds[4],_seeds[5]) returning id into w2;
  insert into tournament_matches(tournament_id,side,round,slot,player1_id,player2_id) values(_tid,'winners',1,3,_seeds[2],_seeds[7]) returning id into w3;
  insert into tournament_matches(tournament_id,side,round,slot,player1_id,player2_id) values(_tid,'winners',1,4,_seeds[3],_seeds[6]) returning id into w4;
  insert into tournament_matches(tournament_id,side,round,slot) values(_tid,'winners',2,1) returning id into w5;
  insert into tournament_matches(tournament_id,side,round,slot) values(_tid,'winners',2,2) returning id into w6;
  insert into tournament_matches(tournament_id,side,round,slot) values(_tid,'winners',3,1) returning id into w7;
  insert into tournament_matches(tournament_id,side,round,slot) values(_tid,'losers',1,1) returning id into l1;
  insert into tournament_matches(tournament_id,side,round,slot) values(_tid,'losers',1,2) returning id into l2;
  insert into tournament_matches(tournament_id,side,round,slot) values(_tid,'losers',2,1) returning id into l3;
  insert into tournament_matches(tournament_id,side,round,slot) values(_tid,'losers',2,2) returning id into l4;
  insert into tournament_matches(tournament_id,side,round,slot) values(_tid,'losers',3,1) returning id into l5;
  insert into tournament_matches(tournament_id,side,round,slot) values(_tid,'losers',4,1) returning id into l6;
  insert into tournament_matches(tournament_id,side,round,slot,is_final) values(_tid,'grand_final',1,1,true) returning id into gf;

  update tournament_matches set next_winner_match_id=w5,next_winner_slot=1,next_loser_match_id=l1,next_loser_slot=1 where id=w1;
  update tournament_matches set next_winner_match_id=w5,next_winner_slot=2,next_loser_match_id=l1,next_loser_slot=2 where id=w2;
  update tournament_matches set next_winner_match_id=w6,next_winner_slot=1,next_loser_match_id=l2,next_loser_slot=1 where id=w3;
  update tournament_matches set next_winner_match_id=w6,next_winner_slot=2,next_loser_match_id=l2,next_loser_slot=2 where id=w4;
  update tournament_matches set next_winner_match_id=w7,next_winner_slot=1,next_loser_match_id=l3,next_loser_slot=2 where id=w5;
  update tournament_matches set next_winner_match_id=w7,next_winner_slot=2,next_loser_match_id=l4,next_loser_slot=2 where id=w6;
  update tournament_matches set next_winner_match_id=gf,next_winner_slot=1,next_loser_match_id=l6,next_loser_slot=2 where id=w7;
  update tournament_matches set next_winner_match_id=l3,next_winner_slot=1 where id=l1;
  update tournament_matches set next_winner_match_id=l4,next_winner_slot=1 where id=l2;
  update tournament_matches set next_winner_match_id=l5,next_winner_slot=1 where id=l3;
  update tournament_matches set next_winner_match_id=l5,next_winner_slot=2 where id=l4;
  update tournament_matches set next_winner_match_id=l6,next_winner_slot=1 where id=l5;
  update tournament_matches set next_winner_match_id=gf,next_winner_slot=2 where id=l6;
end; $$;

-- Internal start helper
create or replace function public._start_tournament(_tournament_id uuid)
returns void language plpgsql security definer set search_path = public as $$
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
  end if;

  update tournaments set status='live', started_at=now() where id=_tournament_id;
end; $$;

-- Public RPCs
create or replace function public.create_tournament(
  _name text, _mode public.match_mode, _best_of int, _size int, _entry_cents bigint,
  _double_in boolean default false, _finish_rule public.finish_rule default 'double'
) returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _tid uuid;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if _size not in (4,8) then raise exception 'Size must be 4 or 8'; end if;
  if _best_of not in (1,3,5) then raise exception 'Invalid best_of'; end if;
  if _entry_cents < 100 or _entry_cents > 100000000 then raise exception 'Entry out of range'; end if;
  if length(coalesce(_name,'')) < 3 or length(_name) > 60 then raise exception 'Name must be 3-60 chars'; end if;

  insert into tournaments(creator_id,name,mode,best_of,size,entry_cents,double_in,finish_rule)
    values(_uid,_name,_mode,_best_of,_size,_entry_cents,_double_in,_finish_rule)
    returning id into _tid;

  perform _debit_wallet(_uid,_entry_cents,'match_stake',null,'Tournament entry: '||_name);
  insert into tournament_participants(tournament_id,user_id) values(_tid,_uid);

  return _tid;
end; $$;

create or replace function public.join_tournament(_tournament_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _t public.tournaments%rowtype; _count int;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _t from tournaments where id=_tournament_id for update;
  if not found then raise exception 'Tournament not found'; end if;
  if _t.status <> 'open' then raise exception 'Tournament not open'; end if;
  if exists(select 1 from tournament_participants where tournament_id=_tournament_id and user_id=_uid) then
    raise exception 'Already joined';
  end if;
  select count(*) into _count from tournament_participants where tournament_id=_tournament_id;
  if _count >= _t.size then raise exception 'Tournament full'; end if;

  perform _debit_wallet(_uid,_t.entry_cents,'match_stake',null,'Tournament entry: '||_t.name);
  insert into tournament_participants(tournament_id,user_id) values(_tournament_id,_uid);

  if _count + 1 >= _t.size then
    perform _start_tournament(_tournament_id);
  end if;
end; $$;

create or replace function public.cancel_tournament(_tournament_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _t public.tournaments%rowtype; _p record;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _t from tournaments where id=_tournament_id for update;
  if not found then raise exception 'Tournament not found'; end if;
  if _t.creator_id <> _uid then raise exception 'Only creator can cancel'; end if;
  if _t.status <> 'open' then raise exception 'Only open tournaments can be cancelled'; end if;

  for _p in select user_id from tournament_participants where tournament_id=_tournament_id loop
    perform _credit_wallet(_p.user_id,_t.entry_cents,'refund',null,'Tournament cancelled: '||_t.name);
  end loop;

  update tournaments set status='cancelled', cancelled_at=now() where id=_tournament_id;
end; $$;

create or replace function public.report_tournament_match(_match_id uuid, _winner_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _m public.tournament_matches%rowtype;
  _t public.tournaments%rowtype;
  _loser uuid;
  _pot bigint; _net bigint;
  _first uuid; _second uuid; _third uuid;
  _amt bigint;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _m from tournament_matches where id=_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _m.completed_at is not null then raise exception 'Match already completed'; end if;
  if _m.player1_id is null or _m.player2_id is null then raise exception 'Match not ready'; end if;
  if _winner_id <> _m.player1_id and _winner_id <> _m.player2_id then raise exception 'Invalid winner'; end if;
  if _uid <> _m.player1_id and _uid <> _m.player2_id then raise exception 'Only participants can report'; end if;

  select * into _t from tournaments where id=_m.tournament_id for update;
  if _t.status <> 'live' then raise exception 'Tournament not live'; end if;

  _loser := case when _winner_id=_m.player1_id then _m.player2_id else _m.player1_id end;

  update tournament_matches
    set winner_id=_winner_id, loser_id=_loser, completed_at=now()
    where id=_match_id;

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
      where tournament_id=_m.tournament_id and side='losers'
        and next_winner_match_id=_m.id
      limit 1;

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
      winner_id=_first, runner_up_id=_second, third_id=_third
      where id=_t.id;
  end if;
end; $$;

-- Realtime
alter publication supabase_realtime add table public.tournaments;
alter publication supabase_realtime add table public.tournament_matches;
alter publication supabase_realtime add table public.tournament_participants;
