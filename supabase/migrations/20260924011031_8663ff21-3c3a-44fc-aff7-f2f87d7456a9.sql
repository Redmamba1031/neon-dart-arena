CREATE OR REPLACE FUNCTION public._house_only_rake()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.user_id = public._house_account() THEN
    IF NEW.kind = 'rake' OR NEW.kind = 'withdrawal' OR (NEW.kind = 'refund' AND NEW.match_id IS NULL) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'The owner account only receives service-fee profit and cannot play, buy, or be credited otherwise';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public._house_only_rake() FROM public, anon, authenticated;
CREATE TRIGGER wallet_txn_house_only_rake BEFORE INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public._house_only_rake();