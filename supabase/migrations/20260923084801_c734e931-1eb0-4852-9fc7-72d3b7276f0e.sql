DROP POLICY IF EXISTS "Authenticated can view dart throws" ON public.dart_throws;

CREATE POLICY "Participants and staff can view dart throws"
ON public.dart_throws FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = dart_throws.match_id
      AND (m.creator_id = auth.uid() OR m.opponent_id = auth.uid())
  )
);