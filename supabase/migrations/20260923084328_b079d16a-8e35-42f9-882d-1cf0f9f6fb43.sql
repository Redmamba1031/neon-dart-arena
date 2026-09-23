DROP POLICY IF EXISTS "Authenticated users can view match legs" ON public.match_legs;
CREATE POLICY "Participants and staff can view match legs" ON public.match_legs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_legs.match_id
        AND (m.creator_id = auth.uid() OR m.opponent_id = auth.uid())
    )
    OR public.is_staff(auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated can view tournament matches" ON public.tournament_matches;
CREATE POLICY "Participants and staff can view tournament matches" ON public.tournament_matches
  FOR SELECT TO authenticated
  USING (
    player1_id = auth.uid()
    OR player2_id = auth.uid()
    OR public.is_staff(auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated can view match results" ON public.match_results;
CREATE POLICY "Participants and staff can view match results" ON public.match_results
  FOR SELECT TO authenticated
  USING (
    winner_id = auth.uid()
    OR loser_id = auth.uid()
    OR public.is_staff(auth.uid())
  );