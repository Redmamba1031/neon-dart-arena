DROP FUNCTION IF EXISTS public.credit_wallet_from_deposit(uuid,text,text,bigint,text);

CREATE TABLE public.coin_packs (
  price_id text PRIMARY KEY,
  name text NOT NULL,
  usd_cents bigint NOT NULL CHECK (usd_cents > 0),
  coins_granted bigint NOT NULL CHECK (coins_granted > 0),
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_packs TO authenticated;
GRANT ALL ON public.coin_packs TO service_role;
ALTER TABLE public.coin_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read active coin packs"
  ON public.coin_packs FOR SELECT TO authenticated USING (active = true);

INSERT INTO public.coin_packs (price_id, name, usd_cents, coins_granted, display_order) VALUES
  ('coins_500_usd',  '500 Coins',    500,   500, 1),
  ('coins_1100_usd', '1,100 Coins', 1000,  1100, 2),
  ('coins_3000_usd', '3,000 Coins', 2500,  3000, 3),
  ('coins_6500_usd', '6,500 Coins', 5000,  6500, 4);

CREATE TABLE public.gift_card_options (
  id text PRIMARY KEY,
  brand text NOT NULL DEFAULT 'amazon',
  denomination_usd_cents bigint NOT NULL CHECK (denomination_usd_cents > 0),
  coins_cost bigint NOT NULL CHECK (coins_cost > 0),
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gift_card_options TO authenticated;
GRANT ALL ON public.gift_card_options TO service_role;
ALTER TABLE public.gift_card_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read active gift card options"
  ON public.gift_card_options FOR SELECT TO authenticated USING (active = true);

INSERT INTO public.gift_card_options (id, brand, denomination_usd_cents, coins_cost, display_order) VALUES
  ('amazon_5',  'amazon',   500,   750, 1),
  ('amazon_10', 'amazon',  1000,  1500, 2),
  ('amazon_25', 'amazon',  2500,  3750, 3),
  ('amazon_50', 'amazon',  5000,  7500, 4);

CREATE TABLE public.gift_card_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  option_id text NOT NULL REFERENCES public.gift_card_options(id),
  coins_spent bigint NOT NULL CHECK (coins_spent > 0),
  denomination_usd_cents bigint NOT NULL CHECK (denomination_usd_cents > 0),
  brand text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','failed','refunded')),
  delivery_email text NOT NULL,
  recipient_name text,
  tremendous_order_id text,
  tremendous_reward_id text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz,
  refunded_at timestamptz
);
CREATE INDEX idx_redemptions_user ON public.gift_card_redemptions(user_id, created_at DESC);
GRANT SELECT ON public.gift_card_redemptions TO authenticated;
GRANT ALL ON public.gift_card_redemptions TO service_role;
ALTER TABLE public.gift_card_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own redemptions"
  ON public.gift_card_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.credit_wallet_from_deposit(
  _user_id uuid,
  _session_id text,
  _payment_intent text,
  _coins_granted bigint,
  _environment text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _existing public.deposits%rowtype;
BEGIN
  IF _coins_granted <= 0 THEN
    RAISE EXCEPTION 'Coins granted must be positive';
  END IF;

  SELECT * INTO _existing FROM public.deposits WHERE stripe_session_id = _session_id FOR UPDATE;
  IF FOUND THEN
    IF _existing.status = 'credited' THEN
      RETURN;
    END IF;
    UPDATE public.deposits
      SET status = 'credited',
          credited_at = now(),
          stripe_payment_intent = COALESCE(_payment_intent, stripe_payment_intent),
          updated_at = now()
      WHERE stripe_session_id = _session_id;
  ELSE
    INSERT INTO public.deposits (user_id, stripe_session_id, stripe_payment_intent, amount_cents, status, environment, credited_at)
    VALUES (_user_id, _session_id, _payment_intent, _coins_granted, 'credited', _environment, now());
  END IF;

  INSERT INTO public.wallets (user_id, balance_cents)
    VALUES (_user_id, _coins_granted)
    ON CONFLICT (user_id) DO UPDATE
    SET balance_cents = public.wallets.balance_cents + EXCLUDED.balance_cents,
        updated_at = now();

  INSERT INTO public.wallet_transactions (user_id, kind, amount_cents, note)
  VALUES (_user_id, 'deposit', _coins_granted, 'Coin pack purchase ' || _session_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.credit_wallet_from_deposit(uuid,text,text,bigint,text) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.redeem_gift_card(
  _option_id text,
  _delivery_email text,
  _recipient_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _opt public.gift_card_options%rowtype;
  _rid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _delivery_email IS NULL OR length(_delivery_email) < 5 OR length(_delivery_email) > 254 THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;
  IF _delivery_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;

  SELECT * INTO _opt FROM public.gift_card_options WHERE id = _option_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gift card option not available'; END IF;

  PERFORM public._debit_wallet(_uid, _opt.coins_cost, 'withdrawal', NULL, 'Gift card redemption: ' || _opt.brand || ' $' || (_opt.denomination_usd_cents/100));

  INSERT INTO public.gift_card_redemptions (
    user_id, option_id, coins_spent, denomination_usd_cents, brand, status, delivery_email, recipient_name
  ) VALUES (
    _uid, _opt.id, _opt.coins_cost, _opt.denomination_usd_cents, _opt.brand, 'pending', _delivery_email, _recipient_name
  ) RETURNING id INTO _rid;

  RETURN _rid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_gift_card(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public._refund_redemption(_redemption_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _r public.gift_card_redemptions%rowtype;
BEGIN
  SELECT * INTO _r FROM public.gift_card_redemptions WHERE id = _redemption_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found'; END IF;
  IF _r.status <> 'pending' THEN RETURN; END IF;

  PERFORM public._credit_wallet(_r.user_id, _r.coins_spent, 'refund', NULL, 'Refund: gift card failed');

  UPDATE public.gift_card_redemptions
    SET status = 'refunded', refunded_at = now(), failure_reason = _reason
    WHERE id = _redemption_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._refund_redemption(uuid,text) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public._mark_redemption_fulfilled(
  _redemption_id uuid,
  _order_id text,
  _reward_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.gift_card_redemptions
    SET status = 'fulfilled',
        fulfilled_at = now(),
        tremendous_order_id = _order_id,
        tremendous_reward_id = _reward_id
    WHERE id = _redemption_id AND status = 'pending';
END;
$$;
REVOKE EXECUTE ON FUNCTION public._mark_redemption_fulfilled(uuid,text,text) FROM anon, authenticated, public;

DROP FUNCTION IF EXISTS public.dev_top_up(bigint);