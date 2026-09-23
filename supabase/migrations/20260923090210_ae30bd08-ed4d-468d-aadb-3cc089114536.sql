create or replace function public._assert_age_verified(_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare _p public.profiles%rowtype;
begin
  select * into _p from public.profiles where id = _user_id;
  if _p.legal_name is null or _p.date_of_birth is null then
    raise exception 'Submit your legal name and date of birth in your profile before playing for money';
  end if;
  if not coalesce(_p.age_verified, false) then
    raise exception 'Your age must be verified by SMYD staff before you can play for money';
  end if;
end; $$;

revoke execute on function public._assert_age_verified(uuid) from public, anon, authenticated;

create or replace function public._charge_entry(_user_id uuid, _match_id uuid, _entry_cents bigint, _rake_bps integer, _note text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare _fee bigint := public.match_fee_cents(_entry_cents, _rake_bps);
begin
  perform public._assert_age_verified(_user_id);
  perform public._debit_wallet(_user_id, _entry_cents - _fee, 'match_stake', _match_id, _note || ' (prize pot)');
  if _fee > 0 then
    perform public._debit_wallet(_user_id, _fee, 'rake', _match_id, _note || ' (service fee)');
    perform public._collect_fee(_match_id, _fee, 'Service fee collected');
  end if;
end; $$;