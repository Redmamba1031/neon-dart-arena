CREATE OR REPLACE FUNCTION public.track_page_event(_event text, _path text, _session text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF _event NOT IN ('howto_signup_click', 'dashboard_view') THEN
    RETURN;
  END IF;
  INSERT INTO public.page_events (event, path, session_id)
  VALUES (left(_event, 40), left(coalesce(_path, ''), 120), left(coalesce(_session, ''), 80));
END;
$$;