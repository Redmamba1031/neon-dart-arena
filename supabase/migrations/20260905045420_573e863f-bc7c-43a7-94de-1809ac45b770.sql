-- ============ PROFILES: stats + unique username ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS losses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating integer NOT NULL DEFAULT 1000;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- Block clients from editing protected columns
CREATE OR REPLACE FUNCTION public.protect_profile_stats()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('app.allow_stats', true) IS DISTINCT FROM 'on' THEN
    NEW.wins := OLD.wins;
    NEW.losses := OLD.losses;
    NEW.rating := OLD.rating;
    NEW.id := OLD.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_protect_stats ON public.profiles;
CREATE TRIGGER profiles_protect_stats BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_stats();

-- ============ MATCHES: invitations + scores ============
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS invited_id uuid,
  ADD COLUMN IF NOT EXISTS creator_legs integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opponent_legs integer NOT NULL DEFAULT 0;

-- ============ CHALLENGES ============
DO $$ BEGIN
  CREATE TYPE public.challenge_status AS ENUM ('pending','accepted','declined','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  challenger_id uuid NOT NULL,
  challenged_id uuid NOT NULL,
  status public.challenge_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
GRANT SELECT ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants read own challenges" ON public.challenges;
CREATE POLICY "Participants read own challenges" ON public.challenges
  FOR SELECT TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

-- ============ MATCH LEGS: richer state ============
ALTER TABLE public.match_legs
  ADD COLUMN IF NOT EXISTS creator_remaining integer,
  ADD COLUMN IF NOT EXISTS opponent_remaining integer,
  ADD COLUMN IF NOT EXISTS state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.match_legs ALTER COLUMN completed_at DROP NOT NULL;
ALTER TABLE public.match_legs ALTER COLUMN completed_at DROP DEFAULT;

-- ============ DART THROWS ============
CREATE TABLE IF NOT EXISTS public.dart_throws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  leg_id uuid NOT NULL REFERENCES public.match_legs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  turn_number integer NOT NULL,
  dart_number integer NOT NULL CHECK (dart_number BETWEEN 1 AND 3),
  segment integer NOT NULL CHECK (segment BETWEEN 0 AND 25),
  multiplier integer NOT NULL CHECK (multiplier BETWEEN 0 AND 3),
  points integer NOT NULL DEFAULT 0,
  busted boolean NOT NULL DEFAULT false,
  remaining_after integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dart_throws_leg_idx ON public.dart_throws(leg_id, turn_number, dart_number);
GRANT SELECT ON public.dart_throws TO authenticated;
GRANT ALL ON public.dart_throws TO service_role;
ALTER TABLE public.dart_throws ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view dart throws" ON public.dart_throws;
CREATE POLICY "Authenticated can view dart throws" ON public.dart_throws
  FOR SELECT TO authenticated USING (true);

-- ============ MATCH RESULTS ============
CREATE TABLE IF NOT EXISTS public.match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  winner_id uuid NOT NULL,
  loser_id uuid,
  winner_legs integer NOT NULL DEFAULT 0,
  loser_legs integer NOT NULL DEFAULT 0,
  payout_cents bigint NOT NULL DEFAULT 0,
  rake_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.match_results TO authenticated;
GRANT ALL ON public.match_results TO service_role;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view match results" ON public.match_results;
CREATE POLICY "Authenticated can view match results" ON public.match_results
  FOR SELECT TO authenticated USING (true);

-- ============ COIN LEDGER VIEW ============
CREATE OR REPLACE VIEW public.coin_transactions
WITH (security_invoker = true) AS
  SELECT id, user_id, amount_cents AS amount_coins, kind, match_id, note, created_at
  FROM public.wallet_transactions;
GRANT SELECT ON public.coin_transactions TO authenticated;

-- ============ CREATE MATCH WITH OPTIONAL CHALLENGE ============
CREATE OR REPLACE FUNCTION public.create_match(
  _mode match_mode, _best_of integer, _stake_cents bigint,
  _double_in boolean DEFAULT false, _finish_rule finish_rule DEFAULT 'double'::finish_rule,
  _opponent_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _uid uuid := auth.uid(); _match_id uuid;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
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
end; $$;

CREATE OR REPLACE FUNCTION public.respond_challenge(_challenge_id uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    update matches set opponent_id = _uid, status = 'live', started_at = now() where id = _m.id;
    update challenges set status = 'accepted', responded_at = now() where id = _challenge_id;
  else
    if _m.status = 'open' then
      perform _credit_wallet(_m.creator_id, _m.stake_cents, 'refund', _m.id, 'Challenge declined');
      update matches set status = 'cancelled', cancelled_at = now() where id = _m.id;
    end if;
    update challenges set status = 'declined', responded_at = now() where id = _challenge_id;
  end if;
end; $$;

-- ============ LEG LIFECYCLE ============
CREATE OR REPLACE FUNCTION public.start_leg(_match_id uuid, _leg_mode match_mode)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _uid uuid := auth.uid(); _m public.matches%rowtype; _n integer; _leg uuid;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _m from matches where id = _match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _m.status <> 'live' then raise exception 'Match is not live'; end if;
  if _uid <> _m.creator_id and _uid <> _m.opponent_id then raise exception 'Not a participant'; end if;

  select id into _leg from match_legs where match_id = _match_id and completed_at is null limit 1;
  if _leg is not null then return _leg; end if;

  select coalesce(max(leg_number),0) + 1 into _n from match_legs where match_id = _match_id;
  insert into match_legs (match_id, leg_number, leg_mode, creator_remaining, opponent_remaining)
  values (_match_id, _n, _leg_mode,
          case when _leg_mode = 'Cricket' then 0 else 501 end,
          case when _leg_mode = 'Cricket' then 0 else 501 end)
  returning id into _leg;
  return _leg;
end; $$;

CREATE OR REPLACE FUNCTION public.record_dart(
  _leg_id uuid, _turn_number integer, _dart_number integer,
  _segment integer, _multiplier integer, _busted boolean DEFAULT false,
  _remaining_after integer DEFAULT NULL, _state jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _uid uuid := auth.uid(); _l public.match_legs%rowtype; _m public.matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _l from match_legs where id = _leg_id;
  if not found then raise exception 'Leg not found'; end if;
  if _l.completed_at is not null then raise exception 'Leg already finished'; end if;
  select * into _m from matches where id = _l.match_id;
  if _uid <> _m.creator_id and _uid <> _m.opponent_id then raise exception 'Not a participant'; end if;

  insert into dart_throws (match_id, leg_id, player_id, turn_number, dart_number, segment, multiplier, points, busted, remaining_after)
  values (_l.match_id, _leg_id, _uid, _turn_number, _dart_number, _segment, _multiplier,
          case when _busted then 0 else _segment * _multiplier end, _busted, _remaining_after);

  if _state is not null then
    update match_legs set state = _state where id = _leg_id;
  end if;
  if _remaining_after is not null then
    if _uid = _m.creator_id then
      update match_legs set creator_remaining = _remaining_after where id = _leg_id;
    else
      update match_legs set opponent_remaining = _remaining_after where id = _leg_id;
    end if;
  end if;
end; $$;

CREATE OR REPLACE FUNCTION public.complete_leg(_leg_id uuid, _winner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _uid uuid := auth.uid(); _l public.match_legs%rowtype; _m public.matches%rowtype;
        _cw integer; _ow integer; _need integer;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _l from match_legs where id = _leg_id for update;
  if not found then raise exception 'Leg not found'; end if;
  if _l.completed_at is not null then return; end if;
  select * into _m from matches where id = _l.match_id for update;
  if _uid <> _m.creator_id and _uid <> _m.opponent_id then raise exception 'Not a participant'; end if;
  if _winner_id <> _m.creator_id and _winner_id <> _m.opponent_id then raise exception 'Invalid winner'; end if;

  update match_legs set winner_id = _winner_id, completed_at = now() where id = _leg_id;

  select count(*) filter (where winner_id = _m.creator_id),
         count(*) filter (where winner_id = _m.opponent_id)
    into _cw, _ow
    from match_legs where match_id = _m.id and completed_at is not null;

  update matches set creator_legs = _cw, opponent_legs = _ow where id = _m.id;

  _need := (_m.best_of / 2) + 1;
  if _cw >= _need then
    perform settle_match(_m.id, _m.creator_id);
  elsif _ow >= _need then
    perform settle_match(_m.id, _m.opponent_id);
  end if;
end; $$;

-- ============ SETTLE: results row, stats, no duplicate payouts ============
CREATE OR REPLACE FUNCTION public.settle_match(_match_id uuid, _winner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  _uid uuid := auth.uid();
  _m public.matches%rowtype;
  _pot bigint; _rake bigint; _payout bigint; _loser uuid;
  _wl integer; _ll integer;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _m from matches where id = _match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _m.status <> 'live' then raise exception 'Match is not live'; end if;
  if _uid <> _m.creator_id and _uid <> _m.opponent_id then raise exception 'Only participants can settle'; end if;
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
end; $$;

-- ============ LEADERBOARD ============
DROP VIEW IF EXISTS public.leaderboard_view;
CREATE VIEW public.leaderboard_view
WITH (security_invoker = true) AS
SELECT
  p.id AS user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.wins,
  p.losses,
  (p.wins + p.losses) AS matches_played,
  p.rating,
  CASE WHEN (p.wins + p.losses) = 0 THEN 0
       ELSE round((p.wins::numeric * 100) / (p.wins + p.losses), 1) END AS win_pct,
  COALESCE((SELECT sum(r.payout_cents) FROM public.match_results r WHERE r.winner_id = p.id), 0) AS total_winnings_cents
FROM public.profiles p;
GRANT SELECT ON public.leaderboard_view TO authenticated;

-- internal helpers stay locked down
REVOKE EXECUTE ON FUNCTION public.protect_profile_stats() FROM anon, authenticated;