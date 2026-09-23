
-- profiles
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_staff(auth.uid())
  OR NOT EXISTS (SELECT 1 FROM public.player_bans b WHERE b.user_id = profiles.id)
);

-- matches
DROP POLICY IF EXISTS "Authenticated users can browse matches" ON public.matches;
CREATE POLICY "Authenticated users can browse matches"
ON public.matches FOR SELECT TO authenticated
USING (
  status = 'open'::match_status
  OR creator_id = auth.uid()
  OR opponent_id = auth.uid()
  OR invited_id = auth.uid()
  OR public.is_staff(auth.uid())
);

-- tournaments
DROP POLICY IF EXISTS "Authenticated can view tournaments" ON public.tournaments;
CREATE POLICY "Authenticated can view tournaments"
ON public.tournaments FOR SELECT TO authenticated
USING (
  status IN ('open'::tournament_status, 'live'::tournament_status)
  OR creator_id = auth.uid()
  OR winner_id = auth.uid()
  OR runner_up_id = auth.uid()
  OR third_id = auth.uid()
  OR public.is_staff(auth.uid())
);

-- tournament_participants
DROP POLICY IF EXISTS "Authenticated can view tournament participants" ON public.tournament_participants;
CREATE POLICY "Authenticated can view tournament participants"
ON public.tournament_participants FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_participants.tournament_id
      AND (t.status IN ('open'::tournament_status, 'live'::tournament_status) OR t.creator_id = auth.uid())
  )
);

-- restricted_regions
DROP POLICY IF EXISTS "Anyone can read restricted regions" ON public.restricted_regions;
CREATE POLICY "Anyone can read restricted regions"
ON public.restricted_regions FOR SELECT
USING (active);
