
create or replace function public._house_account()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ur.user_id from public.user_roles ur
  join public.wallets w on w.user_id = ur.user_id
  where ur.role = 'owner'
  order by ur.created_at
  limit 1
$$;

revoke all on function public._house_account() from public, anon, authenticated;

create or replace function public._collect_fee(_match_id uuid, _fee bigint, _note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _house uuid := public._house_account();
begin
  if _fee is null or _fee <= 0 or _house is null then return; end if;
  update public.wallets set balance_cents = balance_cents + _fee where user_id = _house;
  insert into public.wallet_transactions (user_id, amount_cents, kind, match_id, note)
  values (_house, _fee, 'rake', _match_id, _note);
end; $$;

revoke all on function public._collect_fee(uuid, bigint, text) from public, anon, authenticated;

create or replace function public._return_fee(_match_id uuid, _fee bigint, _note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _house uuid := public._house_account();
begin
  if _fee is null or _fee <= 0 or _house is null then return; end if;
  update public.wallets set balance_cents = balance_cents - _fee where user_id = _house;
  insert into public.wallet_transactions (user_id, amount_cents, kind, match_id, note)
  values (_house, -_fee, 'rake', _match_id, _note);
end; $$;

revoke all on function public._return_fee(uuid, bigint, text) from public, anon, authenticated;

create or replace function public._charge_entry(_user_id uuid, _match_id uuid, _entry_cents bigint, _rake_bps integer, _note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _fee bigint := public.match_fee_cents(_entry_cents, _rake_bps);
begin
  perform public._debit_wallet(_user_id, _entry_cents - _fee, 'match_stake', _match_id, _note || ' (prize pot)');
  if _fee > 0 then
    perform public._debit_wallet(_user_id, _fee, 'rake', _match_id, _note || ' (service fee)');
    perform public._collect_fee(_match_id, _fee, 'Service fee collected');
  end if;
end; $$;

create or replace function public.cancel_match(_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _m public.matches%rowtype;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  select * into _m from public.matches where id = _match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if _m.creator_id <> _uid then raise exception 'Only the creator can cancel'; end if;
  if _m.status <> 'open' then raise exception 'Only open matches can be cancelled'; end if;

  perform public._credit_wallet(_uid, _m.stake_cents, 'refund', _match_id, 'Cancelled match - entry refunded');
  perform public._return_fee(_match_id, public.match_fee_cents(_m.stake_cents, _m.rake_bps), 'Service fee returned - match cancelled');

  update public.matches
    set status = 'cancelled', cancelled_at = now()
    where id = _match_id;
end; $$;

create or replace function public.respond_challenge(_challenge_id uuid, _accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
    perform public._assert_region_allowed(_uid);
    if _m.status <> 'open' then raise exception 'Match no longer open'; end if;
    perform public._charge_entry(_uid, _m.id, _m.stake_cents, _m.rake_bps, 'Accepted challenge');
    update matches set opponent_id = _uid, status = 'live', started_at = now(),
      report_deadline = now() + interval '45 minutes' where id = _m.id;
    update challenges set status = 'accepted', responded_at = now() where id = _challenge_id;
  else
    if _m.status = 'open' then
      perform public._credit_wallet(_m.creator_id, _m.stake_cents, 'refund', _m.id, 'Challenge declined - entry refunded');
      perform public._return_fee(_m.id, public.match_fee_cents(_m.stake_cents, _m.rake_bps), 'Service fee returned - challenge declined');
      update matches set status = 'cancelled', cancelled_at = now() where id = _m.id;
    end if;
    update challenges set status = 'declined', responded_at = now() where id = _challenge_id;
  end if;
end; $$;
