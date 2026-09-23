ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS age_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_verified_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_my_identity(_legal_name text, _date_of_birth date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF _date_of_birth IS NULL OR _date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'You must be at least 18 years old to play for money on SMYD.';
  END IF;
  IF _legal_name IS NULL OR btrim(_legal_name) = '' THEN
    RAISE EXCEPTION 'Legal name is required.';
  END IF;
  UPDATE public.profiles
  SET legal_name = btrim(_legal_name),
      date_of_birth = _date_of_birth,
      age_verified = false,
      age_verified_at = NULL
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_players()
RETURNS TABLE(
  user_id uuid,
  username text,
  display_name text,
  legal_name text,
  date_of_birth date,
  age integer,
  age_verified boolean,
  email text,
  banned boolean,
  wins integer,
  losses integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._require_staff();
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.legal_name,
    p.date_of_birth,
    CASE WHEN p.date_of_birth IS NULL THEN NULL
         ELSE date_part('year', age(p.date_of_birth))::integer END,
    p.age_verified,
    u.email::text,
    EXISTS (SELECT 1 FROM public.player_bans b WHERE b.user_id = p.id),
    p.wins,
    p.losses,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_age_verified(_user_id uuid, _verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._require_staff();
  UPDATE public.profiles
  SET age_verified = _verified,
      age_verified_at = CASE WHEN _verified THEN now() ELSE NULL END
  WHERE id = _user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;
  PERFORM public._log_admin(
    CASE WHEN _verified THEN 'age_verified' ELSE 'age_unverified' END,
    _user_id, NULL, NULL, NULL
  );
END;
$$;