CREATE OR REPLACE FUNCTION public.credit_wallet_from_deposit(_user_id uuid, _session_id text, _payment_intent text, _coins_granted bigint, _environment text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _existing public.deposits%rowtype; _first boolean; _bonus bigint;
BEGIN
  IF _coins_granted <= 0 THEN RAISE EXCEPTION 'Coins granted must be positive'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('deposit_' || _user_id::text));
  SELECT * INTO _existing FROM public.deposits WHERE stripe_session_id = _session_id FOR UPDATE;
  IF FOUND AND _existing.status = 'credited' THEN RETURN; END IF;
  _first := NOT EXISTS (SELECT 1 FROM public.deposits WHERE user_id = _user_id AND status = 'credited');
  IF FOUND THEN
    UPDATE public.deposits SET status='credited', credited_at=now(),
      stripe_payment_intent = COALESCE(_payment_intent, stripe_payment_intent), updated_at=now()
      WHERE stripe_session_id = _session_id;
  ELSE
    INSERT INTO public.deposits (user_id, stripe_session_id, stripe_payment_intent, amount_cents, status, environment, credited_at)
    VALUES (_user_id, _session_id, _payment_intent, _coins_granted, 'credited', _environment, now());
  END IF;
  _bonus := CASE WHEN _first THEN (_coins_granted * 20) / 100 ELSE 0 END;
  INSERT INTO public.wallets (user_id, balance_cents) VALUES (_user_id, _coins_granted + _bonus)
    ON CONFLICT (user_id) DO UPDATE SET balance_cents = public.wallets.balance_cents + EXCLUDED.balance_cents, updated_at = now();
  INSERT INTO public.wallet_transactions (user_id, kind, amount_cents, note)
  VALUES (_user_id, 'deposit', _coins_granted, 'Deposit ' || _session_id);
  IF _bonus > 0 THEN
    INSERT INTO public.wallet_transactions (user_id, kind, amount_cents, note)
    VALUES (_user_id, 'deposit', _bonus, 'First deposit bonus (20%)');
  END IF;
END; $function$;