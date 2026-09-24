CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _dob date;
begin
  begin
    _dob := nullif(new.raw_user_meta_data->>'date_of_birth','')::date;
  exception when others then _dob := null;
  end;
  if _dob is not null and _dob > (current_date - interval '18 years') then _dob := null; end if;
  insert into public.profiles (id, username, display_name, avatar_url, legal_name, date_of_birth)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    nullif(left(btrim(coalesce(new.raw_user_meta_data->>'legal_name','')),120),''),
    _dob
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount_cents bigint, _method text, _destination text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
  _flags text[];
  _review boolean;
  _staff boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public._assert_not_banned(_uid);
  IF _method NOT IN ('paypal','venmo','bank') THEN
    RAISE EXCEPTION 'Unsupported payout method';
  END IF;
  IF _method = 'bank' THEN
    IF NOT EXISTS (SELECT 1 FROM public.payout_accounts WHERE user_id = _uid AND payouts_enabled = true) THEN
      RAISE EXCEPTION 'Connect your bank or debit card before cashing out to it';
    END IF;
  ELSIF _destination IS NULL OR length(btrim(_destination)) < 3 THEN
    RAISE EXCEPTION 'Enter a valid payout destination';
  END IF;
  IF _amount_cents IS NULL OR _amount_cents < 500 THEN
    RAISE EXCEPTION 'Minimum withdrawal is $5.00';
  END IF;

  PERFORM public._debit_wallet(_uid, _amount_cents, 'withdrawal'::txn_kind, NULL, 'Cash withdrawal request');

  _staff := public.is_staff(_uid);
  IF _staff THEN
    _flags := ARRAY[]::text[];
    _review := false;
  ELSE
    _flags := public.withdrawal_risk_flags(_uid, _amount_cents);
    _review := array_length(_flags, 1) IS NOT NULL;
  END IF;

  INSERT INTO public.withdrawal_requests
    (user_id, amount_cents, method, destination, risk_flags, requires_review, status, hold_until, approved_at, approved_by)
  VALUES
    (_uid, _amount_cents, _method, COALESCE(btrim(_destination), ''), _flags, _review,
     CASE WHEN _review THEN 'pending' ELSE 'approved' END,
     CASE WHEN _staff THEN now() ELSE now() + interval '72 hours' END,
     CASE WHEN _review THEN NULL ELSE now() END,
     CASE WHEN _staff THEN _uid ELSE NULL END)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;