ALTER TABLE public.champ_entries ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'singles';
ALTER TABLE public.champ_entries ADD COLUMN IF NOT EXISTS partner_id uuid;
DROP FUNCTION IF EXISTS public.champ_board(timestamptz, timestamptz);
CREATE FUNCTION public.champ_board(_from timestamptz, _to timestamptz)
RETURNS TABLE(cap text, starts_at timestamptz, user_id uuid, username text, display_name text, avatar_url text, country text, cricket_mpr numeric, mpr_verified boolean, format text, partner_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.cap, e.starts_at, e.user_id, p.username, p.display_name, p.avatar_url, p.country, p.cricket_mpr, p.mpr_verified, e.format, e.partner_id
  FROM public.champ_entries e LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.status = 'paid' AND e.starts_at >= _from AND e.starts_at <= _to
  ORDER BY e.starts_at, e.cap, e.created_at;
$$;
GRANT EXECUTE ON FUNCTION public.champ_board(timestamptz, timestamptz) TO anon, authenticated;