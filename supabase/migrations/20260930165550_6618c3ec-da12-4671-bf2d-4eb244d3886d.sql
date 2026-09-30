CREATE OR REPLACE FUNCTION public.admin_growth_stats(_days integer DEFAULT 30)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _since timestamptz := now() - make_interval(days => greatest(_days, 1));
  _signups int; _first_deposits int; _bonus_claims int; _bonus_cents bigint;
  _sources jsonb; _daily jsonb; _clicks int; _reached int; _funnel jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT count(*) INTO _signups FROM profiles WHERE created_at >= _since;

  SELECT count(DISTINCT user_id) INTO _first_deposits FROM wallet_transactions
  WHERE kind::text = 'deposit' AND coalesce(note,'') <> 'First deposit bonus (20%)' AND created_at >= _since;

  SELECT count(*), coalesce(sum(amount_cents), 0) INTO _bonus_claims, _bonus_cents FROM wallet_transactions
  WHERE kind::text = 'deposit' AND note = 'First deposit bonus (20%)' AND created_at >= _since;

  SELECT coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb) INTO _sources FROM (
    SELECT coalesce(signup_source, 'unknown') AS source, count(*) AS signups,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM wallet_transactions wt
        WHERE wt.user_id = p.id AND wt.kind::text = 'deposit')) AS deposited
    FROM profiles p WHERE p.created_at >= _since GROUP BY 1 ORDER BY 2 DESC) s;

  SELECT coalesce(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb) INTO _daily FROM (
    SELECT to_char(day, 'YYYY-MM-DD') AS day, sum(signups)::int AS signups,
      sum(first_deposits)::int AS first_deposits, sum(bonuses)::int AS bonuses
    FROM (
      SELECT date_trunc('day', created_at) AS day, count(*) AS signups, 0::bigint AS first_deposits, 0::bigint AS bonuses
      FROM profiles WHERE created_at >= _since GROUP BY 1
      UNION ALL
      SELECT date_trunc('day', created_at), 0, count(DISTINCT user_id), 0 FROM wallet_transactions
      WHERE kind::text = 'deposit' AND coalesce(note,'') <> 'First deposit bonus (20%)' AND created_at >= _since GROUP BY 1
      UNION ALL
      SELECT date_trunc('day', created_at), 0, 0, count(*) FROM wallet_transactions
      WHERE kind::text = 'deposit' AND note = 'First deposit bonus (20%)' AND created_at >= _since GROUP BY 1
    ) x GROUP BY 1) d;

  SELECT count(DISTINCT session_id) INTO _clicks FROM page_events
  WHERE event = 'howto_signup_click' AND created_at >= _since;
  SELECT count(DISTINCT dv.session_id) INTO _reached FROM page_events dv
  WHERE dv.event = 'dashboard_view' AND dv.created_at >= _since
    AND EXISTS (SELECT 1 FROM page_events c WHERE c.event = 'howto_signup_click' AND c.session_id = dv.session_id);

  _funnel := jsonb_build_object('howto_clicks', coalesce(_clicks,0), 'reached_dashboard', coalesce(_reached,0),
    'pct', CASE WHEN coalesce(_clicks,0) > 0 THEN round(_reached::numeric*100/_clicks) ELSE 0 END);

  RETURN jsonb_build_object('signups', _signups, 'first_deposits', _first_deposits,
    'bonus_claims', _bonus_claims, 'bonus_cents', _bonus_cents,
    'sources', _sources, 'daily', _daily, 'funnel', _funnel);
END;
$function$;