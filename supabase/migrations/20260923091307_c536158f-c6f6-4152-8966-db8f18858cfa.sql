CREATE OR REPLACE FUNCTION public.admin_retry_withdrawal(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _r public.withdrawal_requests%ROWTYPE;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO _r FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF _r.status NOT IN ('failed','processing','approved') THEN
    RAISE EXCEPTION 'Only a failed or stuck payout can be retried';
  END IF;
  IF _r.method NOT IN ('paypal','venmo','bank') THEN
    RAISE EXCEPTION 'This method must be paid out by hand';
  END IF;

  UPDATE public.withdrawal_requests
     SET status = 'approved',
         attempts = 0,
         requires_review = false,
         failure_reason = NULL,
         hold_until = now(),
         processed_at = NULL,
         approved_by = COALESCE(approved_by, auth.uid()),
         approved_at = COALESCE(approved_at, now())
   WHERE id = _request_id;

  PERFORM public._log_admin('withdrawal_retried', _r.user_id, _request_id::text, _r.amount_cents, _r.failure_reason);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.admin_retry_withdrawal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_retry_withdrawal(uuid) TO authenticated;