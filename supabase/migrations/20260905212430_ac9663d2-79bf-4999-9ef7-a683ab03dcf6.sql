CREATE TYPE public.withdrawal_status AS ENUM ('pending','paid','rejected');

CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  method text NOT NULL,
  destination text NOT NULL,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  note text,
  admin_id uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Staff read all withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount_cents bigint, _method text, _destination text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public._assert_not_banned(_uid);
  IF _method NOT IN ('paypal','cashapp','venmo') THEN
    RAISE EXCEPTION 'Unsupported payout method';
  END IF;
  IF _destination IS NULL OR length(btrim(_destination)) < 3 THEN
    RAISE EXCEPTION 'Enter a valid payout destination';
  END IF;
  IF _amount_cents IS NULL OR _amount_cents < 500 THEN
    RAISE EXCEPTION 'Minimum withdrawal is $5.00';
  END IF;

  PERFORM public._debit_wallet(_uid, _amount_cents, 'withdrawal'::txn_kind, NULL, 'Cash withdrawal request');

  INSERT INTO public.withdrawal_requests (user_id, amount_cents, method, destination)
  VALUES (_uid, _amount_cents, _method, btrim(_destination))
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_withdrawal_paid(_request_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r public.withdrawal_requests%ROWTYPE;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO _r FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;

  UPDATE public.withdrawal_requests
     SET status = 'paid', note = _note, admin_id = auth.uid(), processed_at = now()
   WHERE id = _request_id;

  PERFORM public._log_admin('withdrawal_paid', _r.user_id, _request_id::text, _r.amount_cents, _note);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(_request_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r public.withdrawal_requests%ROWTYPE;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO _r FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;

  UPDATE public.withdrawal_requests
     SET status = 'rejected', note = _reason, admin_id = auth.uid(), processed_at = now()
   WHERE id = _request_id;

  PERFORM public._credit_wallet(_r.user_id, _r.amount_cents, 'refund'::txn_kind, NULL, 'Withdrawal rejected refund');
  PERFORM public._log_admin('withdrawal_rejected', _r.user_id, _request_id::text, _r.amount_cents, _reason);
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal(bigint, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_mark_withdrawal_paid(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reject_withdrawal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_withdrawal_paid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_withdrawal(uuid, text) TO authenticated;