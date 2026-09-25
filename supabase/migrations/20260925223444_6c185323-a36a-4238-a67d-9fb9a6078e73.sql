CREATE OR REPLACE FUNCTION public.payouts_claim_due(_limit integer DEFAULT 20)
 RETURNS SETOF withdrawal_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.withdrawal_requests w
     SET status = 'processing', attempts = w.attempts + 1, released_at = now()
   WHERE w.id IN (
     SELECT id FROM public.withdrawal_requests
      WHERE status = 'approved' AND requires_review = false AND hold_until <= now()
        AND method IN ('paypal','venmo') AND attempts < 3
      ORDER BY created_at LIMIT GREATEST(_limit, 1) FOR UPDATE SKIP LOCKED)
  RETURNING w.*;
END; $function$;

CREATE OR REPLACE FUNCTION public._block_bank_withdrawals()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.method NOT IN ('paypal','venmo') THEN
    RAISE EXCEPTION 'Cash outs are only available to PayPal or Venmo';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS block_bank_withdrawals ON public.withdrawal_requests;
CREATE TRIGGER block_bank_withdrawals BEFORE INSERT ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public._block_bank_withdrawals();