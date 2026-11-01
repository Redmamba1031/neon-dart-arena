ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cricket_mpr numeric(4,2), ADD COLUMN IF NOT EXISTS mpr_verified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public._protect_mpr_verified() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.mpr_verified IS DISTINCT FROM OLD.mpr_verified
     AND auth.uid() IS NOT NULL AND NOT public.is_staff(auth.uid())
     AND coalesce(current_setting('smyd.mpr_ok', true), '') <> '1' THEN
    NEW.mpr_verified := OLD.mpr_verified;
  END IF;
  IF NEW.cricket_mpr IS DISTINCT FROM OLD.cricket_mpr
     AND auth.uid() IS NOT NULL AND NOT public.is_staff(auth.uid())
     AND coalesce(current_setting('smyd.mpr_ok', true), '') <> '1' THEN
    NEW.cricket_mpr := OLD.cricket_mpr;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_mpr_verified ON public.profiles;
CREATE TRIGGER protect_mpr_verified BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public._protect_mpr_verified();

CREATE OR REPLACE FUNCTION public.set_my_mpr(_mpr numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _mpr IS NULL OR _mpr < 0 OR _mpr > 9 THEN RAISE EXCEPTION 'MPR must be between 0 and 9'; END IF;
  PERFORM set_config('smyd.mpr_ok', '1', true);
  UPDATE public.profiles SET cricket_mpr = round(_mpr, 2), mpr_verified = false WHERE id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.set_my_mpr(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_mpr(numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_mpr_verified(_user_id uuid, _verified boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_staff();
  PERFORM set_config('smyd.mpr_ok', '1', true);
  UPDATE public.profiles SET mpr_verified = _verified WHERE id = _user_id;
  PERFORM public._log_admin('mpr_verify', _user_id, NULL, NULL, CASE WHEN _verified THEN 'MPR verified' ELSE 'MPR unverified' END);
END $$;
REVOKE ALL ON FUNCTION public.admin_set_mpr_verified(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_mpr_verified(uuid, boolean) TO authenticated;

CREATE TABLE public.champ_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cap text NOT NULL,
  starts_at timestamptz NOT NULL,
  user_id uuid NOT NULL,
  stripe_session_id text NOT NULL UNIQUE,
  payment_intent text,
  amount_cents integer NOT NULL DEFAULT 2500,
  status text NOT NULL DEFAULT 'paid',
  environment text NOT NULL DEFAULT 'sandbox',
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX champ_entries_one_per_bracket ON public.champ_entries(cap, starts_at, user_id) WHERE status = 'paid';
GRANT SELECT ON public.champ_entries TO authenticated;
GRANT ALL ON public.champ_entries TO service_role;
ALTER TABLE public.champ_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own champ entries" ON public.champ_entries FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.champ_board(_from timestamptz, _to timestamptz)
RETURNS TABLE(cap text, starts_at timestamptz, user_id uuid, username text, display_name text, avatar_url text, country text, cricket_mpr numeric, mpr_verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.cap, e.starts_at, e.user_id, p.username, p.display_name, p.avatar_url, p.country, p.cricket_mpr, p.mpr_verified
  FROM public.champ_entries e LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.status = 'paid' AND e.starts_at >= _from AND e.starts_at <= _to
  ORDER BY e.starts_at, e.cap, e.created_at;
$$;
GRANT EXECUTE ON FUNCTION public.champ_board(timestamptz, timestamptz) TO anon, authenticated;