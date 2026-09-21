-- 1. relax status column from enum to text with a wider set of states
ALTER TABLE public.withdrawal_requests ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.withdrawal_requests
  ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.withdrawal_requests ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_status_chk
  CHECK (status IN ('pending','approved','processing','paid','failed','rejected'));

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS hold_until timestamptz,
  ADD COLUMN IF NOT EXISTS risk_flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requires_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_payout_id text,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS withdrawal_due_idx
  ON public.withdrawal_requests (status, hold_until);

-- 2. connected payout accounts (Stripe bank / debit card)
CREATE TABLE IF NOT EXISTS public.payout_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL,
  details_submitted boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payout_accounts TO authenticated;
GRANT ALL ON public.payout_accounts TO service_role;
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own payout account" ON public.payout_accounts;
CREATE POLICY "Users read own payout account" ON public.payout_accounts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- 3. risk scoring
CREATE OR REPLACE FUNCTION public.withdrawal_risk_flags(_uid uuid, _amount_cents bigint)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _flags text[] := '{}';
  _created timestamptz;
  _recent_deposits bigint;
  _recent_matches int;
BEGIN
  IF _amount_cents > 20000 THEN
    _flags := array_append(_flags, 'large_amount');
  END IF;

  SELECT created_at INTO _created FROM auth.users WHERE id = _uid;
  IF _created IS NOT NULL AND _created > now() - interval '7 days' THEN
    _flags := array_append(_flags, 'new_account');
  END IF;

  IF EXISTS (SELECT 1 FROM public.player_bans WHERE user_id = _uid)
     OR EXISTS (
       SELECT 1 FROM public.matches m
        WHERE m.disputed = true
          AND m.status <> 'completed'
          AND (m.creator_id = _uid OR m.opponent_id = _uid)
     ) THEN
    _flags := array_append(_flags, 'dispute_or_ban');
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0) INTO _recent_deposits
    FROM public.wallet_transactions
   WHERE user_id = _uid AND kind = 'deposit'
     AND created_at > now() - interval '7 days';

  SELECT COUNT(*) INTO _recent_matches
    FROM public.matches m
   WHERE (m.creator_id = _uid OR m.opponent_id = _uid)
     AND m.status = 'completed'
     AND m.created_at > now() - interval '7 days';

  IF _recent_deposits > 0 AND _recent_matches < 2 THEN
    _flags := array_append(_flags, 'low_play_after_deposit');
  END IF;

  RETURN _flags;
END;
$$;

-- 4. request_withdrawal with hold + auto approval
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount_cents bigint, _method text, _destination text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
  _flags text[];
  _review boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public._assert_not_banned(_uid);
  IF _method NOT IN ('paypal','cashapp','venmo','bank') THEN
    RAISE EXCEPTION 'Unsupported payout method';
  END IF;
  IF _method = 'bank' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.payout_accounts
       WHERE user_id = _uid AND payouts_enabled = true
    ) THEN
      RAISE EXCEPTION 'Connect your bank or debit card before cashing out to it';
    END IF;
  ELSIF _destination IS NULL OR length(btrim(_destination)) < 3 THEN
    RAISE EXCEPTION 'Enter a valid payout destination';
  END IF;
  IF _amount_cents IS NULL OR _amount_cents < 500 THEN
    RAISE EXCEPTION 'Minimum withdrawal is $5.00';
  END IF;

  PERFORM public._debit_wallet(_uid, _amount_cents, 'withdrawal'::txn_kind, NULL, 'Cash withdrawal request');

  _flags := public.withdrawal_risk_flags(_uid, _amount_cents);
  _review := array_length(_flags, 1) IS NOT NULL;

  INSERT INTO public.withdrawal_requests
    (user_id, amount_cents, method, destination, risk_flags, requires_review, status, hold_until, approved_at)
  VALUES
    (_uid, _amount_cents, _method, COALESCE(btrim(_destination), ''), _flags, _review,
     CASE WHEN _review THEN 'pending' ELSE 'approved' END,
     now() + interval '72 hours',
     CASE WHEN _review THEN NULL ELSE now() END)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- 5. staff controls
CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(_request_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.withdrawal_requests%ROWTYPE;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO _r FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;
  UPDATE public.withdrawal_requests
     SET status = 'approved', approved_by = auth.uid(), approved_at = now(),
         note = COALESCE(_note, note), requires_review = false
   WHERE id = _request_id;
  PERFORM public._log_admin('withdrawal_approved', _r.user_id, _request_id::text, _r.amount_cents, _note);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_release_withdrawal_now(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.withdrawal_requests%ROWTYPE;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO _r FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF _r.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'Request already processed'; END IF;
  UPDATE public.withdrawal_requests
     SET status = 'approved', requires_review = false, hold_until = now(),
         approved_by = auth.uid(), approved_at = COALESCE(approved_at, now())
   WHERE id = _request_id;
  PERFORM public._log_admin('withdrawal_hold_released', _r.user_id, _request_id::text, _r.amount_cents, 'Hold released early');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(_request_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.withdrawal_requests%ROWTYPE;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO _r FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF _r.status NOT IN ('pending','approved','failed') THEN RAISE EXCEPTION 'Request already processed'; END IF;
  UPDATE public.withdrawal_requests
     SET status = 'rejected', note = _reason, admin_id = auth.uid(), processed_at = now()
   WHERE id = _request_id;
  IF _r.status <> 'failed' THEN
    PERFORM public._credit_wallet(_r.user_id, _r.amount_cents, 'refund'::txn_kind, NULL, 'Withdrawal rejected refund');
  END IF;
  PERFORM public._log_admin('withdrawal_rejected', _r.user_id, _request_id::text, _r.amount_cents, _reason);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_mark_withdrawal_paid(_request_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.withdrawal_requests%ROWTYPE;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO _r FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF _r.status NOT IN ('pending','approved','processing','failed') THEN RAISE EXCEPTION 'Request already processed'; END IF;
  UPDATE public.withdrawal_requests
     SET status = 'paid', note = _note, admin_id = auth.uid(), processed_at = now(),
         released_at = COALESCE(released_at, now()), provider = COALESCE(provider, 'manual')
   WHERE id = _request_id;
  PERFORM public._log_admin('withdrawal_paid', _r.user_id, _request_id::text, _r.amount_cents, _note);
END; $$;

-- 6. backend payout runner helpers (service role only)
CREATE OR REPLACE FUNCTION public.payouts_claim_due(_limit int DEFAULT 20)
RETURNS SETOF public.withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.withdrawal_requests w
     SET status = 'processing', attempts = w.attempts + 1, released_at = now()
   WHERE w.id IN (
     SELECT id FROM public.withdrawal_requests
      WHERE status = 'approved'
        AND requires_review = false
        AND hold_until <= now()
        AND method IN ('paypal','venmo','bank')
        AND attempts < 3
      ORDER BY created_at
      LIMIT GREATEST(_limit, 1)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING w.*;
END; $$;

CREATE OR REPLACE FUNCTION public.payouts_mark_sent(_request_id uuid, _provider text, _provider_payout_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.withdrawal_requests%ROWTYPE;
BEGIN
  SELECT * INTO _r FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  UPDATE public.withdrawal_requests
     SET status = 'paid', provider = _provider, provider_payout_id = _provider_payout_id,
         processed_at = now(), failure_reason = NULL
   WHERE id = _request_id;
END; $$;

CREATE OR REPLACE FUNCTION public.payouts_mark_failed(_request_id uuid, _reason text, _refund boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.withdrawal_requests%ROWTYPE;
BEGIN
  SELECT * INTO _r FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF _r.status = 'paid' THEN RETURN; END IF;
  IF _refund AND _r.attempts >= 3 THEN
    UPDATE public.withdrawal_requests
       SET status = 'failed', failure_reason = _reason, processed_at = now()
     WHERE id = _request_id;
    PERFORM public._credit_wallet(_r.user_id, _r.amount_cents, 'refund'::txn_kind, NULL, 'Cash out failed - funds returned');
    UPDATE public.withdrawal_requests SET status = 'rejected' WHERE id = _request_id;
  ELSE
    UPDATE public.withdrawal_requests
       SET status = CASE WHEN _r.attempts >= 3 THEN 'failed' ELSE 'approved' END,
           failure_reason = _reason
     WHERE id = _request_id;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.payouts_upsert_account(
  _user_id uuid, _stripe_account_id text, _details_submitted boolean, _payouts_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.payout_accounts (user_id, stripe_account_id, details_submitted, payouts_enabled)
  VALUES (_user_id, _stripe_account_id, _details_submitted, _payouts_enabled)
  ON CONFLICT (user_id) DO UPDATE
     SET stripe_account_id = EXCLUDED.stripe_account_id,
         details_submitted = EXCLUDED.details_submitted,
         payouts_enabled = EXCLUDED.payouts_enabled,
         updated_at = now();
END; $$;

REVOKE ALL ON FUNCTION public.withdrawal_risk_flags(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payouts_claim_due(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payouts_mark_sent(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payouts_mark_failed(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payouts_upsert_account(uuid, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payouts_claim_due(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.payouts_mark_sent(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.payouts_mark_failed(uuid, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.payouts_upsert_account(uuid, text, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_release_withdrawal_now(uuid) TO authenticated;
