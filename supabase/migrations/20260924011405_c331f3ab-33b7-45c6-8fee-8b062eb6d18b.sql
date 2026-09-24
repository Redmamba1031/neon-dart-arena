CREATE OR REPLACE FUNCTION public._house_only_rake()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.user_id = public._house_account() THEN
    IF NEW.kind IN ('rake', 'withdrawal', 'match_stake', 'match_payout', 'refund') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'The owner account cannot buy coins or receive manual credits';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public._house_only_rake() FROM public, anon, authenticated;