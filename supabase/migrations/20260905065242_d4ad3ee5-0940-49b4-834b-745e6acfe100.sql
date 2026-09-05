-- 1. admin role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. staff helper
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('owner', 'admin')
  )
$$;

-- 3. bans
CREATE TABLE IF NOT EXISTS public.player_bans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  banned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_bans TO authenticated;
GRANT ALL ON public.player_bans TO service_role;
ALTER TABLE public.player_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own ban" ON public.player_bans
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- 4. audit log
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  target_id text,
  amount_cents bigint,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_actions TO authenticated;
GRANT ALL ON public.admin_actions TO service_role;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read admin actions" ON public.admin_actions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public._log_admin(_action text, _target_user uuid, _target_id text, _amount bigint, _note text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.admin_actions (admin_id, action, target_user_id, target_id, amount_cents, note)
  VALUES (auth.uid(), _action, _target_user, _target_id, _amount, _note);
$$;

CREATE OR REPLACE FUNCTION public._require_staff()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_staff(auth.uid()) then raise exception 'Admin access required'; end if;
end; $$;

CREATE OR REPLACE FUNCTION public._assert_not_banned(_user_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if exists (select 1 from public.player_bans where user_id = _user_id) then
    raise exception 'Your account is banned from SMYD';
  end if;
end; $$;

-- 5. staff read policies
CREATE POLICY "Staff read all wallets" ON public.wallets
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff read all transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff read all redemptions" ON public.gift_card_redemptions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff read all deposits" ON public.deposits
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- 6. admin operations
CREATE OR REPLACE FUNCTION public.admin_ban_player(_user_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  perform public._require_staff();
  if _user_id = auth.uid() then raise exception 'You cannot ban yourself'; end if;
  if public.is_staff(_user_id) then raise exception 'Cannot ban a staff account'; end if;
  if length(coalesce(_reason,'')) < 3 then raise exception 'A reason is required'; end if;
  insert into public.player_bans (user_id, reason, banned_by)
  values (_user_id, _reason, auth.uid())
  on conflict (user_id) do update set reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();
  perform public._log_admin('ban_player', _user_id, null, null, _reason);
end; $$;

CREATE OR REPLACE FUNCTION public.admin_unban_player(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  perform public._require_staff();
  delete from public.player_bans where user_id = _user_id;
  perform public._log_admin('unban_player', _user_id, null, null, null);
end; $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_match_id uuid, _winner_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _m public.matches%rowtype;
begin
  perform public._require_staff();
  select * into _m from public.matches where id = _match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _m.status <> 'live' then raise exception 'Match is not live'; end if;
  if _winner_id <> _m.creator_id and _winner_id <> _m.opponent_id then
    raise exception 'Winner must be a participant';
  end if;
  update public.matches set disputed = false, reported_winner_id = _winner_id where id = _match_id;
  perform public._settle_match(_match_id, _winner_id);
  perform public._log_admin('resolve_dispute', _winner_id, _match_id::text, null, _note);
end; $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_coins(_user_id uuid, _amount_cents bigint, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  perform public._require_staff();
  if _amount_cents = 0 then raise exception 'Amount cannot be zero'; end if;
  if length(coalesce(_note,'')) < 3 then raise exception 'A reason is required'; end if;
  if abs(_amount_cents) > 10000000 then raise exception 'Amount too large'; end if;
  if _amount_cents > 0 then
    perform public._credit_wallet(_user_id, _amount_cents, 'deposit'::public.txn_kind, null, 'Admin adjustment: '||_note);
  else
    perform public._debit_wallet(_user_id, -_amount_cents, 'withdrawal'::public.txn_kind, null, 'Admin adjustment: '||_note);
  end if;
  perform public._log_admin('adjust_coins', _user_id, null, _amount_cents, _note);
end; $$;

CREATE OR REPLACE FUNCTION public.admin_refund_redemption(_redemption_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  perform public._require_staff();
  if length(coalesce(_reason,'')) < 3 then raise exception 'A reason is required'; end if;
  perform public._refund_redemption(_redemption_id, _reason);
  perform public._log_admin('refund_redemption', null, _redemption_id::text, null, _reason);
end; $$;

CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role text, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _r public.app_role;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.has_role(auth.uid(), 'owner'::public.app_role) then
    raise exception 'Only the app owner can manage admin access';
  end if;
  if _role <> 'admin' then raise exception 'Only admin access can be granted'; end if;
  _r := _role::public.app_role;
  if _grant then
    insert into public.user_roles (user_id, role) values (_user_id, _r) on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles where user_id = _user_id and role = _r;
  end if;
  perform public._log_admin(case when _grant then 'grant_admin' else 'revoke_admin' end, _user_id, null, null, null);
end; $$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE ALL ON FUNCTION public._log_admin(text, uuid, text, bigint, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public._require_staff() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public._assert_not_banned(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_ban_player(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_unban_player(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_resolve_dispute(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_adjust_coins(uuid, bigint, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_refund_redemption(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid, text, boolean) FROM anon;

-- 7. block banned players from wagering
CREATE OR REPLACE FUNCTION public.create_match(_mode match_mode, _best_of integer, _stake_cents bigint, _double_in boolean DEFAULT false, _finish_rule finish_rule DEFAULT 'double'::finish_rule, _opponent_id uuid DEFAULT NULL::uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid(); _match_id uuid;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  perform public._assert_not_banned(_uid);
  if _best_of not in (1,3,5) then raise exception 'Invalid best_of'; end if;
  if _mode = 'Medley' and _best_of = 1 then raise exception 'Medley requires best of 3 or 5'; end if;
  if _stake_cents < 500 or _stake_cents > 100000000 then raise exception 'Stake must be at least 500 coins'; end if;
  if _opponent_id = _uid then raise exception 'You cannot challenge yourself'; end if;
  if _opponent_id is not null and not exists(select 1 from profiles where id = _opponent_id) then
    raise exception 'Player not found';
  end if;

  insert into matches (creator_id, mode, best_of, stake_cents, double_in, finish_rule, invited_id)
  values (_uid, _mode, _best_of, _stake_cents, _double_in, _finish_rule, _opponent_id)
  returning id into _match_id;

  perform _debit_wallet(_uid, _stake_cents, 'match_stake', _match_id, 'Created match');

  if _opponent_id is not null then
    insert into challenges (match_id, challenger_id, challenged_id) values (_match_id, _uid, _opponent_id);
  end if;

  return _match_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.join_match(_match_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid(); _m public.matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  perform public._assert_not_banned(_uid);
  select * into _m from public.matches where id = _match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _m.status <> 'open' then raise exception 'Match not open'; end if;
  if _m.creator_id = _uid then raise exception 'Cannot join your own match'; end if;
  if _m.opponent_id is not null then raise exception 'Match already has an opponent'; end if;

  perform public._debit_wallet(_uid, _m.stake_cents, 'match_stake', _match_id, 'Joined match');

  update public.matches
    set opponent_id = _uid, status = 'live', started_at = now(),
        report_deadline = now() + interval '45 minutes'
    where id = _match_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.respond_challenge(_challenge_id uuid, _accept boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid(); _c public.challenges%rowtype; _m public.matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _c from challenges where id = _challenge_id for update;
  if not found then raise exception 'Challenge not found'; end if;
  if _c.challenged_id <> _uid then raise exception 'Not your challenge'; end if;
  if _c.status <> 'pending' then raise exception 'Challenge already answered'; end if;

  select * into _m from matches where id = _c.match_id for update;

  if _accept then
    perform public._assert_not_banned(_uid);
    if _m.status <> 'open' then raise exception 'Match no longer open'; end if;
    perform _debit_wallet(_uid, _m.stake_cents, 'match_stake', _m.id, 'Accepted challenge');
    update matches set opponent_id = _uid, status = 'live', started_at = now(),
      report_deadline = now() + interval '45 minutes' where id = _m.id;
    update challenges set status = 'accepted', responded_at = now() where id = _challenge_id;
  else
    if _m.status = 'open' then
      perform _credit_wallet(_m.creator_id, _m.stake_cents, 'refund', _m.id, 'Challenge declined');
      update matches set status = 'cancelled', cancelled_at = now() where id = _m.id;
    end if;
    update challenges set status = 'declined', responded_at = now() where id = _challenge_id;
  end if;
end; $function$;

CREATE OR REPLACE FUNCTION public.redeem_gift_card(_option_id text, _delivery_email text, _recipient_name text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _opt public.gift_card_options%rowtype;
  _rid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public._assert_not_banned(_uid);
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
$function$;