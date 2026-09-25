ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_source text;

CREATE OR REPLACE FUNCTION public.set_my_signup_source(_source text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET signup_source = left(coalesce(nullif(trim(_source),''),'direct'), 80)
  WHERE id = auth.uid() AND signup_source IS NULL;
$$;
REVOKE ALL ON FUNCTION public.set_my_signup_source(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_my_signup_source(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_growth_stats(_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _since timestamptz := now() - make_interval(days => greatest(1, least(_days, 365)));
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN jsonb_build_object(
    'signups', (SELECT count(*) FROM public.profiles WHERE created_at >= _since),
    'first_deposits', (SELECT count(*) FROM (SELECT user_id, min(credited_at) f FROM public.deposits WHERE status='credited' GROUP BY user_id) x WHERE f >= _since),
    'bonus_claims', (SELECT count(*) FROM public.wallet_transactions WHERE note='First deposit bonus (20%)' AND created_at >= _since),
    'bonus_cents', (SELECT coalesce(sum(amount_cents),0) FROM public.wallet_transactions WHERE note='First deposit bonus (20%)' AND created_at >= _since),
    'sources', (SELECT coalesce(jsonb_agg(q.s ORDER BY (q.s->>'signups')::int DESC),'[]'::jsonb) FROM (
        SELECT jsonb_build_object('source', coalesce(p.signup_source,'unknown'), 'signups', count(*),
          'deposited', count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.deposits d WHERE d.user_id=p.id AND d.status='credited'))) AS s
        FROM public.profiles p WHERE p.created_at >= _since GROUP BY coalesce(p.signup_source,'unknown')) q),
    'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', t.d, 'signups', t.su, 'first_deposits', t.fd, 'bonuses', t.bc) ORDER BY t.d DESC),'[]'::jsonb) FROM (
        SELECT g::date AS d,
          (SELECT count(*) FROM public.profiles WHERE created_at::date = g::date) AS su,
          (SELECT count(*) FROM (SELECT min(credited_at) f FROM public.deposits WHERE status='credited' GROUP BY user_id) x WHERE f::date = g::date) AS fd,
          (SELECT count(*) FROM public.wallet_transactions WHERE note='First deposit bonus (20%)' AND created_at::date = g::date) AS bc
        FROM generate_series(_since::date, now()::date, interval '1 day') g) t)
  );
END; $$;
REVOKE ALL ON FUNCTION public.admin_growth_stats(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_growth_stats(int) TO authenticated;